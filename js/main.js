// main.js - Entry: canvas setup, asset loading, Game init

import { ASSET_MANIFEST, GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { renderer } from './renderer.js';
import { inputManager } from './input.js';
import { audioManager } from './audio.js';
import { Game, GameState } from './game.js';
import { UI } from './ui.js';

class AssetLoader {
    constructor() {
        this.images = {};
        this.audio = {};
        this.totalAssets = 0;
        this.loadedAssets = 0;
    }

    async loadAll(onProgress) {
        const imageEntries = Object.entries(ASSET_MANIFEST.images);
        const audioEntries = Object.entries(ASSET_MANIFEST.audio);
        this.totalAssets = imageEntries.length + audioEntries.length;

        const imagePromises = imageEntries.map(([name, src]) =>
            this._loadImage(name, src, onProgress)
        );
        const audioPromises = audioEntries.map(([name, src]) =>
            this._loadAudio(name, src, onProgress)
        );

        await Promise.all([...imagePromises, ...audioPromises]);
        return { images: this.images, audio: this.audio };
    }

    _loadImage(name, src, onProgress) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this._progress(onProgress);
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${src}`);
                this._progress(onProgress);
                resolve();
            };
            img.src = src;
        });
    }

    _loadAudio(name, src, onProgress) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.preload = 'auto';
            let resolved = false;

            const done = () => {
                if (resolved) return;
                resolved = true;
                this.audio[name] = audio;
                this._progress(onProgress);
                resolve();
            };

            audio.addEventListener('canplaythrough', done, { once: true });
            audio.addEventListener('error', () => {
                if (resolved) return;
                resolved = true;
                console.warn(`Failed to load audio: ${src}`);
                this._progress(onProgress);
                resolve();
            }, { once: true });

            // Fallback timeout in case canplaythrough doesn't fire
            setTimeout(done, 3000);

            audio.src = src;
            audio.load();
        });
    }

    _progress(onProgress) {
        this.loadedAssets++;
        if (onProgress) {
            onProgress(this.loadedAssets / this.totalAssets);
        }
    }
}

async function init() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    // Init renderer and input
    renderer.init(canvas);
    inputManager.init(canvas);

    // Create UI
    const ui = new UI();

    // Show loading screen
    const loadingScreen = document.getElementById('screen-loading');
    if (loadingScreen) loadingScreen.classList.add('active');

    // Cache UI elements once
    ui._cacheElements();

    // Load assets
    const loader = new AssetLoader();
    const assets = await loader.loadAll((progress) => {
        ui.updateLoadingProgress(progress, `Loading... ${Math.floor(progress * 100)}%`);
    });

    // Register audio
    for (const [name, audio] of Object.entries(assets.audio)) {
        if (name.includes('Music') || name.includes('music')) {
            audioManager.registerMusic(name, audio);
        } else {
            audioManager.registerSound(name, audio);
        }
    }

    // Expose audioManager globally for UI sound toggle
    window.__audioManager = audioManager;

    // Create game
    const game = new Game(assets, ui);
    ui.init(game);

    // Start game
    game.start();
}

// Resize handler
function resizeCanvas() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const gameAspect = GAME_WIDTH / GAME_HEIGHT;
    const windowAspect = windowWidth / windowHeight;

    let width, height;
    if (windowAspect < gameAspect) {
        width = windowWidth;
        height = windowWidth / gameAspect;
    } else {
        height = windowHeight;
        width = windowHeight * gameAspect;
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Center the game container
    const container = document.getElementById('game-container');
    if (container) {
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
    }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    init();
});
