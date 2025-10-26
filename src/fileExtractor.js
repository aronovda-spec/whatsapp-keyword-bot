const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { logError } = require('./logger');

class FileExtractor {
    constructor() {
        this.ocrWorker = null;
        this.enabled = {
            pdf: true,
            excel: true,
            word: true,
            image: true  // OCR is CPU intensive, consider making this optional
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
     * Extract text from a file
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

            // Images
            if (mimetype.startsWith('image/')) {
                return await this.extractFromImage(fileBuffer);
            }

            return '';
        } catch (error) {
            logError(error, {
                context: 'file_extraction',
                mimetype,
                filename
            });
            return '';
        }
    }

    /**
     * Extract text from PDF
     */
    async extractFromPDF(buffer) {
        if (!this.enabled.pdf) return '';
        
        try {
            const data = await pdfParse(buffer);
            return data.text || '';
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

            // Extract from all sheets
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_csv(worksheet);
                text += sheetData + '\n';
            });

            return text.trim();
        } catch (error) {
            logError(error, { context: 'excel_extraction' });
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
            if (mimetype.startsWith('image/')) return this.enabled.image;
        }

        // Check by file extension
        if (filename) {
            const ext = path.extname(filename).toLowerCase();
            if (ext === '.pdf') return this.enabled.pdf;
            if (ext === '.xlsx' || ext === '.xls') return this.enabled.excel;
            if (ext === '.docx' || ext === '.doc') return this.enabled.word;
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

