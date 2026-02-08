// i18n.js - Bilingual support (Hebrew + English) for Spot the Shape

const STORAGE_KEY = 'spotshape_lang';

const translations = {
    he: {
        // Menu
        'menu.title': 'מצא את\nהצורה',
        'menu.subtitle': '!מצאו את הצורה התואמת לפני שהזמן נגמר',
        'menu.solo': 'משחק יחיד',
        'menu.soloDesc': 'קושי עולה',
        'menu.vs': 'משחק לשניים',
        'menu.vsDesc': '!מי ימצא ראשון',
        'menu.best': 'שיא: {0}',
        'menu.howToPlay': '?איך משחקים',

        // Loading
        'loading.text': '{0}% ...טוען',

        // HUD
        'hud.level': 'שלב {0}',
        'hud.round': 'סיבוב {0}/{1}',

        // Game canvas
        'game.find': ':מצא',
        'game.level': '!שלב {0}',
        'game.timesUp': '!נגמר הזמן',
        'game.tooSlow': '!לאט מדי',
        'game.round': 'סיבוב {0}',
        'game.playerLooking': '...{0} שחקן מחפש',

        // Game over
        'gameover.title': 'המשחק נגמר',
        'gameover.levelReached': 'הגעת לשלב {0}',
        'gameover.newBest': '🏆 !שיא חדש',
        'gameover.best': 'שיא: {0}',
        'gameover.playAgain': 'שחק שוב',
        'gameover.menu': 'תפריט',
        'gameover.p1Wins': '!שחקן 1 ניצח',
        'gameover.p2Wins': '!שחקן 2 ניצח',
        'gameover.tie': '!תיקו',
        'gameover.roundsPlayed': '{0} סיבובים שוחקו',

        // Instructions
        'instr.title': '?איך משחקים',
        'instr.soloTitle': ':משחק יחיד',
        'instr.soloBody': '.צורה מופיעה למטה - מצאו אותה בין הצורות הצפות למעלה! כל סיבוב הזמן מתקצר והצורות מתרבות',
        'instr.vsTitle': ':משחק לשניים',
        'instr.vsBody': '!שני שחקנים מתחרים! לחצו על כפתור ה-BUZZ שלכם כשזיהיתם את הצורה, ואז הקישו עליה. שחקן שטועה - הנקודה ליריב',
        'instr.tipTitle': ':טיפ',
        'instr.tipBody': '!צורות גדולות קלות לזיהוי אבל הקטנות שוות יותר נקודות. תהיו מהירים',
        'instr.gotIt': '!הבנתי',

        // Buzz
        'buzz.p1': 'P1 באזז',
        'buzz.p2': 'P2 באזז',
    },
    en: {
        // Menu
        'menu.title': 'SPOT THE\nSHAPE',
        'menu.subtitle': 'Find the matching shape before time runs out!',
        'menu.solo': 'SOLO MODE',
        'menu.soloDesc': 'Progressive difficulty',
        'menu.vs': 'VS MODE',
        'menu.vsDesc': 'Race to spot first!',
        'menu.best': 'Best: {0}',
        'menu.howToPlay': 'How to play?',

        // Loading
        'loading.text': 'Loading {0}%',

        // HUD
        'hud.level': 'LV {0}',
        'hud.round': 'Round {0}/{1}',

        // Game canvas
        'game.find': 'FIND:',
        'game.level': 'Level {0}!',
        'game.timesUp': 'Time\'s up!',
        'game.tooSlow': 'Too slow!',
        'game.round': 'Round {0}',
        'game.playerLooking': 'Player {0} is looking...',

        // Game over
        'gameover.title': 'GAME OVER',
        'gameover.levelReached': 'Level {0} reached',
        'gameover.newBest': '🏆 NEW BEST!',
        'gameover.best': 'Best: {0}',
        'gameover.playAgain': 'PLAY AGAIN',
        'gameover.menu': 'MENU',
        'gameover.p1Wins': 'Player 1 Wins!',
        'gameover.p2Wins': 'Player 2 Wins!',
        'gameover.tie': 'It\'s a Tie!',
        'gameover.roundsPlayed': '{0} rounds played',

        // Instructions
        'instr.title': 'How to play?',
        'instr.soloTitle': 'Solo Mode:',
        'instr.soloBody': 'A shape appears at the bottom - find it among the floating shapes above! Each round the timer gets shorter and more shapes appear.',
        'instr.vsTitle': 'VS Mode:',
        'instr.vsBody': 'Two players compete! Press your BUZZ button when you spot the shape, then tap it. Wrong guess? Point goes to your opponent!',
        'instr.tipTitle': 'Tip:',
        'instr.tipBody': 'Big shapes are easy to spot but small ones score more points. Be fast!',
        'instr.gotIt': 'Got it!',

        // Buzz
        'buzz.p1': 'P1 BUZZ',
        'buzz.p2': 'P2 BUZZ',
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
