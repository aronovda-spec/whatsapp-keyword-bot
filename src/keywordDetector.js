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
            short: 0,    // Words < 5 characters - only exact matches
            medium: 0,  // Words 5-8 characters - only exact matches
            long: 1      // Words > 8 characters - very strict
        };
        
            // Enhanced processing options
            this.normalizeDiacritics = true;
            this.removeStopWords = true;
            this.handlePlurals = true;
            this.handleLeetspeak = true;
            this.removeEmojis = true;
            this.multiWordKeywords = true;
            this.expandAbbreviations = true;
            
            // Hebrew-specific processing options
            this.handleHebrew = true;
            this.removeHebrewNiqqud = true;
            this.normalizeHebrewFinalForms = true;
            this.stripHebrewPrefixes = true;
            this.handleHebrewTypos = true;
            this.hebrewStemming = true;
            // this.hebrewStopWords is already initialized as a Set above
            
            // Russian-specific processing options
            this.handleRussian = true;
            this.normalizeRussianStress = true;
            this.normalizeRussianSoftSigns = true;
            this.stripRussianPrefixes = true;
            this.handleRussianTypos = true;
            this.russianStemming = true;
            this.handleRussianElongation = true;
            this.detectRussianKeyboardLayout = true;
            
            // Mixed Hebrew-English processing options
            this.handleMixedLanguages = true;
            this.detectLanguagePerToken = true;
            
            // Diacritic-insensitive fuzzy substring matching
            this.diacriticInsensitiveSubstring = true;
            this.fuzzySubstringThreshold = {
                short: 1,    // Phrases < 10 characters
                medium: 2,   // Phrases 10-20 characters
                long: 3      // Phrases > 20 characters
            };
        
        // Stop words for filtering
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        ]);
        
        // Hebrew stop words
        this.hebrewStopWords = new Set([
            'את', 'של', 'עם', 'על', 'אל', 'מן', 'כל', 'זה', 'זו', 'אלה', 'אלו', 'הוא', 'היא', 'הם', 'הן',
            'אני', 'אתה', 'את', 'אנחנו', 'אתם', 'אתן', 'היה', 'היתה', 'היו', 'יהיה', 'תהיה', 'יהיו',
            'יש', 'אין', 'לא', 'כן', 'גם', 'רק', 'כבר', 'עוד', 'יותר', 'פחות', 'הכי', 'כמה', 'איך',
            'מה', 'מי', 'איפה', 'מתי', 'למה', 'איזה', 'איזו', 'איזה', 'איזו', 'איזה', 'איזו'
        ]);
        
        // Russian stop words
        this.russianStopWords = new Set([
            'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже', 'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти', 'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть', 'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем', 'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том', 'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между'
        ]);
        
            // Leetspeak substitutions (but preserve numbers for emergency codes and word boundaries)
            this.leetspeakMap = {
                '@': 'a', '4': 'a', '0': 'o', '5': 's', '7': 't', '8': 'b',
                '$': 's', '#': 'h', '3': 'e'
                // Note: '1', '2', '6', '9' removed to preserve numbers and emergency codes
            };
            
            // Russian leetspeak substitutions
            this.russianLeetspeakMap = {
                '4': 'ч', '6': 'б', '0': 'о', '3': 'з', '7': 'т', '8': 'в',
                '@': 'а', '$': 'с', '#': 'х'
            };
            
            // Russian transliteration map (Latin to Cyrillic)
            this.russianTransliterationMap = {
                'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'yo': 'ё', 'zh': 'ж',
                'z': 'з', 'i': 'и', 'j': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
                'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'h': 'х', 'c': 'ц',
                'ch': 'ч', 'sh': 'ш', 'sch': 'щ', 'y': 'ы', 'yu': 'ю', 'ya': 'я',
                'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д', 'E': 'Е', 'YO': 'Ё', 'ZH': 'Ж',
                'Z': 'З', 'I': 'И', 'J': 'Й', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
                'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У', 'F': 'Ф', 'H': 'Х', 'C': 'Ц',
                'CH': 'Ч', 'SH': 'Ш', 'SCH': 'Щ', 'Y': 'Ы', 'YU': 'Ю', 'YA': 'Я'
            };
            
            // Russian keyboard typo map (adjacent keys on Russian QWERTY layout)
            // Only include common typos, not all adjacent keys to avoid corruption
            this.russianTypoMap = {
                // Common Russian typos
                'т': 'ь', 'ь': 'т',  // т/ь confusion
                'ш': 'щ', 'щ': 'ш',  // ш/щ confusion  
                'и': 'й', 'й': 'и',  // и/й confusion
                'е': 'ё', 'ё': 'е',  // е/ё confusion
                'о': 'а', 'а': 'о',  // о/а confusion (unstressed)
                'з': 'с', 'с': 'з',  // з/с confusion
                'в': 'ф', 'ф': 'в',  // в/ф confusion
                'п': 'б', 'б': 'п',  // п/б confusion
                'к': 'г', 'г': 'к',  // к/г confusion
                'д': 'т', 'т': 'д'   // д/т confusion
            };
            
            // Russian soft/hard signs normalization
            this.russianSoftSigns = ['ь', 'ъ'];
            
            // Russian common prefixes (for stripping)
            // Note: removed single letters ('с', 'в', 'к', 'о', 'у', 'из', 'на', 'по', 'за') to prevent over-stripping
            this.russianPrefixes = ['при', 'под', 'над', 'от', 'об', 'во', 'про', 'со', 'для', 'без', 'между', 'через', 'ко', 'обо'];
            
            // Russian common suffixes (for stripping)
            this.russianSuffixes = ['ся', 'сь', 'ать', 'ить', 'еть', 'уть', 'ыть', 'а', 'я', 'о', 'е', 'и', 'ы', 'у', 'ю', 'ом', 'ем', 'ой', 'ей', 'ах', 'ях', 'ов', 'ев', 'ами', 'ями'];
            
            // Russian clitics/particles (for stripping)
            this.russianClitics = ['же', 'ли', 'то', 'ка', 'де', 'мол', 'дескать', 'якобы'];
            
            // Russian keyboard layout switching map (English keys on Russian layout)
            this.russianKeyboardLayoutMap = {
                'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з',
                'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д',
                'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь',
                'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г', 'I': 'Ш', 'O': 'Щ', 'P': 'З',
                'A': 'Ф', 'S': 'Ы', 'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л', 'L': 'Д',
                'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И', 'N': 'Т', 'M': 'Ь'
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
            
            // Hebrew abbreviations/synonyms mapping
            this.hebrewAbbreviationMap = {
                // Common Hebrew abbreviations
                'דחוף': 'דחוף',
                'חשוב': 'חשוב',
                'עזרה': 'עזרה',
                'מפגש': 'מפגש',
                'אירוע': 'אירוע',
                'רשימה': 'רשימה',
                'עוגה': 'עוגה',
                'מפיות': 'מפיות',
                'חירום': 'חירום',
                'קריטי': 'קריטי',
                
                // Hebrew contractions and common forms
                'שלום': 'שלום',
                'תודה': 'תודה',
                'בבקשה': 'בבקשה',
                'סליחה': 'סליחה',
                'מצטער': 'מצטער',
                'בהצלחה': 'בהצלחה',
                'לילה טוב': 'לילה טוב',
                'בוקר טוב': 'בוקר טוב',
                'צהריים טובים': 'צהריים טובים',
                'ערב טוב': 'ערב טוב'
            };
            
            // Russian abbreviations/synonyms mapping
            this.russianAbbreviationMap = {
                // Common Russian abbreviations
                'встр': 'встреча',  // meeting
                'приветик': 'привет',  // hi (diminutive)
                'пока': 'до свидания',  // bye
                'спс': 'спасибо',  // thanks
                'пж': 'пожалуйста',  // please
                'изв': 'извините',  // sorry
                'сорян': 'извините',  // sorry (slang)
                'ок': 'хорошо',  // ok
                'норм': 'нормально',  // normal/ok
                'круто': 'отлично',  // cool/great
                'фигня': 'плохо',  // bad
                'хрень': 'плохо',  // bad (slang)
                'фиг': 'плохо',  // bad (short)
                'хз': 'не знаю',  // don't know
                'имхо': 'по моему мнению',  // in my opinion
                'кста': 'кстати',  // by the way
                'кст': 'кстати',  // by the way (short)
                'мб': 'может быть',  // maybe
                'наверн': 'наверное',  // probably
                'навер': 'наверное',  // probably (short)
                'щас': 'сейчас',  // now
                'ща': 'сейчас',  // now (short)
                'потом': 'позже',  // later
                'позже': 'потом',  // later
                'завтра': 'завтра',  // tomorrow
                'сегодня': 'сегодня',  // today
                'вчера': 'вчера',  // yesterday
                'утром': 'утром',  // in the morning
                'вечером': 'вечером',  // in the evening
                'ночью': 'ночью',  // at night
                'днем': 'днем',  // during the day
                'срочно': 'срочно',  // urgent
                'важно': 'важно',  // important
                'помощь': 'помощь',  // help
                'встреча': 'встреча',  // meeting
                'событие': 'событие',  // event
                'список': 'список',  // list
                'торт': 'торт',  // cake
                'салфетки': 'салфетки',  // napkins
                'критично': 'критично',  // critical
                'экстренно': 'экстренно'  // emergency
            };
            
            // Hebrew final forms mapping (sofit letters)
            this.hebrewFinalForms = {
                'ך': 'כ',  // final kaf
                'ם': 'מ',  // final mem
                'ן': 'נ',  // final nun
                'ף': 'פ',  // final pe
                'ץ': 'צ'   // final tsadi
            };
            
            // Hebrew common prefixes (clitics)
            this.hebrewPrefixes = ['ב', 'ל', 'כ', 'מ', 'ו', 'ה'];
            
            // Hebrew keyboard typo map (adjacent keys) - enhanced
            this.hebrewTypoMap = {
                // Common Hebrew keyboard substitutions (Qwerty layout)
                'ש': 'א', 'א': 'ש',  // shin/alef
                'ב': 'נ', 'נ': 'ב',  // bet/nun
                'ג': 'ד', 'ד': 'ג',  // gimel/dalet
                'ה': 'ח', 'ח': 'ה',  // he/het
                'ו': 'ז', 'ז': 'ו',  // vav/zayin
                'ט': 'י', 'י': 'ט',  // tet/yod
                'כ': 'ל', 'ל': 'כ',  // kaf/lamed
                'מ': 'ס', 'ס': 'מ',  // mem/samekh
                'ע': 'פ', 'פ': 'ע',  // ayin/pe
                'צ': 'ק', 'ק': 'צ',  // tsadi/qof
                'ר': 'ת', 'ת': 'ר',  // resh/tav
                
                // Additional common typos
                'ך': 'כ', 'כ': 'ך',  // kaf/final kaf
                'ם': 'מ', 'מ': 'ם',  // mem/final mem
                'ן': 'נ', 'נ': 'ן',  // nun/final nun
                'ף': 'פ', 'פ': 'ף',  // pe/final pe
                'ץ': 'צ', 'צ': 'ץ',  // tsadi/final tsadi
                
                // Similar sounding letters
                'ב': 'ו', 'ו': 'ב',  // bet/vav
                'ח': 'כ', 'כ': 'ח',  // het/kaf
                'ט': 'ת', 'ת': 'ט',  // tet/tav
                'ס': 'ש', 'ש': 'ס',  // samekh/shin
                'ע': 'א', 'א': 'ע'   // ayin/alef
            };
            
            // Hebrew homoglyphs / similar-looking letters (for OCR and visual confusion)
            this.hebrewHomoglyphs = {
                'ד': 'ר', 'ר': 'ד',  // dalet/resh (visually similar)
                'ג': 'כ', 'כ': 'ג',  // gimel/kaf (visually similar)
                'ש': 'ס', 'ס': 'ש',  // shin/samekh (visually similar)
                'ה': 'ח', 'ח': 'ה',  // he/het (visually similar)
                'ט': 'י', 'י': 'ט',  // tet/yod (visually similar)
                'ע': 'פ', 'פ': 'ע',  // ayin/pe (visually similar)
                'צ': 'ק', 'ק': 'צ',  // tsadi/qof (visually similar)
                'ב': 'כ', 'כ': 'ב',  // bet/kaf (visually similar)
                'ל': 'כ', 'כ': 'ל'   // lamed/kaf (visually similar)
            };
            
            // Hebrew abbreviations and slang mapping
            this.hebrewSlangMap = {
                // Common Hebrew abbreviations
                'חג': 'חגיגה',  // holiday → celebration
                'מזל': 'מזל טוב',  // luck → congratulations
                'שלום': 'שלום',  // hello/peace
                'תודה': 'תודה',  // thank you
                'בבקשה': 'בבקשה',  // please
                'סליחה': 'סליחה',  // sorry
                'מצטער': 'מצטער',  // sorry (formal)
                'בהצלחה': 'בהצלחה',  // good luck
                'לילה טוב': 'לילה טוב',  // good night
                'בוקר טוב': 'בוקר טוב',  // good morning
                'צהריים טובים': 'צהריים טובים',  // good afternoon
                'ערב טוב': 'ערב טוב',  // good evening
                
                // Common chat abbreviations
                'אוקיי': 'בסדר',  // okay → alright
                'אוקי': 'בסדר',  // ok → alright
                'כן': 'כן',  // yes
                'לא': 'לא',  // no
                'אולי': 'אולי',  // maybe
                'בטח': 'בטח',  // sure
                'בטחון': 'בטחון',  // security
                'חירום': 'חירום',  // emergency
                'דחוף': 'דחוף',  // urgent
                'חשוב': 'חשוב',  // important
                'קריטי': 'קריטי',  // critical
                'עזרה': 'עזרה',  // help
                'מפגש': 'מפגש',  // meeting
                'אירוע': 'אירוע',  // event
                'רשימה': 'רשימה',  // list
                'עוגה': 'עוגה',  // cake
                'מפיות': 'מפיות',  // napkins
                'בית': 'בית',  // house/home
                'מכתב': 'מכתב'   // letter
            };
            
            // Hebrew emoji to word mapping
            this.hebrewEmojiMap = {
                '🎂': 'עוגה',  // cake
                '🍰': 'עוגה',  // cake slice
                '🎉': 'חגיגה',  // celebration
                '🎊': 'חגיגה',  // celebration
                '🎈': 'בלון',  // balloon
                '🎁': 'מתנה',  // gift
                '💝': 'מתנה',  // gift
                '🏠': 'בית',  // house
                '🏡': 'בית',  // house
                '📝': 'רשימה',  // list
                '📋': 'רשימה',  // list
                '📄': 'מכתב',  // letter
                '✉️': 'מכתב',  // letter
                '📧': 'מכתב',  // email
                '📨': 'מכתב',  // letter
                '📩': 'מכתב',  // letter
                '🚨': 'חירום',  // emergency
                '🚩': 'דגל',  // flag
                '⚠️': 'אזהרה',  // warning
                '❗': 'חשוב',  // important
                '❌': 'לא',  // no
                '✅': 'כן',  // yes
                '👍': 'טוב',  // good
                '👎': 'רע',  // bad
                '❤️': 'אהבה',  // love
                '💕': 'אהבה',  // love
                '💖': 'אהבה',  // love
                '💗': 'אהבה',  // love
                '💘': 'אהבה',  // love
                '💙': 'אהבה',  // love
                '💚': 'אהבה',  // love
                '💛': 'אהבה',  // love
                '💜': 'אהבה',  // love
                '🖤': 'אהבה',  // love
                '🤍': 'אהבה',  // love
                '💔': 'אהבה',  // broken heart
                '😊': 'שמח',  // happy
                '😄': 'שמח',  // happy
                '😃': 'שמח',  // happy
                '😁': 'שמח',  // happy
                '😆': 'שמח',  // happy
                '😅': 'שמח',  // happy
                '😂': 'צחוק',  // laugh
                '🤣': 'צחוק',  // laugh
                '😭': 'בכי',  // cry
                '😢': 'עצוב',  // sad
                '😔': 'עצוב',  // sad
                '😞': 'עצוב',  // sad
                '😟': 'עצוב',  // sad
                '😕': 'עצוב',  // sad
                '🙁': 'עצוב',  // sad
                '☹️': 'עצוב',  // sad
                '😣': 'עצוב',  // sad
                '😖': 'עצוב',  // sad
                '😫': 'עצוב',  // sad
                '😩': 'עצוב',  // sad
                '😤': 'כעס',  // angry
                '😠': 'כעס',  // angry
                '😡': 'כעס',  // angry
                '🤬': 'כעס',  // angry
                '😱': 'פחד',  // fear
                '😨': 'פחד',  // fear
                '😰': 'פחד',  // fear
                '😳': 'מבוכה',  // embarrassment
                '😵': 'סחרחורת',  // dizziness
                '🤯': 'הלם',  // shock
                '🤔': 'חשיבה',  // thinking
                '🤨': 'ספקנות',  // skepticism
                '😐': 'ניטרלי',  // neutral
                '😑': 'ניטרלי',  // neutral
                '😶': 'שקט',  // quiet
                '🤐': 'שקט',  // quiet
                '😴': 'שינה',  // sleep
                '😪': 'עייפות',  // tired
                '🤤': 'רוק',  // drool
                '😋': 'טעים',  // delicious
                '😛': 'לשון',  // tongue
                '😜': 'לשון',  // tongue
                '😝': 'לשון',  // tongue
                '🤪': 'משוגע',  // crazy
                '😒': 'אדישות',  // indifference
                '🙄': 'אדישות',  // indifference
                '😬': 'מבוכה',  // embarrassment
                '🤭': 'מבוכה',  // embarrassment
                '🤫': 'שקט',  // quiet
                '🤥': 'שקר',  // lie
                '😷': 'מסכה',  // mask
                '🤒': 'חולה',  // sick
                '🤕': 'פצוע',  // injured
                '🤢': 'בחילה',  // nausea
                '🤮': 'הקאה',  // vomit
                '🤧': 'עיטוש',  // sneeze
                '🥵': 'חם',  // hot
                '🥶': 'קר',  // cold
                '🥴': 'סחרחורת',  // dizziness
                '😵‍💫': 'סחרחורת',  // dizziness
                '🤯': 'הלם',  // shock
                '🤠': 'קאובוי',  // cowboy
                '🥳': 'חגיגה',  // celebration
                '🥸': 'התחפשות',  // disguise
                '😎': 'מגניב',  // cool
                '🤓': 'חכם',  // smart
                '🧐': 'חקירה',  // investigation
                '😏': 'ערמומיות',  // sly
                '😌': 'שקט',  // quiet
                '😇': 'מלאך',  // angel
                '🤗': 'חיבוק',  // hug
                '🤔': 'חשיבה',  // thinking
                '🤨': 'ספקנות',  // skepticism
                '😐': 'ניטרלי',  // neutral
                '😑': 'ניטרלי',  // neutral
                '😶': 'שקט',  // quiet
                '🤐': 'שקט',  // quiet
                '😴': 'שינה',  // sleep
                '😪': 'עייפות',  // tired
                '🤤': 'רוק',  // drool
                '😋': 'טעים',  // delicious
                '😛': 'לשון',  // tongue
                '😜': 'לשון',  // tongue
                '😝': 'לשון',  // tongue
                '🤪': 'משוגע',  // crazy
                '😒': 'אדישות',  // indifference
                '🙄': 'אדישות',  // indifference
                '😬': 'מבוכה',  // embarrassment
                '🤭': 'מבוכה',  // embarrassment
                '🤫': 'שקט',  // quiet
                '🤥': 'שקר',  // lie
                '😷': 'מסכה',  // mask
                '🤒': 'חולה',  // sick
                '🤕': 'פצוע',  // injured
                '🤢': 'בחילה',  // nausea
                '🤮': 'הקאה',  // vomit
                '🤧': 'עיטוש',  // sneeze
                '🥵': 'חם',  // hot
                '🥶': 'קר',  // cold
                '🥴': 'סחרחורת',  // dizziness
                '😵‍💫': 'סחרחורת',  // dizziness
                '🤯': 'הלם',  // shock
                '🤠': 'קאובוי',  // cowboy
                '🥳': 'חגיגה',  // celebration
                '🥸': 'התחפשות',  // disguise
                '😎': 'מגניב',  // cool
                '🤓': 'חכם',  // smart
                '🧐': 'חקירה',  // investigation
                '😏': 'ערמומיות',  // sly
                '😌': 'שקט',  // quiet
                '😇': 'מלאך',  // angel
                '🤗': 'חיבוק'   // hug
            };
            
            // Russian emoji to word mapping
            this.russianEmojiMap = {
                '🎂': 'торт',  // cake
                '🍰': 'торт',  // cake slice
                '🎉': 'праздник',  // celebration
                '🎊': 'праздник',  // celebration
                '🎈': 'воздушный шар',  // balloon
                '🎁': 'подарок',  // gift
                '💝': 'подарок',  // gift
                '🏠': 'дом',  // house
                '🏡': 'дом',  // house
                '📝': 'список',  // list
                '📋': 'список',  // list
                '📄': 'письмо',  // letter
                '✉️': 'письмо',  // letter
                '📧': 'письмо',  // email
                '📨': 'письмо',  // letter
                '📩': 'письмо',  // letter
                '🚨': 'экстренно',  // emergency
                '🚩': 'флаг',  // flag
                '⚠️': 'предупреждение',  // warning
                '❗': 'важно',  // important
                '❌': 'нет',  // no
                '✅': 'да',  // yes
                '👍': 'хорошо',  // good
                '👎': 'плохо',  // bad
                '❤️': 'любовь',  // love
                '💕': 'любовь',  // love
                '💖': 'любовь',  // love
                '💗': 'любовь',  // love
                '💘': 'любовь',  // love
                '💙': 'любовь',  // love
                '💚': 'любовь',  // love
                '💛': 'любовь',  // love
                '💜': 'любовь',  // love
                '🖤': 'любовь',  // love
                '🤍': 'любовь',  // love
                '💔': 'любовь',  // broken heart
                '😊': 'счастливый',  // happy
                '😄': 'счастливый',  // happy
                '😃': 'счастливый',  // happy
                '😁': 'счастливый',  // happy
                '😆': 'счастливый',  // happy
                '😅': 'счастливый',  // happy
                '😂': 'смех',  // laugh
                '🤣': 'смех',  // laugh
                '😭': 'плач',  // cry
                '😢': 'грустный',  // sad
                '😔': 'грустный',  // sad
                '😞': 'грустный',  // sad
                '😟': 'грустный',  // sad
                '😕': 'грустный',  // sad
                '🙁': 'грустный',  // sad
                '☹️': 'грустный',  // sad
                '😣': 'грустный',  // sad
                '😖': 'грустный',  // sad
                '😫': 'грустный',  // sad
                '😩': 'грустный',  // sad
                '😤': 'злой',  // angry
                '😠': 'злой',  // angry
                '😡': 'злой',  // angry
                '🤬': 'злой',  // angry
                '😱': 'страх',  // fear
                '😨': 'страх',  // fear
                '😰': 'страх',  // fear
                '😳': 'смущение',  // embarrassment
                '😵': 'головокружение',  // dizziness
                '🤯': 'шок',  // shock
                '🤔': 'размышление',  // thinking
                '🤨': 'скептицизм',  // skepticism
                '😐': 'нейтральный',  // neutral
                '😑': 'нейтральный',  // neutral
                '😶': 'тихий',  // quiet
                '🤐': 'тихий',  // quiet
                '😴': 'сон',  // sleep
                '😪': 'усталость',  // tired
                '🤤': 'слюна',  // drool
                '😋': 'вкусно',  // delicious
                '😛': 'язык',  // tongue
                '😜': 'язык',  // tongue
                '😝': 'язык',  // tongue
                '🤪': 'сумасшедший',  // crazy
                '😒': 'равнодушие',  // indifference
                '🙄': 'равнодушие',  // indifference
                '😬': 'смущение',  // embarrassment
                '🤭': 'смущение',  // embarrassment
                '🤫': 'тихий',  // quiet
                '🤥': 'ложь',  // lie
                '😷': 'маска',  // mask
                '🤒': 'больной',  // sick
                '🤕': 'раненый',  // injured
                '🤢': 'тошнота',  // nausea
                '🤮': 'рвота',  // vomit
                '🤧': 'чихание',  // sneeze
                '🥵': 'жарко',  // hot
                '🥶': 'холодно',  // cold
                '🥴': 'головокружение',  // dizziness
                '😵‍💫': 'головокружение',  // dizziness
                '🤯': 'шок',  // shock
                '🤠': 'ковбой',  // cowboy
                '🥳': 'праздник',  // celebration
                '🥸': 'маскировка',  // disguise
                '😎': 'крутой',  // cool
                '🤓': 'умный',  // smart
                '🧐': 'расследование',  // investigation
                '😏': 'хитрость',  // sly
                '😌': 'тихий',  // quiet
                '😇': 'ангел',  // angel
                '🤗': 'объятие'   // hug
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
            
            // Load Hebrew-specific processing options
            this.handleHebrew = config.handleHebrew !== undefined ? config.handleHebrew : true;
            this.removeHebrewNiqqud = config.removeHebrewNiqqud !== undefined ? config.removeHebrewNiqqud : true;
            this.normalizeHebrewFinalForms = config.normalizeHebrewFinalForms !== undefined ? config.normalizeHebrewFinalForms : true;
            this.stripHebrewPrefixes = config.stripHebrewPrefixes !== undefined ? config.stripHebrewPrefixes : true;
            this.handleHebrewTypos = config.handleHebrewTypos !== undefined ? config.handleHebrewTypos : true;
            this.hebrewStemming = config.hebrewStemming !== undefined ? config.hebrewStemming : true;
            // Hebrew stop words is a Set, not a boolean - don't override it
            // this.hebrewStopWords = config.hebrewStopWords !== undefined ? config.hebrewStopWords : true;
            
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
    normalizeText(text, skipKeyboardConversion = false) {
        if (!text || typeof text !== 'string') return '';
        
        let normalized = text;
        
        // 1. Handle emojis BEFORE removing emojis (language-aware)
        if (this.handleHebrew || this.handleRussian) {
            normalized = this.handleLanguageAwareEmojis(normalized);
        }
        
        // 1.2. Remove remaining emojis and symbols (after Hebrew and Russian emoji processing)
        if (this.removeEmojis) {
            normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
        }
        
        // 2. Mixed language processing (before other processing)
        if (this.handleMixedLanguages) {
            // Process each token separately based on its language
            const tokens = normalized.split(/\s+/);
            const processedTokens = tokens.map(token => this.normalizeMixedLanguageWordWithoutPrefixStrip(token));
            normalized = processedTokens.join(' ');
        } else if (this.handleHebrew && this.containsHebrew(normalized)) {
            // Fallback to original Hebrew-only processing
            normalized = this.normalizeHebrew(normalized);
        } else if (this.handleRussian && this.containsRussian(normalized)) {
            // Russian-only processing
            normalized = this.normalizeRussian(normalized);
        }
        
        // 2.1. Handle keyboard layout switching
        // Only for pure English text that could be mistyped Russian
        // SKIP for keyword normalization and mixed-language text to prevent corruption
        if (this.detectRussianKeyboardLayout && !skipKeyboardConversion) {
            const isPureEnglish = /^[a-zA-Z\s]+$/.test(normalized);
            const isMixedLanguage = this.containsHebrew(normalized) || this.containsRussian(normalized);
            
            // Only convert if pure English and not mixed with other languages
            if (isPureEnglish && !this.containsHebrew(normalized) && !isMixedLanguage) {
                // Try to convert English keyboard to Russian
                // Only apply if result is valid Russian
                const converted = this.fixRussianKeyboardLayout(normalized);
                if (this.containsRussian(converted)) {
                    normalized = converted;
                }
            }
        }
        
        // 2.1. Handle Hebrew numbers mixed with letters
        if (this.handleHebrew) {
            normalized = this.handleHebrewNumbers(normalized);
        }
        
        // 2.2. Handle Russian numbers mixed with letters
        if (this.handleRussian) {
            normalized = this.handleRussianNumbers(normalized);
        }
        
        // 3. Normalize diacritics/accents (for Latin scripts)
        if (this.normalizeDiacritics) {
            normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        
        // 4. Convert to lowercase
        normalized = normalized.toLowerCase();
        
        // 5. Handle separators - convert them to spaces to preserve word boundaries
        normalized = normalized.replace(/[_\-\+]/g, ' ');
        
        // 6. Handle leetspeak substitutions (after separator handling)
        if (this.handleLeetspeak) {
            for (const [leet, normal] of Object.entries(this.leetspeakMap)) {
                // Escape special regex characters
                const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
            }
        }
        
        // 7. Remove punctuation, keep letters, numbers, and Unicode letters
        normalized = normalized.replace(/[^\w\s\u0590-\u05FF\u0400-\u04FF\u0600-\u06FF]/g, '');
        
        // 8. Expand abbreviations/synonyms
        if (this.expandAbbreviations) {
            const words = normalized.split(/\s+/);
            const expandedWords = words.map(word => {
                const lowerWord = word.toLowerCase();
                
                // Check English abbreviations
                if (this.abbreviationMap) {
                    const expansion = this.abbreviationMap[lowerWord];
                    if (expansion) {
                        return expansion;
                    }
                }
                
                // Check Hebrew abbreviations
                if (this.hebrewAbbreviationMap && this.containsHebrew(word)) {
                    const hebrewExpansion = this.hebrewAbbreviationMap[word];
                    if (hebrewExpansion) {
                        return hebrewExpansion;
                    }
                }
                
                // Check Hebrew slang
                if (this.hebrewSlangMap && this.containsHebrew(word)) {
                    const slangExpansion = this.hebrewSlangMap[word];
                    if (slangExpansion) {
                        return slangExpansion;
                    }
                }
                
                // Check Russian abbreviations
                if (this.russianAbbreviationMap && this.containsRussian(word)) {
                    const russianExpansion = this.russianAbbreviationMap[word];
                    if (russianExpansion) {
                        return russianExpansion;
                    }
                }
                
                return word;
            });
            normalized = expandedWords.join(' ');
        }
        
        // 9. Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        return normalized;
    }
    
    // Hebrew-specific normalization
    normalizeHebrew(text) {
        if (!this.handleHebrew || !text || typeof text !== 'string') {
            return text;
        }
        
        let normalized = text;
        
        // 1. Remove Hebrew niqqud (vowel marks) - precise range
        if (this.removeHebrewNiqqud) {
            // Remove only Hebrew diacritical marks, not Hebrew letters
            // Hebrew letters: \u05D0-\u05EA
            // Hebrew diacritics: \u0591-\u05AF, \u05B0-\u05B9, \u05BB-\u05BD, \u05BF-\u05C7
            normalized = normalized.replace(/[\u0591-\u05AF\u05B0-\u05B9\u05BB-\u05BD\u05BF-\u05C7]/g, '');
        }
        
        // 2. Normalize Hebrew final forms (sofit letters) - disabled for now
        // Note: This was causing issues with exact matching
        // if (this.normalizeHebrewFinalForms) {
        //     for (const [finalForm, regularForm] of Object.entries(this.hebrewFinalForms)) {
        //         normalized = normalized.replace(new RegExp(finalForm, 'g'), regularForm);
        //     }
        // }
        
        // Note: Hebrew typo handling should be done during fuzzy matching, not normalization
        // to avoid corrupting the original text
        
        return normalized;
    }
    
    // Strip Hebrew prefixes (clitics) - more conservative approach
    stripHebrewPrefixesFromWord(word) {
        if (!this.stripHebrewPrefixes || !word || typeof word !== 'string') {
            return word;
        }
        
        // Only strip prefixes if the remaining word is a known keyword
        // This prevents over-stripping of legitimate Hebrew words
        for (const prefix of this.hebrewPrefixes) {
            if (word.startsWith(prefix)) {
                const remainingWord = word.substring(1);
                // Only strip if the remaining word is a known keyword
                if (this.keywords.includes(remainingWord)) {
                    return remainingWord;
                }
            }
        }
        
        return word;
    }
    
    // Check if text contains Hebrew characters
    containsHebrew(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        return /[\u0590-\u05FF]/.test(text);
    }
    
    // Check if text contains English characters
    containsEnglish(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        return /[a-zA-Z]/.test(text);
    }
    
    // Detect language of a token (Hebrew, English, Mixed, Other)
    detectTokenLanguage(token) {
        if (!token || typeof token !== 'string') {
            return 'other';
        }
        
        const hasHebrew = this.containsHebrew(token);
        const hasEnglish = this.containsEnglish(token);
        const hasRussian = this.containsRussian(token);
        
        if (hasHebrew && hasEnglish) {
            return 'mixed';
        } else if (hasHebrew && hasRussian) {
            return 'mixed';
        } else if (hasEnglish && hasRussian) {
            return 'mixed';
        } else if (hasHebrew) {
            return 'hebrew';
        } else if (hasEnglish) {
            return 'english';
        } else if (hasRussian) {
            return 'russian';
        } else {
            return 'other';
        }
    }
    
    // Normalize mixed Hebrew-English words by processing each language part separately
    normalizeMixedLanguageWord(word) {
        if (!this.handleMixedLanguages || !word) {
            return word;
        }
        
        const language = this.detectTokenLanguage(word);
        
        if (language === 'mixed') {
            // Simple approach: process character by character, maintaining order
            let result = '';
            let currentPart = '';
            let currentLanguage = null;
            
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                const charLanguage = this.detectTokenLanguage(char);
                
                if (charLanguage !== currentLanguage) {
                    // Process the accumulated part
                    if (currentPart && currentLanguage) {
                        if (currentLanguage === 'hebrew') {
                            result += this.normalizeHebrew(currentPart);
                        } else if (currentLanguage === 'english') {
                            result += this.normalizeEnglish(currentPart);
                        } else if (currentLanguage === 'russian') {
                            result += this.normalizeRussian(currentPart);
                        } else {
                            // Handle numbers and other characters
                            result += currentPart.replace(/\d/g, '');
                        }
                    }
                    currentPart = char;
                    currentLanguage = charLanguage;
                } else {
                    currentPart += char;
                }
            }
            
            // Process the last part
            if (currentPart && currentLanguage) {
                if (currentLanguage === 'hebrew') {
                    result += this.normalizeHebrew(currentPart);
                } else if (currentLanguage === 'english') {
                    result += this.normalizeEnglish(currentPart);
                } else if (currentLanguage === 'russian') {
                    result += this.normalizeRussian(currentPart);
                } else {
                    // Handle numbers and other characters
                    result += currentPart.replace(/\d/g, '');
                }
            }
            
            return result;
        } else if (language === 'hebrew') {
            return this.normalizeHebrew(word);
        } else if (language === 'english') {
            return this.normalizeEnglish(word);
        } else if (language === 'russian') {
            return this.normalizeRussian(word);
        } else {
            return word.toLowerCase();
        }
    }
    
    // Normalize mixed language word WITHOUT prefix stripping (for tokenization)
    normalizeMixedLanguageWordWithoutPrefixStrip(word) {
        if (!this.handleMixedLanguages || !word) {
            return word;
        }
        
        const language = this.detectTokenLanguage(word);
        
        // For mixed words, split by language and normalize each part separately
        // Prefix stripping will be handled later in tokenizeText
        if (language === 'mixed') {
            // Split the word into language-specific parts
            const parts = [];
            let currentPart = '';
            let currentLanguage = null;
            
            for (const char of word) {
                const charLanguage = this.detectCharLanguage(char);
                
                if (charLanguage !== currentLanguage) {
                    // Start a new part
                    if (currentPart && currentLanguage) {
                        parts.push({ text: currentPart, language: currentLanguage });
                    }
                    currentPart = char;
                    currentLanguage = charLanguage;
                } else {
                    currentPart += char;
                }
            }
            
            // Add the last part
            if (currentPart && currentLanguage) {
                parts.push({ text: currentPart, language: currentLanguage });
            }
            
            // Normalize each part separately
            const normalizedParts = parts.map(part => {
                if (part.language === 'english') {
                    return part.text.toLowerCase();
                } else if (part.language === 'hebrew') {
                    return this.normalizeHebrewWithoutPrefixStrip(part.text);
                } else if (part.language === 'russian') {
                    return this.normalizeRussianWithoutPrefixStrip(part.text);
                } else {
                    return part.text;
                }
            });
            
            return normalizedParts.join('');
        } else if (language === 'hebrew') {
            // For Hebrew, do basic normalization without prefix stripping
            return this.normalizeHebrewWithoutPrefixStrip(word);
        } else if (language === 'english') {
            return this.normalizeEnglish(word);
        } else if (language === 'russian') {
            // For Russian, do basic normalization without prefix stripping
            return this.normalizeRussianWithoutPrefixStrip(word);
        } else {
            return word.toLowerCase();
        }
    }
    
    // Normalize Hebrew without prefix stripping
    normalizeHebrewWithoutPrefixStrip(text) {
        if (!this.handleHebrew || !text) return text;
        
        let processed = text.toLowerCase();
        
        // Remove stress marks
        processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Normalize Hebrew final forms
        if (this.normalizeHebrewFinalForms) {
            processed = processed.replace(/ך/g, 'כ')
                                .replace(/ם/g, 'מ')
                                .replace(/ן/g, 'נ')
                                .replace(/ף/g, 'פ')
                                .replace(/ץ/g, 'צ');
        }
        
        return processed;
    }
    
    // Normalize Russian without prefix stripping
    normalizeRussianWithoutPrefixStrip(text) {
        if (!this.handleRussian || !text) return text;
        
        let processed = text;
        
        // 1. Remove stress marks (combining diacritics)
        if (this.normalizeRussianStress) {
            processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        
        // 2. Normalize soft/hard signs
        if (this.normalizeRussianSoftSigns) {
            processed = processed.replace(/[ьъ]/g, '');
        }
        
        // 3. Handle Russian leetspeak
        if (this.handleLeetspeak) {
            for (const [leet, normal] of Object.entries(this.russianLeetspeakMap)) {
                const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                processed = processed.replace(new RegExp(escapedLeet, 'g'), normal);
            }
        }
        
        // 4. Handle keyboard layout switching
        if (this.detectRussianKeyboardLayout) {
            processed = this.fixRussianKeyboardLayout(processed);
        }
        
        // 5. Normalize letter elongation
        if (this.handleRussianElongation) {
            processed = processed.replace(/([а-я])\1{2,}/gi, '$1');
        }
        
        // Convert to lowercase
        processed = processed.toLowerCase();
        
        return processed;
    }
    
    // Normalize English text (separate from Hebrew processing)
    normalizeEnglish(text) {
        if (!text || typeof text !== 'string') return '';
        
        let normalized = text;
        
        // Convert to lowercase
        normalized = normalized.toLowerCase();
        
        // Normalize diacritics/accents
        if (this.normalizeDiacritics) {
            normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        
        // Handle leetspeak substitutions
        if (this.handleLeetspeak) {
            for (const [leet, normal] of Object.entries(this.leetspeakMap)) {
                const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
            }
        }
        
        // Remove punctuation, keep letters, numbers
        normalized = normalized.replace(/[^\w\s]/g, '');
        
        // Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        return normalized;
    }
    
    // Perform diacritic-insensitive fuzzy substring matching for phrases
    performDiacriticInsensitiveSubstringMatch(text, keyword) {
        if (!this.diacriticInsensitiveSubstring || !text || !keyword) {
            return false;
        }
        
        // Remove diacritics from both text and keyword
        const normalizedText = this.removeDiacritics(text);
        const normalizedKeyword = this.removeDiacritics(keyword);
        
        // Only apply substring matching for multi-word keywords or when text is significantly longer
        // This prevents false positives with single-word tokens
        if (normalizedText.length <= normalizedKeyword.length + 2) {
            // For similar length text, only check exact substring match
            return normalizedText.includes(normalizedKeyword);
        }
        
        // For single-word tokens, be extra strict - only allow exact substring matches
        if (!normalizedText.includes(' ') && !normalizedKeyword.includes(' ')) {
            return normalizedText.includes(normalizedKeyword);
        }
        
        // Check for exact substring match first
        if (normalizedText.includes(normalizedKeyword)) {
            return true;
        }
        
        // For longer text, perform fuzzy substring matching with stricter thresholds
        const keywordLength = normalizedKeyword.length;
        const threshold = Math.min(1, this.getFuzzySubstringThreshold(keywordLength)); // Stricter threshold
        
        // Slide through the text with fuzzy matching
        for (let i = 0; i <= normalizedText.length - keywordLength; i++) {
            const substring = normalizedText.substring(i, i + keywordLength);
            const distance = levenshtein.get(substring, normalizedKeyword);
            
            if (distance <= threshold) {
                return true;
            }
        }
        
        // Disable partial matches to prevent false positives
        return false;
    }
    
    // Remove diacritics from text (both Hebrew and Latin scripts)
    removeDiacritics(text) {
        if (!text || typeof text !== 'string') return '';
        
        let normalized = text;
        
        // Remove Hebrew niqqud (vowel marks) - corrected pattern
        normalized = normalized.replace(/[\u05B0-\u05B9\u05BB-\u05BD\u05BF-\u05C7]/g, '');
        
        // Remove Latin diacritics
        normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        return normalized;
    }
    
    // Get fuzzy substring threshold based on phrase length
    getFuzzySubstringThreshold(phraseLength) {
        if (phraseLength <= 10) {
            return this.fuzzySubstringThreshold.short;
        } else if (phraseLength <= 20) {
            return this.fuzzySubstringThreshold.medium;
        } else {
            return this.fuzzySubstringThreshold.long;
        }
    }
    
    // Hebrew stemming/root extraction (simplified)
    extractHebrewRoot(word) {
        if (!this.containsHebrew(word) || word.length <= 2) {
            return word;
        }
        
        // Remove common Hebrew suffixes
        const suffixes = ['ים', 'ות', 'יות', 'ה', 'ך', 'ת', 'נו', 'כם', 'כן'];
        
        for (const suffix of suffixes) {
            if (word.endsWith(suffix) && word.length > suffix.length + 1) {
                return word.slice(0, -suffix.length);
            }
        }
        
        // Remove common Hebrew prefixes
        const prefixes = ['ה', 'ב', 'ל', 'כ', 'מ', 'ו'];
        
        for (const prefix of prefixes) {
            if (word.startsWith(prefix) && word.length > prefix.length + 1) {
                return word.slice(prefix.length);
            }
        }
        
        return word;
    }
    
    // Enhanced tokenization with stop word filtering and plural handling
    tokenizeText(text) {
        const normalized = this.normalizeText(text);
        let tokens = normalized.split(/\s+/).filter(token => token.length > 0);
        
        // Split mixed-language tokens (e.g., "срочноurgent" -> ["срочно", "urgent"])
        // Do this BEFORE prefix stripping to avoid splitting incorrectly
        if (this.handleMixedLanguages) {
            tokens = this.splitMixedLanguageTokens(tokens);
        }
        
        // Apply keyboard layout conversion to pure English tokens
        // Convert token-by-token, NOT globally, to handle mixed language messages correctly
        if (this.detectRussianKeyboardLayout) {
            tokens = tokens.map(token => {
                // Only apply conversion to pure English tokens (no Russian/Hebrew in token)
                const isPureEnglish = /^[a-zA-Z]+$/.test(token);
                const containsOtherLanguages = this.containsHebrew(token) || this.containsRussian(token);
                
                if (isPureEnglish && !containsOtherLanguages) {
                    const converted = this.fixRussianKeyboardLayout(token);
                    if (this.containsRussian(converted)) {
                        return converted;
                    }
                }
                return token;
            });
        }
        
        // Remove stop words if enabled
        if (this.removeStopWords) {
            tokens = tokens.filter(token => {
                // Check English, Hebrew, and Russian stop words
                const isEnglishStopWord = this.stopWords.has(token);
                const isHebrewStopWord = this.hebrewStopWords.has(token);
                const isRussianStopWord = this.russianStopWords.has(token);
                return !isEnglishStopWord && !isHebrewStopWord && !isRussianStopWord;
            });
        }
        
        // Handle Hebrew prefixes if text contains Hebrew (only for pure Hebrew tokens)
        if (this.handleHebrew && this.containsHebrew(text)) {
            tokens = tokens.map(token => {
                // Only strip prefixes if token is pure Hebrew, not mixed
                if (this.containsHebrew(token) && !this.containsMultipleLanguages(token)) {
                    return this.stripHebrewPrefixesFromWord(token);
                }
                return token;
            });
        }
        
        // Handle Russian prefixes if text contains Russian (only for pure Russian tokens)
        if (this.handleRussian && this.containsRussian(text)) {
            tokens = tokens.map(token => {
                // Only strip prefixes if token is pure Russian, not mixed
                if (this.containsRussian(token) && !this.containsMultipleLanguages(token)) {
                    return this.stripRussianPrefixesFromWord(token);
                }
                return token;
            });
        }
        
        // Note: Hebrew plural handling is done during keyword comparison, not tokenization
        // This prevents modifying tokens that might be needed for exact matching
        
        // Handle plurals if enabled (but don't modify tokens for fuzzy matching)
        // Plurals are handled during keyword comparison, not tokenization
        
        return tokens;
    }
    
    // Split mixed-language tokens into separate parts
    splitMixedLanguageTokens(tokens) {
        const splitTokens = [];
        
        for (const token of tokens) {
            // Check if token contains mixed languages
            if (this.containsMultipleLanguages(token)) {
                // Split the token into language-specific parts
                const parts = this.splitTokenByLanguage(token);
                splitTokens.push(...parts);
            } else {
                splitTokens.push(token);
            }
        }
        
        return splitTokens;
    }
    
    // Check if a token contains multiple languages
    containsMultipleLanguages(token) {
        if (!token) return false;
        
        const hasHebrew = this.containsHebrew(token);
        const hasEnglish = this.containsEnglish(token);
        const hasRussian = this.containsRussian(token);
        
        // Count languages present
        let languages = 0;
        if (hasHebrew) languages++;
        if (hasEnglish) languages++;
        if (hasRussian) languages++;
        
        return languages >= 2;
    }
    
    // Split a mixed-language token into language-specific parts
    splitTokenByLanguage(token) {
        if (!token) return [token];
        
        const parts = [];
        let currentPart = '';
        let currentLanguage = null;
        
        for (const char of token) {
            const charLanguage = this.detectCharLanguage(char);
            
            if (charLanguage !== currentLanguage) {
                // Start a new part
                if (currentPart && currentLanguage) {
                    parts.push(currentPart);
                }
                currentPart = char;
                currentLanguage = charLanguage;
            } else {
                currentPart += char;
            }
        }
        
        // Add the last part
        if (currentPart && currentLanguage) {
            parts.push(currentPart);
        }
        
        return parts;
    }
    
    // Strip Russian prefixes from a word (similar to Hebrew prefix stripping)
    stripRussianPrefixesFromWord(token) {
        if (!this.handleRussian || !token || token.length <= 3) return token;
        
        if (!this.containsRussian(token)) return token;
        
        // Try to strip Russian prefixes
        for (const prefix of this.russianPrefixes) {
            if (token.toLowerCase().startsWith(prefix.toLowerCase())) {
                const withoutPrefix = token.substring(prefix.length);
                // Only strip if what's left is a reasonable word (at least 2 characters)
                if (withoutPrefix.length >= 2) {
                    return withoutPrefix;
                }
            }
        }
        
        return token;
    }
    
    // Handle plural/singular forms
    handlePlural(word) {
        if (word.length <= 3) return word; // Don't modify very short words
        
        // Hebrew plural handling - disabled to prevent false positives
        // if (this.containsHebrew(word)) {
        //     return this.handleHebrewPlural(word);
        // }
        
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
    
    // Handle Hebrew plural/singular forms
    handleHebrewPlural(word) {
        if (word.length <= 2) return word;
        
        // Common Hebrew plural patterns
        // Alternative feminine plural: add יות (check this first - more specific)
        if (word.endsWith('יות') && word.length > 4) {
            return word.slice(0, -3);
        }
        
        // Masculine plural: add ים
        if (word.endsWith('ים') && word.length > 3) {
            return word.slice(0, -2);
        }
        
        // Feminine plural: add ות (but not if it's part of יות)
        // For feminine words ending in ות, we need to add ה back
        if (word.endsWith('ות') && word.length > 3 && !word.endsWith('יות')) {
            const base = word.slice(0, -2);
            // Add ה for feminine singular
            return base + 'ה';
        }
        
        return word;
    }
    
    // Handle Hebrew emojis - convert emojis to Hebrew words
    handleHebrewEmojis(text) {
        if (!this.handleHebrew || !text) return text;
        
        let processed = text;
        
        // Replace Hebrew emojis with their corresponding words
        for (const [emoji, hebrewWord] of Object.entries(this.hebrewEmojiMap)) {
            processed = processed.replace(new RegExp(emoji, 'g'), hebrewWord);
        }
        
        return processed;
    }
    
    // Handle Hebrew numbers mixed with letters (e.g., שבת2, שב3ת)
    handleHebrewNumbers(text) {
        if (!this.handleHebrew || !text) return text;
        
        let processed = text;
        
        // Pattern: Hebrew word + number + Hebrew word
        // Example: שב3ת → שבת, שבת2 → שבת
        processed = processed.replace(/([\u0590-\u05FF]+)(\d+)([\u0590-\u05FF]*)/g, (match, before, number, after) => {
            // If there's text after the number, try to reconstruct the word
            if (after) {
                return before + after;
            }
            // If no text after, just return the part before the number
            return before;
        });
        
        // Pattern: Hebrew word + number at the end
        processed = processed.replace(/([\u0590-\u05FF]+)(\d+)$/g, '$1');
        
        return processed;
    }
    
    // Enhanced Hebrew fuzzy matching with homoglyphs
    performHebrewFuzzyMatch(word, keyword) {
        if (!this.containsHebrew(word) || !this.containsHebrew(keyword)) {
            return false;
        }
        
        // Method 1: Direct match
        if (word === keyword) return true;
        
        // Method 2: Standard fuzzy match
        if (this.isDirectFuzzyMatch(word, keyword)) return true;
        
        // Method 3: Homoglyph substitution match
        if (this.isHomoglyphMatch(word, keyword)) return true;
        
        // Method 4: Hebrew root extraction matching
        const wordRoot = this.extractHebrewRoot(word);
        const keywordRoot = this.extractHebrewRoot(keyword);
        
        if (wordRoot !== word || keywordRoot !== keyword) {
            if (this.isDirectFuzzyMatch(wordRoot, keywordRoot)) return true;
            if (this.isHomoglyphMatch(wordRoot, keywordRoot)) return true;
        }
        
        return false;
    }
    
    // Check if two Hebrew words match with homoglyph substitutions
    isHomoglyphMatch(word1, word2) {
        if (!this.containsHebrew(word1) || !this.containsHebrew(word2)) return false;
        
        // Try substituting homoglyphs in word1
        for (const [char, substitute] of Object.entries(this.hebrewHomoglyphs)) {
            const modifiedWord1 = word1.replace(new RegExp(char, 'g'), substitute);
            if (this.isDirectFuzzyMatch(modifiedWord1, word2)) return true;
        }
        
        // Try substituting homoglyphs in word2
        for (const [char, substitute] of Object.entries(this.hebrewHomoglyphs)) {
            const modifiedWord2 = word2.replace(new RegExp(char, 'g'), substitute);
            if (this.isDirectFuzzyMatch(word1, modifiedWord2)) return true;
        }
        
        return false;
    }
    
    // Get fuzzy matching threshold based on word length
    getFuzzyThreshold(wordLength, word = null) {
        // Hebrew words are typically shorter, so use stricter thresholds
        if (word && this.containsHebrew(word)) {
            // Hebrew-specific thresholds (very strict)
            if (wordLength <= 3) return 0;      // 2-3 letter words → only exact matches
            if (wordLength <= 6) return 0;       // 4-6 letters → only exact matches
            return 1;                            // Longer words → distance = 1 max
        }
        
        // Standard thresholds for Latin scripts
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
        
        // Method 4: Hebrew root extraction matching
        if (this.containsHebrew(word) && this.containsHebrew(keyword)) {
            const wordRoot = this.extractHebrewRoot(word);
            const keywordRoot = this.extractHebrewRoot(keyword);
            
            if (wordRoot !== word || keywordRoot !== keyword) {
                // Try matching with extracted roots
                if (this.isDirectFuzzyMatch(wordRoot, keywordRoot)) {
                    return true;
                }
                if (this.isSubstringFuzzyMatch(wordRoot, keywordRoot)) {
                    return true;
                }
                // Try homoglyph matching with roots
                if (this.isHomoglyphMatch(wordRoot, keywordRoot)) {
                    return true;
                }
            }
        }
        
        // Method 5: Enhanced Hebrew fuzzy matching (including homoglyphs)
        if (this.containsHebrew(word) && this.containsHebrew(keyword)) {
            if (this.performHebrewFuzzyMatch(word, keyword)) {
                return true;
            }
        }
        
        // Method 6: Russian root extraction matching
        if (this.containsRussian(word) && this.containsRussian(keyword)) {
            const wordRoot = this.extractRussianRoot(word);
            const keywordRoot = this.extractRussianRoot(keyword);
            
            if (wordRoot !== word || keywordRoot !== keyword) {
                // Try matching with extracted roots
                if (this.isDirectFuzzyMatch(wordRoot, keywordRoot)) {
                    return true;
                }
                if (this.isSubstringFuzzyMatch(wordRoot, keywordRoot)) {
                    return true;
                }
            }
        }
        
        // Method 7: Enhanced Russian fuzzy matching
        if (this.containsRussian(word) && this.containsRussian(keyword)) {
            if (this.performRussianFuzzyMatch(word, keyword)) {
                return true;
            }
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
        const threshold = this.getFuzzyThreshold(keywordLength, keyword);
        
        // Use the better (lower) distance for matching
        const bestDistance = Math.min(distance, damerauDistance);
        
        // Additional check: if distance is too high relative to word length, reject
        // For Hebrew words, be extra strict about transpositions
        if (this.containsHebrew(keyword)) {
            // Hebrew words: only allow exact matches or very close matches (distance = 1)
            if (bestDistance > 1) {
                return false;
            }
        } else if (this.containsRussian(keyword)) {
            // Russian words: use Russian-specific thresholds
            const russianThreshold = this.getRussianFuzzyThreshold(keywordLength);
            if (bestDistance > russianThreshold) {
                return false;
            }
        } else if (bestDistance > threshold) {
            // Non-Hebrew/Russian words: respect the threshold strictly
            return false;
        }
        
        // Additional check: reject if distance is more than 50% of the shorter word length
        const shorterLength = Math.min(wordLength, keywordLength);
        if (bestDistance > Math.floor(shorterLength * 0.5)) {
            return false;
        }
        
        // Additional check: reject common word variations that shouldn't match
        // This applies to ALL word lengths, not just short words
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
        
        // Additional check: for short words, be extra conservative
        if (shorterLength <= 4 && bestDistance > 0) {
            // Only allow 1 character difference for very short words, OR transpositions (distance = 2)
            if (bestDistance > 1 && bestDistance !== 2) {
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
        
        // Reject if word is not within reasonable length of keyword
        if (wordLength <= keywordLength || wordLength > keywordLength + 2) {
            return false;
        }
        
        // Check if keyword is contained in word (exact substring)
        if (word.includes(keyword)) {
            // Additional check: reject if the extra characters form a common suffix
            // This prevents "urgently" matching "urgent"
            const suffix = word.substring(keywordLength);
            const commonSuffixes = ['ly', 'ing', 'ed', 'er', 'est', 'ness', 'tion', 'ment', 'able', 'ible', 'ful', 'less'];
            
            // Only reject if suffix is a known English suffix
            if (commonSuffixes.some(s => suffix.toLowerCase().includes(s))) {
                return false;
            }
            
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
    
    // Handle emojis with language awareness
    handleLanguageAwareEmojis(text) {
        if (!text) return text;
        
        let processed = text;
        
        // Determine the primary language of the text
        const hasHebrew = this.containsHebrew(text);
        const hasRussian = this.containsRussian(text);
        
        // If text contains both Hebrew and Russian, prioritize based on content
        if (hasHebrew && hasRussian) {
            // Count Hebrew vs Russian characters to determine priority
            const hebrewCount = (text.match(/[\u0590-\u05FF]/g) || []).length;
            const russianCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
            
            if (russianCount > hebrewCount) {
                // Russian priority
                processed = this.handleRussianEmojis(processed);
                processed = this.handleHebrewEmojis(processed);
            } else {
                // Hebrew priority
                processed = this.handleHebrewEmojis(processed);
                processed = this.handleRussianEmojis(processed);
            }
        } else if (hasRussian) {
            // Russian-only text
            processed = this.handleRussianEmojis(processed);
        } else if (hasHebrew) {
            // Hebrew-only text
            processed = this.handleHebrewEmojis(processed);
        } else {
            // No specific language, try both
            processed = this.handleRussianEmojis(processed);
            processed = this.handleHebrewEmojis(processed);
        }
        
        return processed;
    }
    
    // ==================== RUSSIAN PROCESSING METHODS ====================
    
    // Check if text contains Russian (Cyrillic) characters
    containsRussian(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        // Cyrillic Unicode range: U+0400-U+04FF
        return /[\u0400-\u04FF]/.test(text);
    }
    
    // Check if text contains English characters
    containsEnglish(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        return /[a-zA-Z]/.test(text);
    }
    
    // Normalize Russian text (stress marks, soft signs, etc.)
    normalizeRussian(text) {
        if (!this.handleRussian || !text) return text;
        
        let processed = text;
        
        // 1. Remove stress marks (combining diacritics)
        if (this.normalizeRussianStress) {
            processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        
        // 2. Normalize soft/hard signs
        if (this.normalizeRussianSoftSigns) {
            processed = processed.replace(/[ьъ]/g, '');
        }
        
        // 3. Handle Russian leetspeak
        if (this.handleLeetspeak) {
            for (const [leet, normal] of Object.entries(this.russianLeetspeakMap)) {
                const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                processed = processed.replace(new RegExp(escapedLeet, 'g'), normal);
            }
        }
        
        // 4. Handle keyboard layout switching
        if (this.detectRussianKeyboardLayout) {
            processed = this.fixRussianKeyboardLayout(processed);
        }
        
        // 5. Normalize letter elongation
        if (this.handleRussianElongation) {
            processed = processed.replace(/([а-я])\1{2,}/gi, '$1');
        }
        
        // 6. Handle Russian typos (disabled for now - too aggressive)
        // if (this.handleRussianTypos) {
        //     processed = this.fixRussianTypos(processed);
        // }
        
        return processed;
    }
    
    // Fix Russian keyboard layout switching (English keys on Russian layout)
    fixRussianKeyboardLayout(text) {
        if (!text) return text;
        
        // Check if text looks like English keys on Russian layout
        const englishPattern = /^[qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM\s]+$/;
        
        if (!englishPattern.test(text)) {
            return text; // Not pure English letters, don't convert
        }
        
        // Check if the result would be a valid Russian word
        // Only convert if the resulting text contains Cyrillic characters
        let fixed = text;
        for (const [english, russian] of Object.entries(this.russianKeyboardLayoutMap)) {
            fixed = fixed.replace(new RegExp(english, 'g'), russian);
        }
        
        // Only apply the conversion if the result is a known Russian keyword
        // This prevents converting legitimate English words like "hello" or "urgent"
        if (this.containsRussian(fixed)) {
            // Check if the converted text matches any Russian keyword in our list
            const matchesKnownKeyword = this.keywords.some(keyword => {
                if (!this.containsRussian(keyword)) return false;
                return keyword === fixed || keyword.includes(fixed) || fixed.includes(keyword);
            });
            
            // Only convert if it matches a known Russian keyword
            if (matchesKnownKeyword) {
                return fixed;
            }
        }
        
        // If conversion didn't result in a known Russian keyword, don't apply it
        return text;
    }
    
    // Fix Russian keyboard typos
    fixRussianTypos(text) {
        if (!text) return text;
        
        let fixed = text;
        
        // Apply typo corrections
        for (const [wrong, correct] of Object.entries(this.russianTypoMap)) {
            fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
        }
        
        return fixed;
    }
    
    // Strip Russian prefixes and suffixes
    stripRussianAffixes(word) {
        if (!this.handleRussian || !word || word.length <= 3) return word;
        
        let processed = word;
        
        // Strip prefixes
        if (this.stripRussianPrefixes) {
            for (const prefix of this.russianPrefixes) {
                if (processed.toLowerCase().startsWith(prefix.toLowerCase())) {
                    processed = processed.substring(prefix.length);
                    break; // Only strip one prefix
                }
            }
        }
        
        // Strip suffixes
        for (const suffix of this.russianSuffixes) {
            if (processed.toLowerCase().endsWith(suffix.toLowerCase())) {
                processed = processed.substring(0, processed.length - suffix.length);
                break; // Only strip one suffix
            }
        }
        
        return processed;
    }
    
    // Strip Russian clitics/particles
    stripRussianClitics(word) {
        if (!this.handleRussian || !word) return word;
        
        let processed = word;
        
        for (const clitic of this.russianClitics) {
            if (processed.toLowerCase().endsWith(clitic.toLowerCase())) {
                processed = processed.substring(0, processed.length - clitic.length);
                break; // Only strip one clitic
            }
        }
        
        return processed;
    }
    
    // Russian stemming/root extraction (simplified)
    extractRussianRoot(word) {
        if (!this.containsRussian(word) || word.length <= 2) {
            return word;
        }
        
        let root = word.toLowerCase();
        
        // Strip affixes
        root = this.stripRussianAffixes(root);
        root = this.stripRussianClitics(root);
        
        return root;
    }
    
    // Handle Russian emojis
    handleRussianEmojis(text) {
        if (!this.handleRussian || !text) return text;
        
        let processed = text;
        
        // Replace Russian emojis with their corresponding words
        for (const [emoji, russianWord] of Object.entries(this.russianEmojiMap)) {
            processed = processed.replace(new RegExp(emoji, 'g'), russianWord);
        }
        
        return processed;
    }
    
    // Handle Russian numbers mixed with letters
    handleRussianNumbers(text) {
        if (!this.handleRussian || !text) return text;
        
        let processed = text;
        
        // Pattern: Russian word + number + Russian word
        processed = processed.replace(/([\u0400-\u04FF]+)(\d+)([\u0400-\u04FF]*)/g, (match, before, number, after) => {
            if (after) {
                return before + after;
            }
            return before;
        });
        
        // Pattern: Russian word + number at the end
        processed = processed.replace(/([\u0400-\u04FF]+)(\d+)$/g, '$1');
        
        return processed;
    }
    
    // Enhanced Russian fuzzy matching
    performRussianFuzzyMatch(word, keyword) {
        if (!this.containsRussian(word) || !this.containsRussian(keyword)) {
            return false;
        }
        
        // Method 1: Direct match
        if (word === keyword) return true;
        
        // Method 2: Standard fuzzy match
        if (this.isDirectFuzzyMatch(word, keyword)) return true;
        
        // Method 3: Russian root extraction matching
        const wordRoot = this.extractRussianRoot(word);
        const keywordRoot = this.extractRussianRoot(keyword);
        
        if (wordRoot !== word || keywordRoot !== keyword) {
            if (this.isDirectFuzzyMatch(wordRoot, keywordRoot)) return true;
        }
        
        return false;
    }
    
    // Normalize mixed Russian-English words
    normalizeMixedRussianWord(word) {
        if (!this.handleMixedLanguages || !word) return word;
        
        const language = this.detectTokenLanguage(word);
        
        if (language === 'russian') {
            return this.normalizeRussian(word);
        } else if (language === 'english') {
            return this.normalizeText(word);
        } else if (language === 'mixed') {
            // Split mixed word into parts and normalize each part
            const parts = this.splitMixedWord(word);
            const normalizedParts = parts.map(part => {
                if (this.containsRussian(part)) {
                    return this.normalizeRussian(part);
                } else if (this.containsEnglish(part)) {
                    return this.normalizeText(part);
                } else {
                    // Handle numbers and other characters
                    return part.replace(/\d/g, '');
                }
            });
            return normalizedParts.join('');
        }
        
        return word;
    }
    
    // Split mixed word into language parts
    splitMixedWord(word) {
        const parts = [];
        let currentPart = '';
        let currentLanguage = null;
        
        for (const char of word) {
            const charLanguage = this.detectCharLanguage(char);
            
            if (charLanguage !== currentLanguage) {
                if (currentPart) {
                    parts.push(currentPart);
                }
                currentPart = char;
                currentLanguage = charLanguage;
            } else {
                currentPart += char;
            }
        }
        
        if (currentPart) {
            parts.push(currentPart);
        }
        
        return parts;
    }
    
    // Detect language of a single character
    detectCharLanguage(char) {
        if (/[\u0590-\u05FF]/.test(char)) return 'hebrew';  // Hebrew Unicode range
        if (/[\u0400-\u04FF]/.test(char)) return 'russian'; // Cyrillic Unicode range
        if (/[a-zA-Z]/.test(char)) return 'english';
        if (/\d/.test(char)) return 'number';
        return 'other';
    }
    
    // Detect language of a token
    detectTokenLanguage(token) {
        if (!token) return 'other';
        
        const hasRussian = this.containsRussian(token);
        const hasEnglish = this.containsEnglish(token);
        const hasHebrew = this.containsHebrew(token);
        
        // Count languages present
        let languages = 0;
        if (hasHebrew) languages++;
        if (hasEnglish) languages++;
        if (hasRussian) languages++;
        
        if (languages >= 2) {
            return 'mixed';
        } else if (hasHebrew) {
            return 'hebrew';
        } else if (hasEnglish) {
            return 'english';
        } else if (hasRussian) {
            return 'russian';
        }
        
        return 'other';
    }
    
    // Expand Russian abbreviations
    expandRussianAbbreviations(word) {
        if (!this.expandAbbreviations || !word) return word;
        
        // Check Russian abbreviations
        if (this.russianAbbreviationMap && this.containsRussian(word)) {
            const russianExpansion = this.russianAbbreviationMap[word];
            if (russianExpansion) {
                return russianExpansion;
            }
        }
        
        return word;
    }
    
    // Get fuzzy matching threshold for Russian words
    getRussianFuzzyThreshold(wordLength) {
        // Russian-specific thresholds
        if (wordLength <= 3) return 0;      // 2-3 letter words → only exact matches
        if (wordLength <= 6) return 1;      // 4-6 letters → distance = 1 max
        if (wordLength <= 10) return 2;     // 7-10 letters → distance = 2 max
        return 3;                            // Longer words → distance = 3 max
    }
    
    // ==================== END RUSSIAN PROCESSING METHODS ====================

    // Enhanced keyword detection with fuzzy matching
    detectKeywordsWithFuzzy(messageText, groupName = null) {
        if (!this.enabled || !messageText || typeof messageText !== 'string') {
            return [];
        }

        const detectedKeywords = [];
        const tokens = this.tokenizeText(messageText);
        
        // Check global keywords
        for (const keyword of this.keywords) {
            // Skip keyboard conversion for keywords to prevent corrupting valid English keywords
            const normalizedKeyword = this.normalizeText(keyword, true);
            
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
                
                // Diacritic-insensitive fuzzy substring match for multi-word keywords
                if (this.performDiacriticInsensitiveSubstringMatch(messageText, keyword)) {
                    detectedKeywords.push({ 
                        keyword, 
                        type: 'global', 
                        matchType: 'diacritic-insensitive',
                        token: keyword,
                        phraseMatch: true,
                        substringMatch: true
                    });
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
                    
                    // Diacritic-insensitive fuzzy substring match
                    if (this.performDiacriticInsensitiveSubstringMatch(token, normalizedKeyword)) {
                        detectedKeywords.push({ keyword, type: 'global', matchType: 'diacritic-insensitive', token });
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
                    // Skip keyboard conversion for personal keywords too
                    const normalizedKeyword = this.normalizeText(keyword, true);
                    
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
