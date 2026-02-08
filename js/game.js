// game.js - Spot the Shape game engine

import {
    GAME_WIDTH, GAME_HEIGHT, SHAPES, DIFFICULTY_TABLE,
    BOARD_TOP, BOARD_BOTTOM, TARGET_AREA_Y, PARTICLE_COUNT,
    TWO_PLAYER_SHAPES, TWO_PLAYER_SPEED, TWO_PLAYER_MIN_SIZE,
    TWO_PLAYER_MAX_SIZE, TWO_PLAYER_ROUNDS, BUZZ_TIMEOUT_MS,
    STORAGE_KEY
} from './config.js';
import { t, shapeName, getLang } from './i18n.js';

export const State = {
    LOADING: 'LOADING',
    MENU: 'MENU',
    PLAYING_SOLO: 'PLAYING_SOLO',
    PLAYING_DUO: 'PLAYING_DUO',
    DUO_BUZZED: 'DUO_BUZZED',
    ROUND_TRANSITION: 'ROUND_TRANSITION',
    GAME_OVER: 'GAME_OVER',
};

// --- Floating Shape on the board ---
class BoardShape {
    constructor(type, x, y, size, speed, image) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = speed;
        this.image = image;
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleAmp = 3 + Math.random() * 8;
        this.rotation = (Math.random() - 0.5) * 0.3;
        this.rotSpeed = (Math.random() - 0.5) * 0.4;
        this.scale = 1;
        this.alpha = 1;
        this.highlighted = false;
        this.highlightTimer = 0;
    }

    update(dt) {
        const dtSec = dt / 1000;
        this.x += this.speed * dtSec;
        this.wobblePhase += dtSec * 2;
        this.rotation += this.rotSpeed * dtSec;

        const margin = this.size;
        if (this.speed > 0 && this.x > GAME_WIDTH + margin) this.x = -margin;
        if (this.speed < 0 && this.x < -margin) this.x = GAME_WIDTH + margin;

        if (this.highlightTimer > 0) {
            this.highlightTimer -= dt;
        }
    }

    hitTest(px, py) {
        const dy = this.y + Math.sin(this.wobblePhase) * this.wobbleAmp;
        const dx = px - this.x;
        const ddy = py - dy;
        const hitRadius = this.size * 0.55; // slightly generous
        return (dx * dx + ddy * ddy) < (hitRadius * hitRadius);
    }

    draw(ctx) {
        const drawY = this.y + Math.sin(this.wobblePhase) * this.wobbleAmp;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, drawY);
        ctx.rotate(this.rotation);
        const s = this.size * this.scale;

        if (this.highlighted && this.highlightTimer > 0) {
            ctx.shadowColor = '#22C55E';
            ctx.shadowBlur = 25;
        }

        if (this.image && this.image.complete) {
            ctx.drawImage(this.image, -s / 2, -s / 2, s, s);
        } else {
            ctx.fillStyle = '#888';
            ctx.fillRect(-s / 2, -s / 2, s, s);
        }
        ctx.restore();
    }
}

// --- Particle burst ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.color = color;
        this.r = 3 + Math.random() * 7;
        this.life = 500 + Math.random() * 300;
        this.elapsed = 0;
        const a = Math.random() * Math.PI * 2;
        const spd = 100 + Math.random() * 250;
        this.vx = Math.cos(a) * spd;
        this.vy = Math.sin(a) * spd;
    }
    update(dt) {
        const s = dt / 1000;
        this.elapsed += dt;
        this.vy += 300 * s;
        this.x += this.vx * s;
        this.y += this.vy * s;
    }
    draw(ctx) {
        const p = 1 - this.elapsed / this.life;
        if (p <= 0) return;
        ctx.globalAlpha = p;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    get alive() { return this.elapsed < this.life; }
}

// --- Floating score text ---
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color;
        this.life = 900;
        this.elapsed = 0;
        this.startScale = 1.5;
    }
    update(dt) {
        this.elapsed += dt;
        this.y -= dt * 0.09;
    }
    draw(ctx) {
        const p = 1 - this.elapsed / this.life;
        if (p <= 0) return;
        const scale = this.startScale - (this.startScale - 1) * Math.min(1, this.elapsed / 150);
        ctx.save();
        ctx.globalAlpha = p;
        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);
        ctx.font = 'bold 34px "Fredoka One", "Rubik", Arial';
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.fillText(this.text, 0, 0);
        // Outline
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeText(this.text, 0, 0);
        ctx.restore();
    }
    get alive() { return this.elapsed < this.life; }
}

