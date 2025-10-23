const fs = require('fs');
const path = require('path');

class KeywordDetector {
    constructor() {
        this.keywords = [];
        this.caseSensitive = false;
        this.exactMatch = true;
        this.enabled = true;
        this.loadConfig();
    }

    loadConfig() {
        try {
            const configPath = path.join(__dirname, '../config/keywords.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            this.keywords = config.keywords || [];
            this.caseSensitive = config.caseSensitive || false;
            this.exactMatch = config.exactMatch !== false; // Default to true
            this.enabled = config.enabled !== false; // Default to true
            
            console.log(`Loaded ${this.keywords.length} keywords:`, this.keywords);
        } catch (error) {
            console.error('Error loading keyword config:', error);
            // Fallback to default keywords
            this.keywords = ['urgent', 'emergency', 'important'];
        }
    }

    reloadConfig() {
        this.loadConfig();
    }

    detectKeywords(messageText) {
        if (!this.enabled || !messageText || typeof messageText !== 'string') {
            return [];
        }

        const detectedKeywords = [];
        const searchText = this.caseSensitive ? messageText : messageText.toLowerCase();

        for (const keyword of this.keywords) {
            const searchKeyword = this.caseSensitive ? keyword : keyword.toLowerCase();
            
            if (this.exactMatch) {
                // Enhanced exact word matching for multilingual support
                if (this.isLatinScript(searchKeyword)) {
                    // Use word boundaries for Latin scripts (English, etc.)
                    const regex = new RegExp(`\\b${this.escapeRegex(searchKeyword)}\\b`, this.caseSensitive ? 'g' : 'gi');
                    if (regex.test(searchText)) {
                        detectedKeywords.push(keyword);
                    }
                } else {
                    // For non-Latin scripts (Hebrew, Russian, Arabic, etc.), use space/punctuation boundaries
                    const regex = new RegExp(`(^|[\\s\\p{P}])${this.escapeRegex(searchKeyword)}([\\s\\p{P}]|$)`, this.caseSensitive ? 'gu' : 'giu');
                    if (regex.test(searchText)) {
                        detectedKeywords.push(keyword);
                    }
                }
            } else {
                // Simple substring matching
                if (searchText.includes(searchKeyword)) {
                    detectedKeywords.push(keyword);
                }
            }
        }

        return detectedKeywords;
    }

    isLatinScript(text) {
        // Check if text contains only Latin characters
        return /^[a-zA-Z\s]*$/.test(text);
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    addKeyword(keyword) {
        if (!this.keywords.includes(keyword)) {
            this.keywords.push(keyword);
            this.saveConfig();
        }
    }

    removeKeyword(keyword) {
        const index = this.keywords.indexOf(keyword);
        if (index > -1) {
            this.keywords.splice(index, 1);
            this.saveConfig();
        }
    }

    saveConfig() {
        try {
            const config = {
                keywords: this.keywords,
                caseSensitive: this.caseSensitive,
                exactMatch: this.exactMatch,
                enabled: this.enabled
            };
            
            const configPath = path.join(__dirname, '../config/keywords.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error saving keyword config:', error);
        }
    }

    getKeywords() {
        return [...this.keywords]; // Return copy to prevent external modification
    }

    isEnabled() {
        return this.enabled;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.saveConfig();
    }
}

module.exports = KeywordDetector;
