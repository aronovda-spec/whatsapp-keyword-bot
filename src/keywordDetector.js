const fs = require('fs');
const path = require('path');
const levenshtein = require('fast-levenshtein');
const damerauLevenshtein = require('damerau-levenshtein');
const natural = require('natural');

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
        
        // Enhanced processing options
        this.normalizeDiacritics = true;
        this.removeStopWords = true;
        this.handlePlurals = true;
            this.handleLeetspeak = true;
            this.removeEmojis = true;
            this.multiWordKeywords = true;
            this.expandAbbreviations = true;
        
        // Stop words for filtering
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        ]);
        
            // Leetspeak substitutions (but preserve numbers for emergency codes and word boundaries)
            this.leetspeakMap = {
                '@': 'a', '4': 'a', '0': 'o', '5': 's', '7': 't', '8': 'b',
                '$': 's', '#': 'h'
                // Note: '1', '2', '3', '6', '9' removed to preserve numbers and emergency codes
            };
            
            // Common abbreviations/synonyms mapping
            this.abbreviationMap = {
                // Birthday related
                'bday': 'birthday',
                'b-day': 'birthday',
                'bd': 'birthday',
                
                // Message related
                'msg': 'message',
                'msgs': 'messages',
                
                // Meeting related
                'mtg': 'meeting',
                'mtgs': 'meetings',
                'meet': 'meeting',
                
                // Event related
                'evt': 'event',
                'evts': 'events',
                
                // Help related
                'hlp': 'help',
                'supp': 'support',
                
                // Urgent related
                'urg': 'urgent',
                'asap': 'as soon as possible',
                'stat': 'immediately',
                
                // List related
                'lst': 'list',
                'chklst': 'checklist',
                
                // Emergency related
                'emrg': 'emergency',
                'emrgncy': 'emergency',
                '911': 'emergency',
                
                // Important related
                'imp': 'important',
                'impnt': 'important',
                
                // Deadline related
                'ddl': 'deadline',
                'due': 'deadline',
                
                // Party related
                'pty': 'party',
                'celeb': 'celebration',
                
                // Food related
                'snax': 'snacks',
                'app': 'appetizer',
                'apps': 'appetizers',
                
                // Time related
                'tmrw': 'tomorrow',
                'tmw': 'tomorrow',
                'wknd': 'weekend',
                'wk': 'week',
                'hr': 'hour',
                'min': 'minute',
                'sec': 'second',
                
                // Location related
                'loc': 'location',
                'addr': 'address',
                'dir': 'directions',
                
                // Common internet slang
                'lol': 'laugh out loud',
                'omg': 'oh my god',
                'wtf': 'what the f',
                'btw': 'by the way',
                'fyi': 'for your information',
                'tbh': 'to be honest',
                'imo': 'in my opinion',
                'imho': 'in my humble opinion',
                'idk': 'i do not know',
                'idc': 'i do not care',
                'irl': 'in real life',
                'f2f': 'face to face',
                'irl': 'in real life'
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
            
            // Load enhanced processing options
            this.normalizeDiacritics = config.normalizeDiacritics !== undefined ? config.normalizeDiacritics : true;
            this.removeStopWords = config.removeStopWords !== undefined ? config.removeStopWords : true;
            this.handlePlurals = config.handlePlurals !== undefined ? config.handlePlurals : true;
            this.handleLeetspeak = config.handleLeetspeak !== undefined ? config.handleLeetspeak : true;
            this.removeEmojis = config.removeEmojis !== undefined ? config.removeEmojis : true;
            this.multiWordKeywords = config.multiWordKeywords !== undefined ? config.multiWordKeywords : true;
            this.expandAbbreviations = config.expandAbbreviations !== undefined ? config.expandAbbreviations : true;
            
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

    // Enhanced text normalization for fuzzy matching
    normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        let normalized = text;
        
        // 1. Remove emojis and symbols
        if (this.removeEmojis) {
            normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
        }
        
        // 2. Normalize diacritics/accents
        if (this.normalizeDiacritics) {
            normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        
        // 3. Convert to lowercase
        normalized = normalized.toLowerCase();
        
        // 4. Handle separators - convert them to spaces to preserve word boundaries
        normalized = normalized.replace(/[_\-\+]/g, ' ');
        
        // 5. Handle leetspeak substitutions (after separator handling)
        if (this.handleLeetspeak) {
            for (const [leet, normal] of Object.entries(this.leetspeakMap)) {
                // Escape special regex characters
                const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
            }
        }
        
        // 6. Remove punctuation, keep letters, numbers, and Unicode letters
        normalized = normalized.replace(/[^\w\s\u0590-\u05FF\u0400-\u04FF\u0600-\u06FF]/g, '');
        
        // 7. Expand abbreviations/synonyms
        if (this.expandAbbreviations && this.abbreviationMap) {
            const words = normalized.split(/\s+/);
            const expandedWords = words.map(word => {
                const lowerWord = word.toLowerCase();
                const expansion = this.abbreviationMap[lowerWord];
                if (expansion) {
                    // For multi-word expansions, we need to handle them specially
                    // to avoid stop word filtering issues
                    return expansion;
                }
                return word;
            });
            normalized = expandedWords.join(' ');
        }
        
        // 8. Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        return normalized;
    }

    // Enhanced tokenization with stop word filtering and plural handling
    tokenizeText(text) {
        const normalized = this.normalizeText(text);
        let tokens = normalized.split(/\s+/).filter(token => token.length > 0);
        
        // Remove stop words if enabled
        if (this.removeStopWords) {
            tokens = tokens.filter(token => !this.stopWords.has(token));
        }
        
        // Handle plurals if enabled (but don't modify tokens for fuzzy matching)
        // Plurals are handled during keyword comparison, not tokenization
        
        return tokens;
    }
    
    // Handle plural/singular forms
    handlePlural(word) {
        if (word.length <= 3) return word; // Don't modify very short words
        
        // Simple English plural handling
        if (word.endsWith('ies') && word.length > 4) {
            return word.slice(0, -3) + 'y'; // parties -> party
        }
        if (word.endsWith('es') && word.length > 3) {
            const base = word.slice(0, -2);
            if (base.endsWith('s') || base.endsWith('sh') || base.endsWith('ch') || base.endsWith('x') || base.endsWith('z')) {
                return base; // boxes -> box, dishes -> dish
            }
        }
        if (word.endsWith('s') && word.length > 2) {
            return word.slice(0, -1); // cakes -> cake
        }
        
        return word;
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
        
        // Handle plurals if enabled
        if (this.handlePlurals) {
            const singularWord = this.handlePlural(word);
            const singularKeyword = this.handlePlural(keyword);
            
            // Check if singular forms match exactly
            if (singularWord === singularKeyword) {
                return true;
            }
            
            // Use singular forms for fuzzy matching
            return this.performFuzzyMatch(singularWord, singularKeyword);
        }
        
        return this.performFuzzyMatch(word, keyword);
    }
    
    // Perform the actual fuzzy matching logic
    performFuzzyMatch(word, keyword) {
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
        
        // Method 3: Handle numbers appended to words (e.g., "urgent123" → "urgent")
        if (this.isNumberAppendedMatch(word, keyword)) {
            return true;
        }
        
        return false;
    }
    
    // Check if word has numbers appended to keyword
    isNumberAppendedMatch(word, keyword) {
        // Check if word starts with keyword followed by numbers
        const numberAppendedRegex = new RegExp(`^${keyword}\\d+$`);
        if (numberAppendedRegex.test(word)) {
            return true;
        }
        
        // Check if word starts with keyword followed by numbers and other characters
        const numberAndMoreRegex = new RegExp(`^${keyword}\\d+.*$`);
        if (numberAndMoreRegex.test(word)) {
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
        const damerauDistance = damerauLevenshtein(word, keyword).steps;
        const threshold = this.getFuzzyThreshold(keywordLength);
        
        // Use the better (lower) distance for matching
        const bestDistance = Math.min(distance, damerauDistance);
        
        // Additional check: if distance is too high relative to word length, reject
        // But allow distance = 2 for potential transpositions
        if (bestDistance > threshold && bestDistance !== 2) {
            return false;
        }
        
        // Additional check: reject if distance is more than 50% of the shorter word length
        const shorterLength = Math.min(wordLength, keywordLength);
        if (bestDistance > Math.floor(shorterLength * 0.5)) {
            return false;
        }
        
        // Additional check: for short words, be extra conservative
        if (shorterLength <= 4 && bestDistance > 0) {
            // Only allow 1 character difference for very short words, OR transpositions (distance = 2)
            if (bestDistance > 1 && bestDistance !== 2) {
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
        if ((bestDistance === 1 || bestDistance === 2) && wordLength === keywordLength) {
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
        if (bestDistance === 1) {
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
            
            // Check if it's a multi-word keyword
            if (this.multiWordKeywords && normalizedKeyword.includes(' ')) {
                const keywordTokens = normalizedKeyword.split(/\s+/);
                
                // Check for phrase matches
                for (let i = 0; i <= tokens.length - keywordTokens.length; i++) {
                    const phraseTokens = tokens.slice(i, i + keywordTokens.length);
                    
                    // Check if all tokens in phrase match (exact or fuzzy)
                    let phraseMatch = true;
                    let matchType = 'exact';
                    let matchedTokens = [];
                    
                    for (let j = 0; j < keywordTokens.length; j++) {
                        if (phraseTokens[j] === keywordTokens[j]) {
                            matchedTokens.push(phraseTokens[j]);
                        } else if (this.fuzzyMatch(phraseTokens[j], keywordTokens[j])) {
                            matchType = 'fuzzy';
                            matchedTokens.push(phraseTokens[j]);
                        } else {
                            phraseMatch = false;
                            break;
                        }
                    }
                    
                    if (phraseMatch) {
                        detectedKeywords.push({ 
                            keyword, 
                            type: 'global', 
                            matchType, 
                            token: matchedTokens.join(' '),
                            phraseMatch: true
                        });
                        break;
                    }
                }
                
                // Also check for phrase matches with separators (e.g., "birthday-party")
                // This handles cases where separators weren't properly normalized
                const phraseWithSeparators = normalizedKeyword.replace(/\s+/g, '[\\s\\-_\\+]');
                const separatorRegex = new RegExp(phraseWithSeparators, 'i');
                
                if (separatorRegex.test(messageText)) {
                    detectedKeywords.push({ 
                        keyword, 
                        type: 'global', 
                        matchType: 'exact',
                        token: normalizedKeyword,
                        phraseMatch: true,
                        separatorMatch: true
                    });
                }
                
                // Special handling for multi-word expansions (e.g., "btw" → "by the way")
                // Check if the original message contains the abbreviation that expands to this keyword
                const originalMessageLower = messageText.toLowerCase();
                for (const [abbrev, expansion] of Object.entries(this.abbreviationMap)) {
                    if (expansion === normalizedKeyword && originalMessageLower.includes(abbrev)) {
                        detectedKeywords.push({ 
                            keyword, 
                            type: 'global', 
                            matchType: 'abbreviation',
                            token: abbrev,
                            phraseMatch: true,
                            abbreviationMatch: true
                        });
                        break;
                    }
                }
            } else {
                // Single word keyword matching
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
