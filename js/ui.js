// ui.js - DOM-based screens (splash, menu, HUD, game-over)

import { GameState } from './game.js';
import { MAX_LIVES } from './config.js';

export class UI {
    constructor() {
        this.screens = {};
        this.elements = {};
        this.game = null;
    }

    init(game) {
        this.game = game;
        this._cacheElements();
        this._bindButtons();
    }

    _cacheElements() {
        this.screens = {
            loading: document.getElementById('screen-loading'),
            splash: document.getElementById('screen-splash'),
            menu: document.getElementById('screen-menu'),
            hud: document.getElementById('hud'),
            gameOver: document.getElementById('screen-gameover'),
        };

        this.elements = {
            loadingBar: document.getElementById('loading-bar'),
            loadingText: document.getElementById('loading-text'),
            highScoreMenu: document.getElementById('high-score-menu'),
            score: document.getElementById('hud-score'),
            combo: document.getElementById('hud-combo'),
            livesContainer: document.getElementById('hud-lives'),
            level: document.getElementById('hud-level'),
            finalScore: document.getElementById('final-score'),
            finalHighScore: document.getElementById('final-highscore'),
            newBestBadge: document.getElementById('new-best-badge'),
            btnPlay: document.getElementById('btn-play'),
            btnReplay: document.getElementById('btn-replay'),
            btnSound: document.getElementById('btn-sound'),
        };
    }

    _bindButtons() {
        // Splash screen - tap anywhere to go to menu
        this.screens.splash?.addEventListener('click', () => {
            this.game?._startMenu();
        });
        this.screens.splash?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.game?._startMenu();
        }, { passive: false });

        this.elements.btnPlay?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game?.startGame();
        });

        this.elements.btnReplay?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game?.startGame();
        });

        this.elements.btnSound?.addEventListener('click', (e) => {
            e.stopPropagation();
            const { audioManager } = require_audio();
            const enabled = audioManager.toggleSound();
            this.elements.btnSound.classList.toggle('muted', !enabled);
            this.elements.btnSound.textContent = enabled ? '🔊' : '🔇';
        });
    }

    showScreen(state) {
        // Hide all screens
        Object.values(this.screens).forEach(s => {
            if (s) s.classList.remove('active');
        });

        switch (state) {
            case GameState.LOADING:
                this.screens.loading?.classList.add('active');
                break;
            case GameState.SPLASH:
                this.screens.splash?.classList.add('active');
                break;
            case GameState.MENU:
                this.screens.menu?.classList.add('active');
                break;
            case GameState.PLAYING:
                this.screens.hud?.classList.add('active');
                break;
            case GameState.GAME_OVER:
                this.screens.hud?.classList.add('active');
                this.screens.gameOver?.classList.add('active');
                break;
        }
    }

    updateLoadingProgress(progress, text) {
        if (this.elements.loadingBar) {
            this.elements.loadingBar.style.width = `${progress * 100}%`;
        }
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text || 'Loading...';
        }
    }

    updateScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = score.toLocaleString();
        }
    }

    updateCombo(multiplier) {
        if (this.elements.combo) {
            if (multiplier > 1) {
                this.elements.combo.textContent = `x${multiplier}`;
                this.elements.combo.classList.add('active');
                // Pulse animation
                this.elements.combo.classList.remove('pulse');
                void this.elements.combo.offsetWidth; // force reflow
                this.elements.combo.classList.add('pulse');
            } else {
                this.elements.combo.textContent = '';
                this.elements.combo.classList.remove('active');
            }
        }
    }

    updateLives(lives) {
        if (this.elements.livesContainer) {
            let html = '';
            for (let i = 0; i < MAX_LIVES; i++) {
                html += `<span class="heart-icon ${i < lives ? 'alive' : 'dead'}">❤️</span>`;
            }
            this.elements.livesContainer.innerHTML = html;
        }
    }

    updateLevel(level) {
        if (this.elements.level) {
            this.elements.level.textContent = `LV ${level}`;
        }
    }

    updateHighScore(score) {
        if (this.elements.highScoreMenu) {
            this.elements.highScoreMenu.textContent = `Best: ${score.toLocaleString()}`;
        }
    }

    showGameOver(score, highScore, isNewBest) {
        if (this.elements.finalScore) {
            this._animateCountUp(this.elements.finalScore, 0, score, 1000);
        }
        if (this.elements.finalHighScore) {
            this.elements.finalHighScore.textContent = `Best: ${highScore.toLocaleString()}`;
        }
        if (this.elements.newBestBadge) {
            this.elements.newBestBadge.classList.toggle('visible', isNewBest);
        }
    }

    _animateCountUp(el, from, to, duration) {
        const start = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const value = Math.floor(from + (to - from) * progress);
            el.textContent = value.toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
}

// Helper to lazily import audioManager (avoids circular dependency)
function require_audio() {
    return { audioManager: window.__audioManager };
}
