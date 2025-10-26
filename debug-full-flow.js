/**
 * Full tokenization flow for helloשלום
 */
const KeywordDetector = require('./src/keywordDetector');

const detector = new KeywordDetector();

const test = 'helloשלום';
console.log('Testing full tokenization flow:', test);

// Step by step
const normalized = detector.normalizeText(test);
console.log('1. After normalizeText:', normalized);

const tokens1 = normalized.split(/\s+/).filter(token => token.length > 0);
console.log('2. After split:', tokens1);

const tokens2 = detector.splitMixedLanguageTokens(tokens1);
console.log('3. After splitMixedLanguageTokens:', tokens2);

const final = detector.tokenizeText(test);
console.log('4. Final tokens:', final);