// --- Simple Audio Manager using HTML5 Audio ---
// Uses plain Audio elements - the most reliable cross-browser approach.
// Music: single Audio element with loop.
// SFX: pool of Audio elements for overlapping sounds.
export class AudioManager {
    constructor() {
        this._urls = {};        // name -> url mapping
        this._sfxPool = {};     // name -> [Audio, Audio, ...]
        this._music = null;     // current music Audio element
        this._currentMusic = null; // name of current music
        this._muted = false;
        this._musicVolume = 0.5;
        this._pendingMusic = null; // music to play after user gesture
        this._userInteracted = false;
        this._setupGestureUnlock();
        console.log('[Audio] AudioManager created');
    }

    _setupGestureUnlock() {
        const handler = () => {
            this._userInteracted = true;
            console.log('[Audio] User interacted');
            // If there's pending music, play it now
            if (this._pendingMusic && !this._muted) {
                this._doPlayMusic(this._pendingMusic.name, this._pendingMusic.volume);
                this._pendingMusic = null;
            }
        };
        ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach(e => {
            document.addEventListener(e, handler, { capture: true, passive: true });
        });
    }

    // "Load" just means storing the URL - Audio elements load on demand
    async loadBuffer(name, url) {
        this._urls[name] = url;
        // Pre-create SFX pool (3 copies for overlapping)
        if (!url.includes('music')) {
            this._sfxPool[name] = [];
            for (let i = 0; i < 3; i++) {
                const a = new Audio(url);
                a.preload = 'auto';
                a.volume = 0.8;
                this._sfxPool[name].push(a);
            }
        }
        console.log(`[Audio] Registered: ${name} -> ${url}`);
    }

    playSFX(name, volume = 1) {
        if (this._muted) return;
        const pool = this._sfxPool[name];
        if (!pool || pool.length === 0) {
            console.warn(`[Audio] No SFX pool for: ${name}`);
            return;
        }
        // Find a free audio element (one that's ended or paused)
        let audio = pool.find(a => a.paused || a.ended);
        if (!audio) {
            // All busy - clone a new one
            audio = pool[0].cloneNode();
            pool.push(audio);
        }
        audio.volume = Math.min(1, volume * 0.8);
        audio.currentTime = 0;
        const p = audio.play();
        if (p) p.catch(() => {}); // Ignore autoplay errors for SFX
    }

    playMusic(name, volume = 0.5) {
        if (this._muted) return;
        this._musicVolume = volume;

        // If same music already playing, skip
        if (this._currentMusic === name && this._music && !this._music.paused) {
            console.log(`[Audio] Music already playing: ${name}`);
            return;
        }

        // If user hasn't interacted yet, queue it
        if (!this._userInteracted) {
            console.log(`[Audio] Queuing music until user interaction: ${name}`);
            this._pendingMusic = { name, volume };
            return;
        }

        this._doPlayMusic(name, volume);
    }

    _doPlayMusic(name, volume) {
        const url = this._urls[name];
        if (!url) {
            console.warn(`[Audio] No URL for music: ${name}`);
            return;
        }

        console.log(`[Audio] Playing music: ${name} from ${url}`);

        // Stop current music
        this.stopMusic();

        // Create new audio element
        this._music = new Audio(url);
        this._music.loop = true;
        this._music.volume = Math.min(1, volume);
        this._currentMusic = name;

        const p = this._music.play();
        if (p) {
            p.then(() => console.log(`[Audio] Music started: ${name}`))
             .catch(err => {
                console.warn(`[Audio] Music play failed: ${err.message}`);
                // Queue for next interaction
                this._pendingMusic = { name, volume };
            });
        }
    }

    stopMusic() {
        this._pendingMusic = null;
        if (this._music) {
            this._music.pause();
            this._music.currentTime = 0;
            this._music.src = '';
            this._music = null;
            this._currentMusic = null;
            console.log('[Audio] Music stopped');
        }
    }

    resume() {
        // If music was pending, try to play it now
        if (this._pendingMusic && !this._muted) {
            this._userInteracted = true;
            this._doPlayMusic(this._pendingMusic.name, this._pendingMusic.volume);
            this._pendingMusic = null;
        }
    }

