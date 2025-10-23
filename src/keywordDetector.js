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

    detectKeywords(messageText, groupName = null) {
        if (!this.enabled || !messageText || typeof messageText !== 'string') {
            return [];
        }

        const detectedKeywords = [];
        const searchText = this.caseSensitive ? messageText : messageText.toLowerCase();

        // Check global keywords (for all users)
        for (const keyword of this.keywords) {
            const searchKeyword = this.caseSensitive ? keyword : keyword.toLowerCase();
            
            if (this.exactMatch) {
                // Enhanced exact word matching for multilingual support
                if (this.isLatinScript(searchKeyword)) {
                    // Use word boundaries for Latin scripts (English, etc.)
                    const regex = new RegExp(`\\b${this.escapeRegex(searchKeyword)}\\b`, this.caseSensitive ? 'g' : 'gi');
                    if (regex.test(searchText)) {
                        detectedKeywords.push({ keyword, type: 'global' });
                    }
                } else {
                    // For non-Latin scripts (Hebrew, Russian, Arabic, etc.), use space/punctuation boundaries
                    const regex = new RegExp(`(^|[\\s\\p{P}])${this.escapeRegex(searchKeyword)}([\\s\\p{P}]|$)`, this.caseSensitive ? 'gu' : 'giu');
                    if (regex.test(searchText)) {
                        detectedKeywords.push({ keyword, type: 'global' });
                    }
                }
            } else {
                // Simple substring matching
                if (searchText.includes(searchKeyword)) {
                    detectedKeywords.push({ keyword, type: 'global' });
                }
            }
        }

        // Check personal keywords ONLY for users subscribed to this specific group
        if (groupName) {
            const groupSubscribers = this.getGroupSubscribers(groupName);
            for (const userId of groupSubscribers) {
                const personalKeywords = this.getPersonalKeywords(userId);
                for (const keyword of personalKeywords) {
                    const searchKeyword = this.caseSensitive ? keyword : keyword.toLowerCase();
                    
                    if (this.exactMatch) {
                        if (this.isLatinScript(searchKeyword)) {
                            const regex = new RegExp(`\\b${this.escapeRegex(searchKeyword)}\\b`, this.caseSensitive ? 'g' : 'gi');
                            if (regex.test(searchText)) {
                                detectedKeywords.push({ keyword, type: 'personal', userId });
                            }
                        } else {
                            const regex = new RegExp(`(^|[\\s\\p{P}])${this.escapeRegex(searchKeyword)}([\\s\\p{P}]|$)`, this.caseSensitive ? 'gu' : 'giu');
                            if (regex.test(searchText)) {
                                detectedKeywords.push({ keyword, type: 'personal', userId });
                            }
                        }
                    } else {
                        if (searchText.includes(searchKeyword)) {
                            detectedKeywords.push({ keyword, type: 'personal', userId });
                        }
                    }
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

    getAuthorizedUsers() {
        try {
            const fs = require('fs');
            const path = require('path');
            const authPath = path.join(__dirname, '../config/telegram-auth.json');
            
            if (fs.existsSync(authPath)) {
                const data = JSON.parse(fs.readFileSync(authPath, 'utf8'));
                return data.authorizedUsers || [];
            }
            
            return [];
        } catch (error) {
            console.error('Error loading authorized users:', error.message);
            return [];
        }
    }

    getGroupSubscribers(groupName) {
        try {
            const fs = require('fs');
            const path = require('path');
            const subscriptionsPath = path.join(__dirname, '../config/group-subscriptions.json');
            
            if (fs.existsSync(subscriptionsPath)) {
                const data = JSON.parse(fs.readFileSync(subscriptionsPath, 'utf8'));
                return data[groupName] || [];
            }
            
            return [];
        } catch (error) {
            console.error('Error loading group subscribers:', error.message);
            return [];
        }
    }

    getPersonalKeywords(userId) {
        try {
            const fs = require('fs');
            const path = require('path');
            const personalKeywordsPath = path.join(__dirname, '../config/personal-keywords.json');
            
            if (fs.existsSync(personalKeywordsPath)) {
                const data = JSON.parse(fs.readFileSync(personalKeywordsPath, 'utf8'));
                return data[userId] || [];
            }
            
            return [];
        } catch (error) {
            console.error('Error loading personal keywords:', error.message);
            return [];
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.saveConfig();
    }
}

module.exports = KeywordDetector;
