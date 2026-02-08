// i18n.js - Bilingual support (Hebrew + English) for Spot the Shape

const STORAGE_KEY = 'spotshape_lang';

const translations = {
    he: {
        // Menu
        'menu.title': 'מצא את\nהצורה',
        'menu.subtitle': 'מצאו את הצורה התואמת לפני שהזמן נגמר!',
        'menu.solo': 'התחל משחק',
        'menu.soloDesc': 'קושי עולה',
        'menu.best': 'שיא: {0}',
        'menu.howToPlay': 'איך משחקים?',

        // Loading
        'loading.text': 'טוען... {0}%',

        // HUD
        'hud.level': 'שלב {0}',

        // Game canvas
        'game.find': 'מצא:',
        'game.level': 'שלב {0}!',
        'game.timesUp': 'נגמר הזמן!',

        // Game over
        'gameover.title': 'המשחק נגמר',
        'gameover.levelReached': 'הגעת לשלב {0}',
        'gameover.newBest': '🏆 שיא חדש!',
        'gameover.best': 'שיא: {0}',
        'gameover.playAgain': 'שחק שוב',
        'gameover.menu': 'תפריט',

        // Instructions
        'instr.title': 'איך משחקים?',
        'instr.soloTitle': 'משחק יחיד:',
        'instr.soloBody': 'צורה מופיעה למטה - מצאו אותה בין הצורות הצפות למעלה! כל סיבוב הזמן מתקצר והצורות מתרבות.',
        'instr.tipTitle': 'טיפ:',
        'instr.tipBody': 'צורות גדולות קלות לזיהוי אבל הקטנות שוות יותר נקודות. תהיו מהירים!',
        'instr.gotIt': 'הבנתי!',

        // Leaderboard
        'leaderboard.title': 'טבלת שיאים',
        'leaderboard.enterName': 'שיא חדש! הכניסו שם:',
        'leaderboard.save': 'שמור',
        'leaderboard.empty': 'אין שיאים עדיין',
    },
    en: {
        // Menu
        'menu.title': 'SPOT THE\nSHAPE',
        'menu.subtitle': 'Find the matching shape before time runs out!',
        'menu.solo': 'PLAY',
        'menu.soloDesc': 'Progressive difficulty',
        'menu.best': 'Best: {0}',
        'menu.howToPlay': 'How to play?',

        // Loading
        'loading.text': 'Loading {0}%',

        // HUD
        'hud.level': 'LV {0}',

        // Game canvas
        'game.find': 'FIND:',
        'game.level': 'Level {0}!',
        'game.timesUp': 'Time\'s up!',

        // Game over
        'gameover.title': 'GAME OVER',
        'gameover.levelReached': 'Level {0} reached',
        'gameover.newBest': '🏆 NEW BEST!',
        'gameover.best': 'Best: {0}',
        'gameover.playAgain': 'PLAY AGAIN',
        'gameover.menu': 'MENU',

        // Instructions
        'instr.title': 'How to play?',
        'instr.soloTitle': 'Solo Mode:',
        'instr.soloBody': 'A shape appears at the bottom - find it among the floating shapes above! Each round the timer gets shorter and more shapes appear.',
        'instr.tipTitle': 'Tip:',
        'instr.tipBody': 'Big shapes are easy to spot but small ones score more points. Be fast!',
        'instr.gotIt': 'Got it!',

        // Leaderboard
        'leaderboard.title': 'LEADERBOARD',
        'leaderboard.enterName': 'New high score! Enter name:',
        'leaderboard.save': 'SAVE',
        'leaderboard.empty': 'No scores yet',
    }
};

const shapeNames = {
    he: {
        star: 'כוכב', heart: 'לב', diamond: 'יהלום', moon: 'ירח',
        sun: 'שמש', cloud: 'ענן', lightning: 'ברק', tree: 'עץ',
        flower: 'פרח', fish: 'דג', duck: 'ברווז', car: 'מכונית',
        house: 'בית', rocket: 'רקטה', crown: 'כתר', umbrella: 'מטריה',
        butterfly: 'פרפר', anchor: 'עוגן', music_note: 'תו מוזיקלי', key: 'מפתח'
    },
    en: {
        star: 'STAR', heart: 'HEART', diamond: 'DIAMOND', moon: 'MOON',
        sun: 'SUN', cloud: 'CLOUD', lightning: 'LIGHTNING', tree: 'TREE',
        flower: 'FLOWER', fish: 'FISH', duck: 'DUCK', car: 'CAR',
        house: 'HOUSE', rocket: 'ROCKET', crown: 'CROWN', umbrella: 'UMBRELLA',
        butterfly: 'BUTTERFLY', anchor: 'ANCHOR', music_note: 'MUSIC NOTE', key: 'KEY'
    }
};

let currentLang = 'he';

export function initLang() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'en' || saved === 'he') currentLang = saved;
    } catch {}
    _applyDir();
}

export function getLang() {
    return currentLang;
}

export function setLang(lang) {
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    _applyDir();
}

export function toggleLang() {
    setLang(currentLang === 'he' ? 'en' : 'he');
    return currentLang;
}

export function t(key, ...args) {
    let str = translations[currentLang]?.[key] || translations['en']?.[key] || key;
    args.forEach((val, i) => {
        str = str.replace(`{${i}}`, val);
    });
    return str;
}

export function shapeName(shapeType) {
    return shapeNames[currentLang]?.[shapeType] || shapeType.replace('_', ' ').toUpperCase();
}

function _applyDir() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'he' ? 'rtl' : 'ltr';
}
