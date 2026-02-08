// main.js - Entry point: asset loading, game init, UI wiring

import { GAME_WIDTH, GAME_HEIGHT, ASSET_MANIFEST } from './config.js';
import { Game, State, AudioManager } from './game.js';
import { initLang, toggleLang, getLang, t } from './i18n.js';

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
        this._instrSeen = this._loadInstrSeen();
        this._pendingGameStart = null;
        this._lastSavedEntry = null;
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
            btnSound: $('btn-sound'),
            btnLang: $('btn-lang'),
            btnHowToPlay: $('btn-how-to-play'),
            hudScore: $('hud-score'),
            hudLives: $('hud-lives'),
            hudLevel: $('hud-level'),
            hudTimer: $('hud-timer'),
            timerBar: $('timer-bar'),
            goTitle: $('go-title'),
            goScore: $('go-score'),
            goSubtext: $('go-subtext'),
            goBest: $('go-best'),
            btnReplay: $('btn-replay'),
            btnMenu: $('btn-menu'),
            instructions: $('instructions-panel'),
            btnCloseInstructions: $('btn-close-instructions'),
            // Leaderboard
            nameEntry: $('name-entry'),
            nameEntryLabel: $('name-entry-label'),
            nameInput: $('name-input'),
            btnSaveName: $('btn-save-name'),
            btnSaveLabel: $('btn-save-label'),
            leaderboard: $('leaderboard'),
            lbTitle: $('lb-title'),
            lbList: $('lb-list'),
            // i18n text elements
            menuTitle: $('menu-title'),
            menuSubtitle: $('menu-subtitle'),
            btnSoloLabel: $('btn-solo-label'),
            btnSoloDesc: $('btn-solo-desc'),
            instrTitle: $('instr-title'),
            instrSoloTitle: $('instr-solo-title'),
            instrSoloBody: $('instr-solo-body'),
            instrTipTitle: $('instr-tip-title'),
            instrTipBody: $('instr-tip-body'),
        };
    }

    _loadInstrSeen() {
        try { return localStorage.getItem('spotshape_instr_seen') === '1'; }
        catch { return false; }
    }

    _markInstrSeen() {
        this._instrSeen = true;
        try { localStorage.setItem('spotshape_instr_seen', '1'); } catch {}
    }

    _bind() {
        this._musicStarted = false;
        const startMusic = () => {
            if (!this._musicStarted) {
                this._musicStarted = true;
                this.game.startMenuMusic();
            }
        };

        this.els.btnSolo?.addEventListener('click', () => {
            startMusic();
            if (!this._instrSeen) {
                this._pendingGameStart = () => this.game.startSolo();
                this.els.instructions?.classList.add('visible');
            } else {
                this.game.startSolo();
            }
        });
        this.els.btnReplay?.addEventListener('click', () => {
            this.game.startSolo();
        });
        this.els.btnMenu?.addEventListener('click', () => this.game.goToMenu());

        this.els.menu?.addEventListener('click', () => startMusic());
        this.els.menu?.addEventListener('touchstart', () => startMusic(), { passive: true });
        this.els.btnSound?.addEventListener('click', () => {
            startMusic();
            const on = this.game.toggleSound();
            this.els.btnSound.textContent = on ? '\u{1F50A}' : '\u{1F507}';
            this.els.btnSound.classList.toggle('muted', !on);
        });

        this.els.btnLang?.addEventListener('click', () => {
            toggleLang();
            this._updateAllText();
        });

        this.els.btnHowToPlay?.addEventListener('click', () => {
            this._pendingGameStart = null;
            this.els.instructions?.classList.add('visible');
        });

        this.els.btnCloseInstructions?.addEventListener('click', () => {
            this._hideInstructions();
            this._markInstrSeen();
            if (this._pendingGameStart) {
                const cb = this._pendingGameStart;
                this._pendingGameStart = null;
                cb();
            }
        });

        // Save name button
        this.els.btnSaveName?.addEventListener('click', () => {
            this._saveLeaderboardEntry();
        });
        this.els.nameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this._saveLeaderboardEntry();
            }
        });
    }

    _saveLeaderboardEntry() {
        const name = this.els.nameInput?.value?.trim();
        if (!name) return;
        const g = this.game;
        const entry = g.saveToLeaderboard(name, g.score, g.level + 1);
        this._lastSavedEntry = entry;
        if (this.els.nameEntry) this.els.nameEntry.style.display = 'none';
        this._renderLeaderboard(entry);
    }

    _hideInstructions() {
        this.els.instructions?.classList.remove('visible');
    }

    _wire() {
        this.game.onStateChange = () => this._updateScreens();
        this.game.onScoreChange = () => this._updateScores();
        this.game.onTimerChange = () => this._updateTimer();
    }

    _updateAllText() {
        const lang = getLang();
        if (this.els.btnLang) this.els.btnLang.textContent = lang === 'he' ? '\u{1F1EC}\u{1F1E7}' : '\u{1F1EE}\u{1F1F1}';
        if (this.els.menuTitle) this.els.menuTitle.innerHTML = t('menu.title').replace('\n', '<br>');
        if (this.els.menuSubtitle) this.els.menuSubtitle.textContent = t('menu.subtitle');
        if (this.els.btnSoloLabel) this.els.btnSoloLabel.textContent = t('menu.solo');
        if (this.els.btnSoloDesc) this.els.btnSoloDesc.textContent = t('menu.soloDesc');
        if (this.els.highScore) this.els.highScore.textContent = t('menu.best', this.game.highScore);
        if (this.els.btnHowToPlay) this.els.btnHowToPlay.textContent = t('menu.howToPlay');
        // Instructions
        if (this.els.instrTitle) this.els.instrTitle.textContent = t('instr.title');
        if (this.els.instrSoloTitle) this.els.instrSoloTitle.textContent = t('instr.soloTitle');
        if (this.els.instrSoloBody) this.els.instrSoloBody.textContent = t('instr.soloBody');
        if (this.els.instrTipTitle) this.els.instrTipTitle.textContent = t('instr.tipTitle');
        if (this.els.instrTipBody) this.els.instrTipBody.textContent = t('instr.tipBody');
        // Close instructions button
        const closeBtn = this.els.btnCloseInstructions?.querySelector('.btn-label');
        if (closeBtn) closeBtn.textContent = t('instr.gotIt');
        // Game over buttons
        const replayLabel = this.els.btnReplay?.querySelector('.btn-label');
        if (replayLabel) replayLabel.textContent = t('gameover.playAgain');
        const menuLabel = this.els.btnMenu?.querySelector('.btn-label');
        if (menuLabel) menuLabel.textContent = t('gameover.menu');
        // HUD level
        if (this.els.hudLevel) this.els.hudLevel.textContent = t('hud.level', this.game.level + 1);
        // Leaderboard texts
        if (this.els.lbTitle) this.els.lbTitle.textContent = t('leaderboard.title');
        if (this.els.nameEntryLabel) this.els.nameEntryLabel.textContent = t('leaderboard.enterName');
        if (this.els.btnSaveLabel) this.els.btnSaveLabel.textContent = t('leaderboard.save');
    }

    showLoading(progress) {
        if (this.els.loadBar) this.els.loadBar.style.width = `${progress * 100}%`;
        if (this.els.loadText) this.els.loadText.textContent = t('loading.text', Math.floor(progress * 100));
    }

    hideLoading() {
        this.els.loading?.classList.remove('active');
    }

    _updateScreens() {
        const state = this.game.state;
        ['loading', 'menu', 'hud', 'gameOver'].forEach(s => this.els[s]?.classList.remove('active'));

        switch (state) {
            case State.MENU:
                this.els.menu?.classList.add('active');
                if (this.els.highScore) this.els.highScore.textContent = t('menu.best', this.game.highScore);
                break;
            case State.PLAYING_SOLO:
            case State.ROUND_TRANSITION:
                this.els.hud?.classList.add('active');
                break;
            case State.GAME_OVER:
                this.els.gameOver?.classList.add('active');
                this._showGameOver();
                break;
        }
    }

    _updateScores() {
        const g = this.game;
        if (this.els.hudScore) this.els.hudScore.textContent = g.score;
        if (this.els.hudLives) {
            let h = '';
            for (let i = 0; i < 3; i++) h += `<span class="life ${i < g.lives ? '' : 'lost'}">\u2764\uFE0F</span>`;
            this.els.hudLives.innerHTML = h;
        }
        if (this.els.hudLevel) this.els.hudLevel.textContent = t('hud.level', g.level + 1);
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

    _showGameOver() {
        const g = this.game;
        this._lastSavedEntry = null;

        if (this.els.goTitle) this.els.goTitle.textContent = t('gameover.title');
        if (this.els.goScore) this.els.goScore.textContent = g.score;
        if (this.els.goSubtext) this.els.goSubtext.textContent = t('gameover.levelReached', g.level + 1);
        if (this.els.goBest) {
            this.els.goBest.textContent = g.score >= g.highScore ? t('gameover.newBest') : t('gameover.best', g.highScore);
            this.els.goBest.classList.toggle('new-best', g.score >= g.highScore);
        }

        // Leaderboard title
        if (this.els.lbTitle) this.els.lbTitle.textContent = t('leaderboard.title');
        if (this.els.nameEntryLabel) this.els.nameEntryLabel.textContent = t('leaderboard.enterName');
        if (this.els.btnSaveLabel) this.els.btnSaveLabel.textContent = t('leaderboard.save');

        // Check if score qualifies for leaderboard
        if (g.isHighScore(g.score)) {
            if (this.els.nameEntry) this.els.nameEntry.style.display = 'block';
            if (this.els.nameInput) {
                this.els.nameInput.value = '';
                setTimeout(() => this.els.nameInput.focus(), 300);
            }
        } else {
            if (this.els.nameEntry) this.els.nameEntry.style.display = 'none';
        }

        this._renderLeaderboard(null);
    }

    _renderLeaderboard(highlightEntry) {
        const lb = this.game.getLeaderboard();
        const list = this.els.lbList;
        if (!list) return;

        if (lb.length === 0) {
            list.innerHTML = `<div class="lb-empty">${t('leaderboard.empty')}</div>`;
            return;
        }

        list.innerHTML = lb.map((entry, i) => {
            const isHighlighted = highlightEntry &&
                entry.name === highlightEntry.name &&
                entry.score === highlightEntry.score &&
                entry.date === highlightEntry.date;
            const rankLabel = i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : `${i + 1}`;
            return `<div class="lb-row${isHighlighted ? ' lb-highlight' : ''}">
                <span class="lb-rank">${rankLabel}</span>
                <span class="lb-name">${this._escapeHtml(entry.name)}</span>
                <span class="lb-score">${entry.score}</span>
                <span class="lb-level">LV ${entry.level}</span>
            </div>`;
        }).join('');
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    init() {
        this._updateAllText();
        this._updateScreens();
    }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', async () => {
    initLang();

    const canvas = document.getElementById('game-canvas');
    const container = document.getElementById('game-container');

    resize(canvas, container);
    window.addEventListener('resize', () => resize(canvas, container));
    window.addEventListener('orientationchange', () => setTimeout(() => resize(canvas, container), 100));

    const loadScreen = document.getElementById('screen-loading');
    loadScreen?.classList.add('active');

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
        if (text) text.textContent = t('loading.text', Math.floor(p * 100));
    };

    const [images] = await Promise.all([
        loadImages((loaded, _total) => { totalLoaded = loaded; updateBar(); }),
        loadAudio(audioManager, (loaded, _total) => { totalLoaded = imageCount + loaded; updateBar(); }),
    ]);

    const game = new Game(canvas, images, audioManager);
    const ui = new UIController(game);

    loadScreen?.classList.remove('active');
    game.start();
    ui.init();
});
