const { PDFParse } = require('pdf-parse');
const XLSX = require('xlsx');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { logError } = require('./logger');

class FileExtractor {
    constructor() {
        this.ocrWorker = null;
        
        // Default limits for free tier (Render: 512MB RAM, Supabase: TEXT column ~1GB but practical limit is smaller)
        this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default (safe for free tier)
        this.maxExtractedTextSize = parseInt(process.env.MAX_EXTRACTED_TEXT_SIZE || '100000'); // 100KB extracted text max
        this.extractionTimeout = parseInt(process.env.EXTRACTION_TIMEOUT || '30000'); // 30 seconds default
        
        this.enabled = {
            pdf: process.env.EXTRACT_PDF !== 'false', // Default: true
            excel: process.env.EXTRACT_EXCEL !== 'false', // Default: true
            word: process.env.EXTRACT_WORD !== 'false', // Default: true
            text: process.env.EXTRACT_TEXT !== 'false', // Default: true (plain text files)
            image: process.env.EXTRACT_IMAGE === 'true' // Default: false (OCR is CPU intensive, disable on free tier)
        };
        
        // Tesseract.js data path for languages
        this.ocrLanguages = ['eng', 'heb', 'rus']; // English, Hebrew, Russian
    }

    /**
     * Initialize OCR worker
     */
    async initOCR() {
        if (this.ocrWorker) return;
        
        try {
            this.ocrWorker = await createWorker(this.ocrLanguages);
            console.log('✅ OCR worker initialized');
        } catch (error) {
            logError(error, { context: 'ocr_init' });
            console.warn('⚠️ OCR initialization failed, image text extraction disabled');
            this.enabled.image = false;
        }
    }

    /**
     * Cleanup OCR worker
     */
    async cleanupOCR() {
        if (this.ocrWorker) {
            await this.ocrWorker.terminate();
            this.ocrWorker = null;
        }
    }