    setMuted(muted) {
        this._muted = muted;
        if (muted) {
            this.stopMusic();
        }
        // Mute/unmute all SFX pools
        for (const pool of Object.values(this._sfxPool)) {
            for (const a of pool) a.muted = muted;
        }
    }
}

// --- Background star / sparkle ---
class BgStar {
    constructor() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.r = 0.5 + Math.random() * 1.5;
        this.alpha = 0.1 + Math.random() * 0.3;
        this.speed = 0.2 + Math.random() * 0.5;
        this.phase = Math.random() * Math.PI * 2;
        this.twinkleSpeed = 1 + Math.random() * 2;
    }
    update(dt) {
        this.phase += (dt / 1000) * this.twinkleSpeed;
    }
    draw(ctx) {
        const a = this.alpha * (0.5 + 0.5 * Math.sin(this.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#c4b5fd';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// --- Main Game ---
export class Game {
    constructor(canvas, images, audioManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.images = images;
        this.am = audioManager; // Web Audio Manager
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        canvas.width = GAME_WIDTH * this.dpr;
        canvas.height = GAME_HEIGHT * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        this.state = State.MENU;
        this.shapes = [];
        this.particles = [];
        this.floatingTexts = [];
        this.targetShape = null;
        this.score = 0;
        this.level = 0;
        this.lives = 3;
        this.roundTimer = 0;
        this.roundTimerMax = 0;
        this.highScore = this._loadHighScore();
        this.transitionTimer = 0;
        this.transitionText = '';
        this.shakeTimer = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this._globalTime = 0;

        // Background stars
        this._bgStars = [];
        for (let i = 0; i < 50; i++) this._bgStars.push(new BgStar());

        // Two-player state
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 0;
        this.buzzedPlayer = 0;
        this.buzzTimer = 0;

        // Callbacks for UI
        this.onStateChange = null;
        this.onScoreChange = null;
        this.onTimerChange = null;
        this.onBuzzChange = null;

        this.lastTime = 0;
        this._soundEnabled = true;

        this._bindInput();
    }

    _playSound(name, vol) {
        if (!this._soundEnabled) return;
        this.am.playSFX(name, vol);
    }

    _playMusic(name, vol) {
        if (!this._soundEnabled) return;
        this.am.playMusic(name, vol);
    }

    _stopMusic() {
        this.am.stopMusic();
    }

    toggleSound() {
        this.am.resume();
        this._soundEnabled = !this._soundEnabled;
        this.am.setMuted(!this._soundEnabled);
        if (this._soundEnabled) {
            if (this.state === State.MENU) this._playMusic('menuMusic', 0.5);
            else if (this.state === State.PLAYING_SOLO || this.state === State.PLAYING_DUO || this.state === State.DUO_BUZZED) {
                this._playMusic('gameMusic', 0.5);
            }
        } else {
            this._stopMusic();
        }
        return this._soundEnabled;
    }

    _loadHighScore() {
        try { return parseInt(localStorage.getItem(STORAGE_KEY)) || 0; }
        catch { return 0; }
    }

    _saveHighScore(s) {
        try { if (s > this.highScore) { localStorage.setItem(STORAGE_KEY, s); this.highScore = s; return true; } }
        catch {}
        return false;
    }

    _bindInput() {
        const handler = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = GAME_WIDTH / rect.width;
            const scaleY = GAME_HEIGHT / rect.height;
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            const gx = (clientX - rect.left) * scaleX;
            const gy = (clientY - rect.top) * scaleY;
            this._handleTap(gx, gy);
        };

        this.canvas.addEventListener('pointerdown', handler, { passive: false });
    }

    _handleTap(x, y) {
        if (this.state === State.PLAYING_SOLO) {
            this._handleSoloTap(x, y);
        } else if (this.state === State.DUO_BUZZED) {
            this._handleDuoBuzzedTap(x, y);
        }
        // In PLAYING_DUO state, taps on canvas are ignored - players must use buzz buttons
    }

    // --- Game flow ---

    startSolo() {
        this.am.resume();
        this._playSound('btnClick');
        this.state = State.PLAYING_SOLO;
        this.score = 0;
        this.level = 0;
        this.lives = 3;
        this._setupRound();
        this._playMusic('gameMusic');
        this.onStateChange?.();
        this.onScoreChange?.();
    }

    startDuo() {
        this.am.resume();
        this._playSound('btnClick');
        this.state = State.PLAYING_DUO;
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 0;
        this.buzzedPlayer = 0;
        this._setupDuoRound();
        this._playMusic('gameMusic');
        this.onStateChange?.();
        this.onScoreChange?.();
    }

    _randomSize(minSize, maxSize) {
        // Create dramatic size variation: some tiny, some huge
        // Use weighted random: 30% small, 40% medium, 20% large, 10% extra large
        const r = Math.random();
        const range = maxSize - minSize;
        if (r < 0.3) {
            // Small: 50%-70% of min
            return minSize * (0.5 + Math.random() * 0.2);
        } else if (r < 0.7) {
            // Medium: normal range
            return minSize + Math.random() * range;
        } else if (r < 0.9) {
            // Large: 1.5x-2.5x of max
            return maxSize * (1.5 + Math.random() * 1.0);
        } else {
            // Extra large: 2.5x-4x of max
            return maxSize * (2.5 + Math.random() * 1.5);
        }
    }

    _setupRound() {
        const diff = DIFFICULTY_TABLE[Math.min(this.level, DIFFICULTY_TABLE.length - 1)];
        this.shapes = [];
        this.particles = [];
        this.floatingTexts = [];

        const available = [...SHAPES];
        const boardTypes = [];
        for (let i = 0; i < diff.shapeCount && available.length > 0; i++) {
            const idx = Math.floor(Math.random() * available.length);
            boardTypes.push(available.splice(idx, 1)[0]);
        }

        this.targetShape = boardTypes[Math.floor(Math.random() * boardTypes.length)];

        const rows = Math.ceil(diff.shapeCount / 4);
        for (let i = 0; i < boardTypes.length; i++) {
            const type = boardTypes[i];
            const size = this._randomSize(diff.minSize, diff.maxSize);
            const row = Math.floor(i / 4);
            const rowHeight = (BOARD_BOTTOM - BOARD_TOP) / rows;
            const y = BOARD_TOP + rowHeight * row + Math.random() * rowHeight * 0.5 + rowHeight * 0.25;
            const x = Math.random() * GAME_WIDTH;
            const direction = (row % 2 === 0) ? 1 : -1;
            // Bigger shapes move slower, smaller move faster
            const sizeRatio = diff.minSize / size;
            const speed = (diff.speed + Math.random() * diff.speed * 0.4) * direction * (0.5 + sizeRatio * 0.8);
            this.shapes.push(new BoardShape(type, x, y, size, speed, this.images[type]));
        }

        this.roundTimer = diff.timeLimit * 1000;
        this.roundTimerMax = diff.timeLimit * 1000;
        this.onTimerChange?.();
    }

    _setupDuoRound() {
        this.currentRound++;
        this.buzzedPlayer = 0;
        this.buzzTimer = 0;
        this.shapes = [];
        this.particles = [];
        this.floatingTexts = [];

        const available = [...SHAPES];
        const boardTypes = [];
        for (let i = 0; i < TWO_PLAYER_SHAPES && available.length > 0; i++) {
            const idx = Math.floor(Math.random() * available.length);
            boardTypes.push(available.splice(idx, 1)[0]);
        }

        this.targetShape = boardTypes[Math.floor(Math.random() * boardTypes.length)];

        const rows = Math.ceil(TWO_PLAYER_SHAPES / 4);
        for (let i = 0; i < boardTypes.length; i++) {
            const type = boardTypes[i];
            const size = this._randomSize(TWO_PLAYER_MIN_SIZE, TWO_PLAYER_MAX_SIZE);
            const row = Math.floor(i / 4);
            const rowHeight = (BOARD_BOTTOM - BOARD_TOP) / rows;
            const y = BOARD_TOP + rowHeight * row + Math.random() * rowHeight * 0.5 + rowHeight * 0.25;
            const x = Math.random() * GAME_WIDTH;
            const direction = (row % 2 === 0) ? 1 : -1;
            const sizeRatio = TWO_PLAYER_MIN_SIZE / size;
            const speed = (TWO_PLAYER_SPEED + Math.random() * 30) * direction * (0.5 + sizeRatio * 0.8);
            this.shapes.push(new BoardShape(type, x, y, size, speed, this.images[type]));
        }

        this.roundTimer = 15000;
        this.roundTimerMax = 15000;
        this.onTimerChange?.();
        this.onScoreChange?.();
        this.onBuzzChange?.();
    }

    // Called by UI buzz buttons
    duoBuzz(player) {
        if (this.state !== State.PLAYING_DUO) return;
        if (this.buzzedPlayer !== 0) return;
        this.am.resume();
        this.buzzedPlayer = player;
        this.buzzTimer = BUZZ_TIMEOUT_MS;
        this.state = State.DUO_BUZZED;
        this._playSound('buzz');
        this.onStateChange?.();
        this.onBuzzChange?.();
    }

    _handleSoloTap(x, y) {
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (shape.hitTest(x, y)) {
                if (shape.type === this.targetShape) {
                    this._correctTapSolo(shape);
                } else {
                    this._wrongTapSolo(shape);
                }
                return;
            }
        }
    }

    _handleDuoBuzzedTap(x, y) {
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (shape.hitTest(x, y)) {
                if (shape.type === this.targetShape) {
                    this._correctTapDuo(shape);
                } else {
                    this._wrongTapDuo(shape);
                }
                return;
            }
        }
    }

    _correctTapSolo(shape) {
        this._playSound('correct');
        this._burstParticles(shape.x, shape.y, ['#22C55E', '#4ADE80', '#86EFAC', '#FDE047', '#FBBF24']);

        shape.highlighted = true;
        shape.highlightTimer = 500;

        const points = Math.max(10, Math.ceil(this.roundTimer / 100));
        this.score += points;
        this.level++;
        this.floatingTexts.push(new FloatingText(shape.x, shape.y, `+${points}`, '#22C55E'));
        this.onScoreChange?.();
        this._playSound('roundWin');
        this._showTransition(t('game.level', this.level + 1), 1200, State.PLAYING_SOLO);
    }

    _wrongTapSolo(shape) {
        this._playSound('wrong');
        this.shakeTimer = 200;
        this._burstParticles(shape.x, shape.y, ['#EF4444', '#F87171', '#FCA5A5']);
        this.floatingTexts.push(new FloatingText(shape.x, shape.y, '✗', '#EF4444'));

        this.lives--;
        this.onScoreChange?.();
        if (this.lives <= 0) {
            this._gameOver();
        }
        if (navigator.vibrate) navigator.vibrate(50);
    }

    _correctTapDuo(shape) {
        this._playSound('correct');
        this._burstParticles(shape.x, shape.y, ['#22C55E', '#4ADE80', '#86EFAC', '#FDE047']);
        shape.highlighted = true;
        shape.highlightTimer = 500;

        const player = this.buzzedPlayer;
        if (player === 1) this.p1Score++;
        else this.p2Score++;
        this.floatingTexts.push(new FloatingText(shape.x, shape.y, `P${player} +1`, player === 1 ? '#F87171' : '#60A5FA'));
        this._playSound('roundWin');
        this.onScoreChange?.();

        if (this.currentRound >= TWO_PLAYER_ROUNDS) {
            this._gameOver();
        } else {
            this._showTransition(t('game.round', this.currentRound + 1), 1200, State.PLAYING_DUO);
        }
    }

    _wrongTapDuo(shape) {
        this._playSound('wrong');
        this.shakeTimer = 200;
        this._burstParticles(shape.x, shape.y, ['#EF4444', '#F87171']);

        const player = this.buzzedPlayer;
        const opponent = player === 1 ? 2 : 1;
        // Opponent gets the point
        if (opponent === 1) this.p1Score++;
        else this.p2Score++;
        this.floatingTexts.push(new FloatingText(shape.x, shape.y, `P${opponent} +1`, opponent === 1 ? '#F87171' : '#60A5FA'));
        this.onScoreChange?.();

        if (this.currentRound >= TWO_PLAYER_ROUNDS) {
            this._gameOver();
        } else {
            this._showTransition(t('game.round', this.currentRound + 1), 1200, State.PLAYING_DUO);
        }

        if (navigator.vibrate) navigator.vibrate(50);
    }

    _burstParticles(x, y, colors) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            this.particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]));
        }
    }

    _showTransition(text, duration, nextState) {
        this.transitionText = text;
        this.transitionTimer = duration;
        this.state = State.ROUND_TRANSITION;
        this.buzzedPlayer = 0;
        this.onStateChange?.();
        this.onBuzzChange?.();

        setTimeout(() => {
            if (nextState === State.PLAYING_SOLO) {
                this.state = State.PLAYING_SOLO;
                this._setupRound();
            } else {
                this.state = State.PLAYING_DUO;
                this._setupDuoRound();
            }
            this.onStateChange?.();
        }, duration);
    }

    _gameOver() {
        this._stopMusic();
        this._playSound('gameOver');
        if (this.state === State.PLAYING_SOLO || (this.state !== State.PLAYING_DUO && this.state !== State.DUO_BUZZED)) {
            this._saveHighScore(this.score);
        }
        this.buzzedPlayer = 0;
        this.state = State.GAME_OVER;
        this.onStateChange?.();
    }

    goToMenu() {
        this.am.resume();
        this._playSound('btnClick');
        this.state = State.MENU;
        this.highScore = this._loadHighScore();
        this._playMusic('menuMusic');
        this.onStateChange?.();
    }

    // --- Update & Render ---

    update(dt) {
        this._globalTime += dt;

        // Animate background stars
        for (const star of this._bgStars) star.update(dt);

        // Shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const intensity = 8 * (this.shakeTimer / 200);
            this.shakeX = (Math.random() - 0.5) * intensity * 2;
            this.shakeY = (Math.random() - 0.5) * intensity * 2;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        const isActive = this.state === State.PLAYING_SOLO || this.state === State.PLAYING_DUO || this.state === State.DUO_BUZZED;

        if (isActive) {
            for (const s of this.shapes) s.update(dt);
            this.particles = this.particles.filter(p => { p.update(dt); return p.alive; });
            this.floatingTexts = this.floatingTexts.filter(t => { t.update(dt); return t.alive; });

            this.roundTimer -= dt;
            this.onTimerChange?.();

            if (this.roundTimer <= 0) {
                if (this.state === State.PLAYING_SOLO) {
                    this.lives--;
                    this._playSound('wrong');
                    this.shakeTimer = 200;
                    this.onScoreChange?.();
                    if (this.lives <= 0) {
                        this._gameOver();
                    } else {
                        this._showTransition(t('game.timesUp'), 1000, State.PLAYING_SOLO);
                    }
                } else if (this.state === State.DUO_BUZZED) {
                    // Buzzed player ran out of time - opponent scores
                    const opponent = this.buzzedPlayer === 1 ? 2 : 1;
                    if (opponent === 1) this.p1Score++;
                    else this.p2Score++;
                    this._playSound('wrong');
                    this.shakeTimer = 200;
                    this.onScoreChange?.();

                    if (this.currentRound >= TWO_PLAYER_ROUNDS) {
                        this._gameOver();
                    } else {
                        this._showTransition(t('game.timesUp'), 1000, State.PLAYING_DUO);
                    }
                } else {
                    // Duo mode - no one buzzed in time
                    if (this.currentRound >= TWO_PLAYER_ROUNDS) {
                        this._gameOver();
                    } else {
                        this._showTransition(t('game.timesUp'), 1000, State.PLAYING_DUO);
                    }
                }
            }

            // Buzz timer countdown in DUO_BUZZED state
            if (this.state === State.DUO_BUZZED) {
                this.buzzTimer -= dt;
                if (this.buzzTimer <= 0) {
                    // Buzzed player failed to find shape in time
                    const opponent = this.buzzedPlayer === 1 ? 2 : 1;
                    if (opponent === 1) this.p1Score++;
                    else this.p2Score++;
                    this._playSound('wrong');
                    this.onScoreChange?.();

                    if (this.currentRound >= TWO_PLAYER_ROUNDS) {
                        this._gameOver();
                    } else {
                        this._showTransition(t('game.tooSlow'), 1000, State.PLAYING_DUO);
                    }
                }
            }
        }

        if (this.state === State.ROUND_TRANSITION) {
            this.transitionTimer -= dt;
            for (const s of this.shapes) s.update(dt);
            this.particles = this.particles.filter(p => { p.update(dt); return p.alive; });
            this.floatingTexts = this.floatingTexts.filter(t => { t.update(dt); return t.alive; });
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.shakeX, this.shakeY);

        // Background gradient - richer deep space feel
        const grad = ctx.createLinearGradient(0, 0, GAME_WIDTH * 0.3, GAME_HEIGHT);
        grad.addColorStop(0, '#080c1a');
        grad.addColorStop(0.3, '#12103a');
        grad.addColorStop(0.6, '#1a0f35');
        grad.addColorStop(1, '#080c1a');
        ctx.fillStyle = grad;
        ctx.fillRect(-10, -10, GAME_WIDTH + 20, GAME_HEIGHT + 20);

        // Ambient glow orbs (subtle, animated)
        const t = this._globalTime / 1000;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Purple orb
        const orbX1 = GAME_WIDTH * 0.2 + Math.sin(t * 0.3) * 80;
        const orbY1 = GAME_HEIGHT * 0.3 + Math.cos(t * 0.25) * 60;
        const orbGrad1 = ctx.createRadialGradient(orbX1, orbY1, 0, orbX1, orbY1, 200);
        orbGrad1.addColorStop(0, 'rgba(99,102,241,0.06)');
        orbGrad1.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGrad1;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Pink orb
        const orbX2 = GAME_WIDTH * 0.8 + Math.cos(t * 0.35) * 70;
        const orbY2 = GAME_HEIGHT * 0.7 + Math.sin(t * 0.2) * 50;
        const orbGrad2 = ctx.createRadialGradient(orbX2, orbY2, 0, orbX2, orbY2, 180);
        orbGrad2.addColorStop(0, 'rgba(236,72,153,0.04)');
        orbGrad2.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGrad2;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();

        // Background stars
        for (const star of this._bgStars) star.draw(ctx);

        // Subtle grid with cross-fade
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.035)';
        ctx.lineWidth = 1;
        for (let x = 0; x < GAME_WIDTH; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); ctx.stroke();
        }
        for (let y = 0; y < GAME_HEIGHT; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); ctx.stroke();
        }

        const isPlayState = this.state === State.PLAYING_SOLO || this.state === State.PLAYING_DUO ||
                           this.state === State.DUO_BUZZED || this.state === State.ROUND_TRANSITION;

        if (isPlayState) {
            // Board area glow border
            ctx.save();
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([10, 6]);
            const bx = 12, by = BOARD_TOP - 10, bw = GAME_WIDTH - 24, bh = BOARD_BOTTOM - BOARD_TOP + 20;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 16);
            ctx.stroke();
            ctx.setLineDash([]);
            // Soft vignette inside board
            const vig = ctx.createRadialGradient(GAME_WIDTH/2, (BOARD_TOP+BOARD_BOTTOM)/2, 50, GAME_WIDTH/2, (BOARD_TOP+BOARD_BOTTOM)/2, GAME_WIDTH*0.6);
            vig.addColorStop(0, 'transparent');
            vig.addColorStop(1, 'rgba(8,12,26,0.15)');
            ctx.fillStyle = vig;
            ctx.fillRect(0, BOARD_TOP - 20, GAME_WIDTH, BOARD_BOTTOM - BOARD_TOP + 40);
            ctx.restore();

            // Draw shapes
            for (const s of this.shapes) s.draw(ctx);

            // Draw particles
            for (const p of this.particles) p.draw(ctx);

            // Draw floating texts
            for (const t of this.floatingTexts) t.draw(ctx);

            // Target area
            this._drawTargetArea(ctx);

            // Duo buzzed overlay
            if (this.state === State.DUO_BUZZED) {
                this._drawBuzzOverlay(ctx);
            }
        }

        // Transition text with glow ring
        if (this.state === State.ROUND_TRANSITION && this.transitionTimer > 0) {
            ctx.save();
            const progress = 1 - this.transitionTimer / 1200;
            const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
            ctx.globalAlpha = alpha;

            // Expanding ring
            const ringR = 40 + progress * 120;
            const ringGrad = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, ringR - 5, GAME_WIDTH/2, GAME_HEIGHT/2, ringR + 20);
            ringGrad.addColorStop(0, 'rgba(99,102,241,0.2)');
            ringGrad.addColorStop(0.5, 'rgba(139,92,246,0.1)');
            ringGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = ringGrad;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

            ctx.font = 'bold 64px "Fredoka One", "Rubik", Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(99, 102, 241, 0.9)';
            ctx.shadowBlur = 40;
            const scale = progress < 0.15 ? 0.5 + (progress / 0.15) * 0.5 : 1;
            ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2);
            ctx.scale(scale, scale);
            ctx.fillText(this.transitionText, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }

    _drawTargetArea(ctx) {
        const panelY = TARGET_AREA_Y - 40;
        const panelH = 160;
        const panelX = 20;
        const panelW = GAME_WIDTH - 40;

        ctx.save();

        // Outer glow
        ctx.shadowColor = 'rgba(99,102,241,0.15)';
        ctx.shadowBlur = 30;

        // Glass panel background
        const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        panelGrad.addColorStop(0, 'rgba(20, 16, 58, 0.88)');
        panelGrad.addColorStop(0.5, 'rgba(25, 22, 65, 0.92)');
        panelGrad.addColorStop(1, 'rgba(12, 17, 38, 0.9)');
        ctx.fillStyle = panelGrad;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 22);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border with gradient
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Top highlight line
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 21);
        ctx.clip();
        const hlGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        hlGrad.addColorStop(0, 'transparent');
        hlGrad.addColorStop(0.3, 'rgba(255,255,255,0.06)');
        hlGrad.addColorStop(0.7, 'rgba(255,255,255,0.06)');
        hlGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(panelX, panelY, panelW, 2);
        ctx.restore();

        // Layout: RTL-aware
        const isRTL = getLang() === 'he';
        const findLabel = t('game.find');

        if (isRTL) {
            // RTL: shape name on right, image in middle, FIND label on left
            ctx.font = 'bold 22px "Fredoka One", "Rubik", Arial';
            ctx.fillStyle = 'rgba(129, 140, 248, 0.85)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(findLabel, panelX + panelW - 28, panelY + panelH / 2);

            if (this.targetShape && this.images[this.targetShape]) {
                const img = this.images[this.targetShape];
                const size = 110;
                const tx = panelX + panelW - 148;
                const ty = panelY + panelH / 2;

                const pulse = 0.7 + 0.3 * Math.sin(this._globalTime / 400);
                ctx.shadowColor = `rgba(129,140,248,${0.4 * pulse})`;
                ctx.shadowBlur = 25 + pulse * 10;
                ctx.drawImage(img, tx - size / 2, ty - size / 2, size, size);
                ctx.shadowBlur = 0;

                ctx.font = 'bold 24px "Fredoka One", "Rubik", Arial';
                ctx.fillStyle = '#E2E8F0';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(shapeName(this.targetShape), tx - size / 2 - 12, ty);
            }
        } else {
            // LTR layout (original)
            ctx.font = 'bold 22px "Fredoka One", "Rubik", Arial';
            ctx.fillStyle = 'rgba(129, 140, 248, 0.85)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(findLabel, 48, panelY + panelH / 2);

            if (this.targetShape && this.images[this.targetShape]) {
                const img = this.images[this.targetShape];
                const size = 110;
                const tx = 200;
                const ty = panelY + panelH / 2;

                const pulse = 0.7 + 0.3 * Math.sin(this._globalTime / 400);
                ctx.shadowColor = `rgba(129,140,248,${0.4 * pulse})`;
                ctx.shadowBlur = 25 + pulse * 10;
                ctx.drawImage(img, tx - size / 2, ty - size / 2, size, size);
                ctx.shadowBlur = 0;

                ctx.font = 'bold 24px "Fredoka One", "Rubik", Arial';
                ctx.fillStyle = '#E2E8F0';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(shapeName(this.targetShape), tx + size / 2 + 12, ty);
            }
        }

        ctx.restore();
    }

    _drawBuzzOverlay(ctx) {
        // Show which player buzzed
        const player = this.buzzedPlayer;
        const color = player === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)';
        const borderColor = player === 1 ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)';
        const textColor = player === 1 ? '#F87171' : '#60A5FA';

        // Border flash
        ctx.save();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, GAME_WIDTH - 8, GAME_HEIGHT - 8);

        // Buzz timer indicator
        const pct = Math.max(0, this.buzzTimer / BUZZ_TIMEOUT_MS);
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, GAME_HEIGHT - 8, GAME_WIDTH * pct, 8);

        // "P1/P2 is looking!" text
        ctx.font = 'bold 20px "Fredoka One", "Rubik", Arial';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(t('game.playerLooking', player), GAME_WIDTH / 2, BOARD_TOP - 45);
        ctx.restore();
    }

    // Called from UI on first user interaction to start menu music
    startMenuMusic() {
        this.am.resume();
        this._playMusic('menuMusic');
    }

    // --- Game loop ---
    start() {
        this.lastTime = performance.now();
        this._loop();
    }

    _loop() {
        const now = performance.now();
        const dt = Math.min(now - this.lastTime, 50);
        this.lastTime = now;

        this.update(dt);
        this.render();

        requestAnimationFrame(() => this._loop());
    }
}
