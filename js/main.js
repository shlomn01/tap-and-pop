// main.js - Entry point: asset loading, game init, UI wiring

import { GAME_WIDTH, GAME_HEIGHT, ASSET_MANIFEST, TWO_PLAYER_ROUNDS } from './config.js';
import { Game, State, AudioManager } from './game.js';

// --- Load Images ---
async function loadImages(onProgress) {
    const images = {};
    const entries = Object.entries(ASSET_MANIFEST.shapes);
    let loaded = 0;

    const promises = entries.map(([name, src]) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => { images[name] = img; loaded++; onProgress(loaded, entries.length); resolve(); };
        img.onerror = () => { console.warn('Failed:', src); loaded++; onProgress(loaded, entries.length); resolve(); };
        img.src = src;
    }));

    await Promise.all(promises);
    return images;
}

// --- Register Audio URLs ---
async function loadAudio(audioManager, onProgress) {
    const entries = Object.entries(ASSET_MANIFEST.audio);
    let loaded = 0;

    for (const [name, url] of entries) {
        await audioManager.loadBuffer(name, url);
        loaded++;
        onProgress(loaded, entries.length);
    }
}

// --- Resize ---
function resize(canvas, container) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = GAME_WIDTH / GAME_HEIGHT;
    const wAspect = w / h;
    let cw, ch;
    if (wAspect < aspect) { cw = w; ch = w / aspect; }
    else { ch = h; cw = h * aspect; }
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    container.style.width = `${cw}px`;
    container.style.height = `${ch}px`;
}

// --- UI Controller ---
class UIController {
    constructor(game) {
        this.game = game;
        this.els = {};
        this._cache();
        this._bind();
        this._wire();
        this._lastMode = 'solo';
    }

    _cache() {
        const $ = id => document.getElementById(id);
        this.els = {
            loading: $('screen-loading'),
            menu: $('screen-menu'),
            hud: $('screen-hud'),
            gameOver: $('screen-gameover'),
            loadBar: $('load-bar'),
            loadText: $('load-text'),
            highScore: $('menu-highscore'),
            btnSolo: $('btn-solo'),
            btnDuo: $('btn-duo'),
            btnSound: $('btn-sound'),
            hudScore: $('hud-score'),
            hudLives: $('hud-lives'),
            hudLevel: $('hud-level'),
            hudTimer: $('hud-timer'),
            timerBar: $('timer-bar'),
            duoHud: $('duo-hud'),
            p1Score: $('p1-score'),
            p2Score: $('p2-score'),
            duoRound: $('duo-round'),
            buzzPanel: $('buzz-panel'),
            buzzP1: $('buzz-p1'),
            buzzP2: $('buzz-p2'),
            goTitle: $('go-title'),
            goScore: $('go-score'),
            goSubtext: $('go-subtext'),
            goBest: $('go-best'),
            btnReplay: $('btn-replay'),
            btnMenu: $('btn-menu'),
            instructions: $('instructions-panel'),
            btnCloseInstructions: $('btn-close-instructions'),
        };
    }

