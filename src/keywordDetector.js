const fs = require('fs');
const path = require('path');
const levenshtein = require('fast-levenshtein');

class KeywordDetector {
    constructor() {
        this.keywords = [];
        this.caseSensitive = false;
        this.exactMatch = true;
        this.enabled = true;
        this.fuzzyMatching = true;
        this.fuzzyThreshold = {
            short: 1,    // Words < 5 characters
            medium: 2,  // Words 5-8 characters
            long: 3      // Words > 8 characters
        };
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
            this.fuzzyMatching = config.fuzzyMatching !== false; // Default to true
            if (config.fuzzyThreshold) {
                this.fuzzyThreshold = { ...this.fuzzyThreshold, ...config.fuzzyThreshold };
            }
            
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

        // Use fuzzy matching if enabled, otherwise fall back to exact matching
        if (this.fuzzyMatching) {
            return this.detectKeywordsWithFuzzy(messageText, groupName);
        }

        // Fallback to original exact matching logic
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
                        detectedKeywords.push({ keyword, type: 'global', matchType: 'exact' });
                    }
                } else {
                    // For non-Latin scripts (Hebrew, Russian, Arabic, etc.), use space/punctuation boundaries
                    const regex = new RegExp(`(^|[\\s\\p{P}])${this.escapeRegex(searchKeyword)}([\\s\\p{P}]|$)`, this.caseSensitive ? 'gu' : 'giu');
                    if (regex.test(searchText)) {
                        detectedKeywords.push({ keyword, type: 'global', matchType: 'exact' });
                    }
                }
            } else {
                // Simple substring matching
                if (searchText.includes(searchKeyword)) {
                    detectedKeywords.push({ keyword, type: 'global', matchType: 'exact' });
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
                                detectedKeywords.push({ keyword, type: 'personal', userId, matchType: 'exact' });
                            }
                        } else {
                            const regex = new RegExp(`(^|[\\s\\p{P}])${this.escapeRegex(searchKeyword)}([\\s\\p{P}]|$)`, this.caseSensitive ? 'gu' : 'giu');
                            if (regex.test(searchText)) {
                                detectedKeywords.push({ keyword, type: 'personal', userId, matchType: 'exact' });
                            }
                        }
                    } else {
                        if (searchText.includes(searchKeyword)) {
                            detectedKeywords.push({ keyword, type: 'personal', userId, matchType: 'exact' });
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

    // Text normalization for fuzzy matching
    normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .toLowerCase()                    // Convert to lowercase
            .replace(/[^\w\s\u0590-\u05FF\u0400-\u04FF]/g, '')  // Remove punctuation, keep Hebrew/Russian letters
            .replace(/[_\-\+]/g, '')          // Remove underscores, hyphens, plus
            .replace(/\s+/g, ' ')              // Normalize whitespace
            .trim();                          // Remove leading/trailing spaces
    }

    // Tokenize text into words
    tokenizeText(text) {
        const normalized = this.normalizeText(text);
        return normalized.split(/\s+/).filter(token => token.length > 0);
    }

    // Get fuzzy matching threshold based on word length
    getFuzzyThreshold(wordLength) {
        if (wordLength < 5) return this.fuzzyThreshold.short;
        if (wordLength <= 8) return this.fuzzyThreshold.medium;
        return this.fuzzyThreshold.long;
    }

    // Check if a word matches a keyword using enhanced fuzzy matching
    fuzzyMatch(word, keyword) {
        if (!this.fuzzyMatching) return false;
        
        const wordLength = word.length;
        const keywordLength = keyword.length;
        
        // Method 1: Direct Levenshtein distance (for similar length words)
        if (this.isDirectFuzzyMatch(word, keyword)) {
            return true;
        }
        
        // Method 2: Substring matching with fuzzy tolerance (for words with prefixes/suffixes)
        if (this.isSubstringFuzzyMatch(word, keyword)) {
            return true;
        }
        
        return false;
    }
    
    // Direct fuzzy matching using Levenshtein distance
    isDirectFuzzyMatch(word, keyword) {
        const wordLength = word.length;
        const keywordLength = keyword.length;
        
        // Skip if lengths are too different (more than threshold)
        const maxLengthDiff = this.getFuzzyThreshold(keywordLength);
        if (Math.abs(wordLength - keywordLength) > maxLengthDiff) {
            return false;
        }
        
        const distance = levenshtein.get(word, keyword);
        const threshold = this.getFuzzyThreshold(keywordLength);
        
        // Additional check: if distance is too high relative to word length, reject
        // But allow distance = 2 for potential transpositions
        if (distance > threshold && distance !== 2) {
            return false;
        }
        
        // Additional check: reject if distance is more than 50% of the shorter word length
        const shorterLength = Math.min(wordLength, keywordLength);
        if (distance > Math.floor(shorterLength * 0.5)) {
            return false;
        }
        
        // Additional check: for short words, be extra conservative
        if (shorterLength <= 4 && distance > 0) {
            // Only allow 1 character difference for very short words, OR transpositions (distance = 2)
            if (distance > 1 && distance !== 2) {
                return false;
            }
            
            // Additional check: reject common word variations that shouldn't match
            const commonVariations = {
                'cake': ['cakes', 'make', 'take', 'wake'], // Removed 'bake' to allow it
                'help': ['held', 'hell', 'heel'],
                'list': ['last', 'lost', 'lift'],
                'urgent': ['argent', 'regent'],
                'asap': ['asap', 'asap!', 'asap?']
            };
            
            if (commonVariations[keyword] && commonVariations[keyword].includes(word)) {
                return false;
            }
        }
        
        // Special case: allow transposition for short words (distance = 1 or 2)
        if ((distance === 1 || distance === 2) && wordLength === keywordLength) {
            // Check if it's a transposition (swapped adjacent characters)
            let transpositionCount = 0;
            for (let i = 0; i < wordLength - 1; i++) {
                if (word[i] === keyword[i + 1] && word[i + 1] === keyword[i]) {
                    transpositionCount++;
                }
            }
            // Allow if it's a single transposition
            if (transpositionCount === 1) {
                return true;
            }
        }
        
        // Additional check: for distance = 1, allow if it's a single character substitution
        if (distance === 1) {
            let diffCount = 0;
            for (let i = 0; i < Math.min(wordLength, keywordLength); i++) {
                if (word[i] !== keyword[i]) {
                    diffCount++;
                }
            }
            // Allow if only one character is different
            if (diffCount === 1) {
                return true;
            }
        }
        
        return true;
    }
    
    // Substring fuzzy matching for words with prefixes/suffixes
    isSubstringFuzzyMatch(word, keyword) {
        const wordLength = word.length;
        const keywordLength = keyword.length;
        
        // Only apply substring matching if word is reasonably longer than keyword
        // But not too long (prevent false positives with very long words)
        if (wordLength <= keywordLength + 1 || wordLength > keywordLength + 2) {
            return false;
        }
        
        // Check if keyword is contained in word (exact substring)
        if (word.includes(keyword)) {
            return true;
        }
        
        // Disable fuzzy substring matching for now to prevent false positives
        return false;
    }
    
    // Find fuzzy substring matches within the word
    findFuzzySubstring(word, keyword) {
        const keywordLength = keyword.length;
        const maxPrefixSuffix = Math.min(1, Math.floor(keywordLength * 0.2)); // Very restrictive: max 1 char or 20% of keyword length
        
        // Check all possible substrings of the word
        for (let i = 0; i <= word.length - keywordLength; i++) {
            const substring = word.substring(i, i + keywordLength);
            const distance = levenshtein.get(substring, keyword);
            
            // Allow fuzzy match if distance is within threshold
            if (distance <= this.getFuzzyThreshold(keywordLength)) {
                // Additional validation: check if prefix/suffix are reasonable
                const prefix = word.substring(0, i);
                const suffix = word.substring(i + keywordLength);
                
                // Allow reasonable prefixes/suffixes (numbers, single chars, common separators)
                if (this.isReasonablePrefixSuffix(prefix) && this.isReasonablePrefixSuffix(suffix)) {
                    // Additional check: total prefix + suffix should not exceed max
                    if (prefix.length + suffix.length <= maxPrefixSuffix) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    // Check if prefix/suffix is reasonable (not too long, contains valid characters)
    isReasonablePrefixSuffix(text) {
        if (!text) return true;
        
        // Allow up to 3 characters for prefix/suffix
        if (text.length > 3) return false;
        
        // Allow numbers, single letters, common separators
        const validPattern = /^[a-zA-Z0-9_\-+]*$/;
        return validPattern.test(text);
    }

    // Enhanced keyword detection with fuzzy matching
    detectKeywordsWithFuzzy(messageText, groupName = null) {
        if (!this.enabled || !messageText || typeof messageText !== 'string') {
            return [];
        }

        const detectedKeywords = [];
        const tokens = this.tokenizeText(messageText);
        
        // Check global keywords
        for (const keyword of this.keywords) {
            const normalizedKeyword = this.normalizeText(keyword);
            
            for (const token of tokens) {
                // Exact match first
                if (token === normalizedKeyword) {
                    detectedKeywords.push({ keyword, type: 'global', matchType: 'exact' });
                    break;
                }
                
                // Fuzzy match
                if (this.fuzzyMatch(token, normalizedKeyword)) {
                    detectedKeywords.push({ keyword, type: 'global', matchType: 'fuzzy', token });
                    break;
                }
            }
        }

        // Check personal keywords ONLY for users subscribed to this specific group
        if (groupName) {
            const groupSubscribers = this.getGroupSubscribers(groupName);
            for (const userId of groupSubscribers) {
                const personalKeywords = this.getPersonalKeywords(userId);
                for (const keyword of personalKeywords) {
                    const normalizedKeyword = this.normalizeText(keyword);
                    
                    for (const token of tokens) {
                        // Exact match first
                        if (token === normalizedKeyword) {
                            detectedKeywords.push({ keyword, type: 'personal', userId, matchType: 'exact' });
                            break;
                        }
                        
                        // Fuzzy match
                        if (this.fuzzyMatch(token, normalizedKeyword)) {
                            detectedKeywords.push({ keyword, type: 'personal', userId, matchType: 'fuzzy', token });
                            break;
                        }
                    }
                }
            }
        }

        return detectedKeywords;
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
                enabled: this.enabled,
                fuzzyMatching: this.fuzzyMatching,
                fuzzyThreshold: this.fuzzyThreshold
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