    /**
     * Extract text from a file with size and timeout limits
     * @param {Buffer} fileBuffer - File content as buffer
     * @param {string} mimetype - MIME type of the file
     * @param {string} filename - File name
     * @returns {Promise<string>} Extracted text
     */
    async extractText(fileBuffer, mimetype, filename) {
        try {
            if (!fileBuffer || !mimetype) {
                return '';
            }

            // Check file size limit (critical for free tier memory constraints)
            if (fileBuffer.length > this.maxFileSize) {
                console.warn(`⚠️ File ${filename} too large (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB > ${(this.maxFileSize / 1024 / 1024).toFixed(2)}MB), skipping extraction`);
                return '';
            }

            // Create a promise with timeout
            const extractionPromise = this.performExtraction(fileBuffer, mimetype, filename);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Extraction timeout')), this.extractionTimeout)
            );

            // Race between extraction and timeout
            const extractedText = await Promise.race([extractionPromise, timeoutPromise]);

            // Limit extracted text size (prevent database issues)
            if (extractedText && extractedText.length > this.maxExtractedTextSize) {
                console.warn(`⚠️ Extracted text too large (${extractedText.length} chars > ${this.maxExtractedTextSize}), truncating`);
                return extractedText.substring(0, this.maxExtractedTextSize);
            }

            return extractedText || '';
        } catch (error) {
            if (error.message === 'Extraction timeout') {
                console.warn(`⚠️ File extraction timed out after ${this.extractionTimeout}ms for ${filename}`);
                logError(error, {
                    context: 'file_extraction_timeout',
                    mimetype,
                    filename,
                    fileSize: fileBuffer?.length
                });
            } else {
                logError(error, {
                    context: 'file_extraction',
                    mimetype,
                    filename,
                    fileSize: fileBuffer?.length
                });
            }
            return '';
        }
    }

    /**
     * Perform the actual extraction (called by extractText with timeout protection)
     */
    async performExtraction(fileBuffer, mimetype, filename) {
        // PDF files
        if (mimetype === 'application/pdf') {
            return await this.extractFromPDF(fileBuffer);
        }

        // Excel files (.xlsx, .xls)
        if (mimetype.includes('spreadsheet') || filename.match(/\.xlsx?$/i)) {
            return await this.extractFromExcel(fileBuffer);
        }

        // Word documents (.docx, .doc)
        if (mimetype.includes('wordprocessingml') || mimetype === 'application/msword' || filename.match(/\.docx?$/i)) {
            return await this.extractFromWord(fileBuffer);
        }

        // Plain text files (.txt)
        if (mimetype === 'text/plain' || filename.match(/\.txt$/i)) {
            return await this.extractFromText(fileBuffer);
        }

        // Images
        if (mimetype.startsWith('image/')) {
            return await this.extractFromImage(fileBuffer);
        }

        return '';
    }

    /**
     * Extract text from PDF
     */
    async extractFromPDF(buffer) {
        if (!this.enabled.pdf) return '';
        
        try {
            const parser = new PDFParse({});
            // pdf-parse v2.4.5 load() expects an object with url or data property
            await parser.load({ data: buffer });
            const text = await parser.getText();
            await parser.destroy();
            return text || '';
        } catch (error) {
            logError(error, { context: 'pdf_extraction' });
            return '';
        }
    }

    /**
     * Extract text from Excel
     */
    async extractFromExcel(buffer) {
        if (!this.enabled.excel) return '';
        
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let text = '';

            // Extract from all sheets (limit to first 10 sheets for memory efficiency)
            const maxSheets = 10;
            const sheetsToProcess = workbook.SheetNames.slice(0, maxSheets);
            
            if (workbook.SheetNames.length > maxSheets) {
                console.warn(`⚠️ Excel file has ${workbook.SheetNames.length} sheets, extracting only first ${maxSheets}`);
            }

            for (const sheetName of sheetsToProcess) {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_csv(worksheet);
                
                // Check if we're approaching the limit
                if (text.length + sheetData.length > this.maxExtractedTextSize) {
                    const remaining = this.maxExtractedTextSize - text.length;
                    text += sheetData.substring(0, Math.max(0, remaining));
                    console.warn(`⚠️ Excel extraction truncated at ${this.maxExtractedTextSize} characters`);
                    break;
                }
                
                text += sheetData + '\n';
            }

            return text.trim();
        } catch (error) {
            logError(error, { context: 'excel_extraction', bufferSize: buffer?.length });
            return '';
        }
    }

    /**
     * Extract text from Word document
     */
    async extractFromWord(buffer) {
        if (!this.enabled.word) return '';
        
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value || '';
        } catch (error) {
            logError(error, { context: 'word_extraction' });
            return '';
        }
    }

    /**
     * Extract text from plain text file (.txt)
     */
    async extractFromText(buffer) {
        if (!this.enabled.text) return '';
        
        try {
            // Convert buffer to UTF-8 string (handles various encodings)
            // Try UTF-8 first, fallback to latin1 if needed
            let text = '';
            try {
                text = buffer.toString('utf8');
                // Check if we got valid UTF-8 (no replacement characters)
                if (text.includes('\uFFFD')) {
                    // Invalid UTF-8, try latin1
                    text = buffer.toString('latin1');
                }
            } catch (error) {
                // Fallback to latin1
                text = buffer.toString('latin1');
            }
            
            return text || '';
        } catch (error) {
            logError(error, { context: 'text_extraction' });
            return '';
        }
    }

    /**
     * Extract text from image using OCR
     */
    async extractFromImage(buffer) {
        if (!this.enabled.image || !this.ocrWorker) return '';
        
        try {
            // Initialize worker if needed
            if (!this.ocrWorker) {
                await this.initOCR();
            }

            // Use worker to recognize text
            const { data: { text } } = await this.ocrWorker.recognize(buffer);
            return text || '';
        } catch (error) {
            logError(error, { context: 'image_ocr' });
            return '';
        }
    }

    /**
     * Check if file type is supported for extraction
     */
    isSupported(mimetype, filename) {
        if (!mimetype && !filename) return false;

        // Check by MIME type
        if (mimetype) {
            if (mimetype === 'application/pdf') return this.enabled.pdf;
            if (mimetype.includes('spreadsheet')) return this.enabled.excel;
            if (mimetype.includes('wordprocessingml') || mimetype === 'application/msword') return this.enabled.word;
            if (mimetype === 'text/plain') return this.enabled.text;
            if (mimetype.startsWith('image/')) return this.enabled.image;
        }

        // Check by file extension
        if (filename) {
            const ext = path.extname(filename).toLowerCase();
            if (ext === '.pdf') return this.enabled.pdf;
            if (ext === '.xlsx' || ext === '.xls') return this.enabled.excel;
            if (ext === '.docx' || ext === '.doc') return this.enabled.word;
            if (ext === '.txt') return this.enabled.text;
            if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) return this.enabled.image;
        }

        return false;
    }

    /**
     * Get file type from MIME type or filename
     */
    getFileType(mimetype, filename) {
        if (mimetype === 'application/pdf') return 'pdf';
        if (mimetype.includes('spreadsheet') || filename?.match(/\.xlsx?$/i)) return 'excel';
        if (mimetype.includes('wordprocessingml') || mimetype === 'application/msword' || filename?.match(/\.docx?$/i)) return 'word';
        if (mimetype === 'text/plain' || filename?.match(/\.txt$/i)) return 'text';
        if (mimetype?.startsWith('image/')) return 'image';
        return 'unknown';
    }

    /**
     * Enable or disable extraction for specific file types
     */
    setEnabled(fileType, enabled) {
        if (this.enabled.hasOwnProperty(fileType)) {
            this.enabled[fileType] = enabled;
        }
    }

    /**
     * Get current enabled status
     */
    getEnabled() {
        return { ...this.enabled };
    }
}

module.exports = FileExtractor;