    _bind() {
        // Start menu music on any first interaction
        this._musicStarted = false;
        const startMusic = () => {
            if (!this._musicStarted) {
                this._musicStarted = true;
                this.game.startMenuMusic();
            }
        };

        this.els.btnSolo?.addEventListener('click', () => {
            startMusic();
            this._lastMode = 'solo';
            this._hideInstructions();
            this.game.startSolo();
        });
        this.els.btnDuo?.addEventListener('click', () => {
            startMusic();
            this._lastMode = 'duo';
            this._hideInstructions();
            this.game.startDuo();
        });
        this.els.btnReplay?.addEventListener('click', () => {
            if (this._lastMode === 'duo') {
                this.game.startDuo();
            } else {
                this.game.startSolo();
            }
        });
        this.els.btnMenu?.addEventListener('click', () => this.game.goToMenu());

        // Start music on any tap on the menu screen
        this.els.menu?.addEventListener('click', () => startMusic());
        this.els.menu?.addEventListener('touchstart', () => startMusic(), { passive: true });
        this.els.btnSound?.addEventListener('click', () => {
            startMusic();
            const on = this.game.toggleSound();
            this.els.btnSound.textContent = on ? '\u{1F50A}' : '\u{1F507}';
            this.els.btnSound.classList.toggle('muted', !on);
        });

        // Close instructions button
        this.els.btnCloseInstructions?.addEventListener('click', () => this._hideInstructions());

        // Buzz-in buttons
        this.els.buzzP1?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game.duoBuzz(1);
        });
        this.els.buzzP2?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game.duoBuzz(2);
        });
        this.els.buzzP1?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.game.duoBuzz(1);
        }, { passive: false });
        this.els.buzzP2?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.game.duoBuzz(2);
        }, { passive: false });
    }

    _hideInstructions() {
        this.els.instructions?.classList.remove('visible');
    }

    _wire() {
        this.game.onStateChange = () => this._updateScreens();
        this.game.onScoreChange = () => this._updateScores();
        this.game.onTimerChange = () => this._updateTimer();
        this.game.onBuzzChange = () => this._updateBuzz();
    }

    showLoading(progress) {
        if (this.els.loadBar) this.els.loadBar.style.width = `${progress * 100}%`;
        if (this.els.loadText) this.els.loadText.textContent = `Loading ${Math.floor(progress * 100)}%`;
    }

    hideLoading() {
        this.els.loading?.classList.remove('active');
    }

    _updateScreens() {
        const state = this.game.state;
        ['loading', 'menu', 'hud', 'gameOver'].forEach(s => this.els[s]?.classList.remove('active'));
        this.els.duoHud?.classList.remove('active');
        this.els.buzzPanel?.classList.remove('active');

        switch (state) {
            case State.MENU:
                this.els.menu?.classList.add('active');
                if (this.els.highScore) this.els.highScore.textContent = `Best: ${this.game.highScore}`;
                // Show instructions on menu
                this.els.instructions?.classList.add('visible');
                break;
            case State.PLAYING_SOLO:
            case State.ROUND_TRANSITION:
                this.els.hud?.classList.add('active');
                if (this._lastMode === 'duo') {
                    this.els.duoHud?.classList.add('active');
                }
                break;
            case State.PLAYING_DUO:
                this.els.hud?.classList.add('active');
                this.els.duoHud?.classList.add('active');
                this.els.buzzPanel?.classList.add('active');
                this._updateBuzz();
                break;
            case State.DUO_BUZZED:
                this.els.hud?.classList.add('active');
                this.els.duoHud?.classList.add('active');
                this.els.buzzPanel?.classList.remove('active');
                break;
            case State.GAME_OVER:
                this.els.gameOver?.classList.add('active');
                this._showGameOver();
                break;
        }
    }

    _updateScores() {
        const g = this.game;
        if (g.state === State.PLAYING_SOLO || (g.state === State.ROUND_TRANSITION && this._lastMode === 'solo')) {
            if (this.els.hudScore) this.els.hudScore.textContent = g.score;
            if (this.els.hudLives) {
                let h = '';
                for (let i = 0; i < 3; i++) h += `<span class="life ${i < g.lives ? '' : 'lost'}">\u2764\uFE0F</span>`;
                this.els.hudLives.innerHTML = h;
            }
            if (this.els.hudLevel) this.els.hudLevel.textContent = `LV ${g.level + 1}`;
        }
        if (g.state === State.PLAYING_DUO || g.state === State.DUO_BUZZED || (g.state === State.ROUND_TRANSITION && this._lastMode === 'duo')) {
            if (this.els.p1Score) this.els.p1Score.textContent = g.p1Score;
            if (this.els.p2Score) this.els.p2Score.textContent = g.p2Score;
            if (this.els.duoRound) this.els.duoRound.textContent = `Round ${g.currentRound}/${TWO_PLAYER_ROUNDS}`;
        }
    }

    _updateTimer() {
        const g = this.game;
        const pct = Math.max(0, g.roundTimer / g.roundTimerMax);
        if (this.els.timerBar) {
            this.els.timerBar.style.width = `${pct * 100}%`;
            this.els.timerBar.className = 'timer-fill' + (pct < 0.25 ? ' critical' : pct < 0.5 ? ' warning' : '');
        }
        if (this.els.hudTimer) {
            this.els.hudTimer.textContent = Math.max(0, Math.ceil(g.roundTimer / 1000)) + 's';
        }
    }

    _updateBuzz() {
        const g = this.game;
        if (!this.els.buzzP1 || !this.els.buzzP2) return;

        if (g.buzzedPlayer === 0) {
            this.els.buzzP1.classList.remove('disabled', 'buzzed');
            this.els.buzzP2.classList.remove('disabled', 'buzzed');
        } else if (g.buzzedPlayer === 1) {
            this.els.buzzP1.classList.add('buzzed');
            this.els.buzzP1.classList.remove('disabled');
            this.els.buzzP2.classList.add('disabled');
            this.els.buzzP2.classList.remove('buzzed');
        } else {
            this.els.buzzP2.classList.add('buzzed');
            this.els.buzzP2.classList.remove('disabled');
            this.els.buzzP1.classList.add('disabled');
            this.els.buzzP1.classList.remove('buzzed');
        }
    }

    _showGameOver() {
        const g = this.game;
        if (this._lastMode === 'solo') {
            if (this.els.goTitle) this.els.goTitle.textContent = 'GAME OVER';
            if (this.els.goScore) this.els.goScore.textContent = g.score;
            if (this.els.goSubtext) this.els.goSubtext.textContent = `Level ${g.level + 1} reached`;
            if (this.els.goBest) {
                this.els.goBest.textContent = g.score >= g.highScore ? '\u{1F3C6} NEW BEST!' : `Best: ${g.highScore}`;
                this.els.goBest.classList.toggle('new-best', g.score >= g.highScore);
            }
        } else {
            const winner = g.p1Score > g.p2Score ? 'Player 1 Wins!' : g.p2Score > g.p1Score ? 'Player 2 Wins!' : 'It\'s a Tie!';
            if (this.els.goTitle) this.els.goTitle.textContent = winner;
            if (this.els.goScore) this.els.goScore.textContent = `${g.p1Score} - ${g.p2Score}`;
            if (this.els.goSubtext) this.els.goSubtext.textContent = `${TWO_PLAYER_ROUNDS} rounds played`;
            if (this.els.goBest) { this.els.goBest.textContent = ''; this.els.goBest.classList.remove('new-best'); }
        }
    }

    init() {
        this._updateScreens();
    }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('game-canvas');
    const container = document.getElementById('game-container');

    resize(canvas, container);
    window.addEventListener('resize', () => resize(canvas, container));
    window.addEventListener('orientationchange', () => setTimeout(() => resize(canvas, container), 100));

    // Show loading
    const loadScreen = document.getElementById('screen-loading');
    loadScreen?.classList.add('active');

    // Create Web Audio Manager
    const audioManager = new AudioManager();

    const imageCount = Object.keys(ASSET_MANIFEST.shapes).length;
    const audioCount = Object.keys(ASSET_MANIFEST.audio).length;
    const total = imageCount + audioCount;
    let totalLoaded = 0;

    const updateBar = () => {
        const p = totalLoaded / total;
        const bar = document.getElementById('load-bar');
        const text = document.getElementById('load-text');
        if (bar) bar.style.width = `${p * 100}%`;
        if (text) text.textContent = `Loading ${Math.floor(p * 100)}%`;
    };

    // Load images and audio in parallel
    const [images] = await Promise.all([
        loadImages((loaded, _total) => { totalLoaded = loaded; updateBar(); }),
        loadAudio(audioManager, (loaded, _total) => { totalLoaded = imageCount + loaded; updateBar(); }),
    ]);

    // Create game with AudioManager
    const game = new Game(canvas, images, audioManager);
    const ui = new UIController(game);

    loadScreen?.classList.remove('active');
    game.start();
    ui.init();
});
