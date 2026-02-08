// config.js - Game constants for Spot the Shape

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const SHAPES = [
    'star', 'heart', 'diamond', 'moon', 'sun', 'cloud', 'lightning',
    'tree', 'flower', 'fish', 'duck', 'car', 'house', 'rocket',
    'crown', 'umbrella', 'butterfly', 'anchor', 'music_note', 'key'
];

// Difficulty levels for single player
export const DIFFICULTY_TABLE = [
    { shapeCount: 6,  speed: 40,  minSize: 90,  maxSize: 120, timeLimit: 12 },
    { shapeCount: 8,  speed: 50,  minSize: 85,  maxSize: 115, timeLimit: 11 },
    { shapeCount: 10, speed: 55,  minSize: 80,  maxSize: 110, timeLimit: 10 },
    { shapeCount: 12, speed: 60,  minSize: 75,  maxSize: 105, timeLimit: 9 },
    { shapeCount: 14, speed: 70,  minSize: 70,  maxSize: 100, timeLimit: 8 },
    { shapeCount: 16, speed: 80,  minSize: 65,  maxSize: 95,  timeLimit: 7 },
    { shapeCount: 18, speed: 90,  minSize: 60,  maxSize: 90,  timeLimit: 7 },
    { shapeCount: 20, speed: 100, minSize: 55,  maxSize: 85,  timeLimit: 6 },
    { shapeCount: 22, speed: 110, minSize: 50,  maxSize: 80,  timeLimit: 6 },
    { shapeCount: 25, speed: 120, minSize: 45,  maxSize: 75,  timeLimit: 5 },
];

export const BOARD_TOP = 120;
export const BOARD_BOTTOM = 950;
export const TARGET_AREA_Y = 1080;

export const STORAGE_KEY = 'spotshape_highscore';
export const LEADERBOARD_KEY = 'spotshape_leaderboard';

export const ASSET_MANIFEST = {
    shapes: {},
    audio: {
        correct:   'assets/audio/correct.wav',
        wrong:     'assets/audio/wrong.wav',
        btnClick:  'assets/audio/btn_click.wav',
        roundWin:  'assets/audio/round_win.wav',
        gameOver:  'assets/audio/game_over.wav',
        buzz:      'assets/audio/buzz.wav',
        tick:      'assets/audio/tick.wav',
        menuMusic: 'assets/audio/menu_music.mp3',
        gameMusic: 'assets/audio/game_music.mp3',
    }
};

// Dynamically populate shape assets
SHAPES.forEach(s => {
    ASSET_MANIFEST.shapes[s] = `assets/images/shapes/${s}.png`;
});

export const PARTICLE_COUNT = 10;
