// config.js - All game constants & difficulty table

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const MAX_LIVES = 5;
export const COMBO_WINDOW_MS = 800;
export const MAX_COMBO_MULTIPLIER = 5;
export const DIFFICULTY_INTERVAL_MS = 15000;

export const FRUITS = [
    { type: 'blueberry',   points: 10, color: '#6366f1', radius: 0.8 },
    { type: 'grape',       points: 15, color: '#a855f7', radius: 0.75 },
    { type: 'cherry',      points: 15, color: '#ef4444', radius: 0.7 },
    { type: 'lemon',       points: 20, color: '#facc15', radius: 0.85 },
    { type: 'strawberry',  points: 25, color: '#f43f5e', radius: 0.8 },
    { type: 'orange',      points: 30, color: '#f97316', radius: 0.9 },
    { type: 'apple',       points: 35, color: '#22c55e', radius: 0.9 },
    { type: 'watermelon',  points: 50, color: '#10b981', radius: 1.1 },
];

export const SPECIAL_TYPES = {
    STAR:  { type: 'star',  points: 100, color: '#fbbf24', radius: 0.9 },
    BOMB:  { type: 'bomb',  points: 0,   color: '#1f2937', radius: 0.85 },
    HEART: { type: 'heart', points: 0,   color: '#ec4899', radius: 0.8 },
};

export const SPECIAL_SPAWN_CHANCE = 0.12;
export const BOMB_RATIO = 0.4;
export const STAR_RATIO = 0.35;
export const HEART_RATIO = 0.25;

export const BASE_ENTITY_RADIUS = 50;

// Difficulty levels - index 0 = level 1, etc.
export const DIFFICULTY_TABLE = [
    { spawnInterval: 1200, ttl: 4000, radiusScale: 1.0,  maxOnScreen: 5  },
    { spawnInterval: 1050, ttl: 3700, radiusScale: 0.95, maxOnScreen: 6  },
    { spawnInterval: 900,  ttl: 3400, radiusScale: 0.90, maxOnScreen: 7  },
    { spawnInterval: 800,  ttl: 3100, radiusScale: 0.85, maxOnScreen: 8  },
    { spawnInterval: 700,  ttl: 2800, radiusScale: 0.80, maxOnScreen: 9  },
    { spawnInterval: 600,  ttl: 2500, radiusScale: 0.75, maxOnScreen: 10 },
    { spawnInterval: 520,  ttl: 2300, radiusScale: 0.72, maxOnScreen: 11 },
    { spawnInterval: 450,  ttl: 2100, radiusScale: 0.68, maxOnScreen: 12 },
    { spawnInterval: 400,  ttl: 1900, radiusScale: 0.65, maxOnScreen: 13 },
    { spawnInterval: 350,  ttl: 1700, radiusScale: 0.60, maxOnScreen: 14 },
];

export const PARTICLE_COUNT = 12;
export const PARTICLE_LIFETIME = 500;
export const FLOAT_TEXT_LIFETIME = 800;
export const SCREEN_SHAKE_DURATION = 300;
export const SCREEN_SHAKE_INTENSITY = 8;

export const STORAGE_KEY = 'tapandpop_highscore';

export const ASSET_MANIFEST = {
    images: {
        blueberry:   'assets/images/blueberry.png',
        grape:       'assets/images/grape.png',
        cherry:      'assets/images/cherry.png',
        lemon:       'assets/images/lemon.png',
        strawberry:  'assets/images/strawberry.png',
        orange:      'assets/images/orange.png',
        apple:       'assets/images/apple.png',
        watermelon:  'assets/images/watermelon.png',
        star:        'assets/images/star.png',
        bomb:        'assets/images/bomb.png',
        heart:       'assets/images/heart.png',
        heartIcon:   'assets/images/heart_icon.png',
        background:  'assets/images/background.png',
        logo:        'assets/images/logo.png',
        popBurst:    'assets/images/pop_burst.png',
        btnPlay:     'assets/images/btn_play.png',
        btnReplay:   'assets/images/btn_replay.png',
        btnSound:    'assets/images/btn_sound.png',
    },
    audio: {
        pop:         'assets/audio/pop.wav',
        starCollect: 'assets/audio/star_collect.wav',
        bombExplode: 'assets/audio/bomb_explode.wav',
        heartCollect:'assets/audio/heart_collect.wav',
        lifeLost:    'assets/audio/life_lost.wav',
        gameOver:    'assets/audio/game_over.wav',
        btnClick:    'assets/audio/btn_click.wav',
        menuMusic:   'assets/audio/menu_music.wav',
        gameMusic:   'assets/audio/game_music.wav',
    }
};
