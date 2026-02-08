// game.js - Spot the Shape game engine

import {
    GAME_WIDTH, GAME_HEIGHT, SHAPES, DIFFICULTY_TABLE,
    BOARD_TOP, BOARD_BOTTOM, TARGET_AREA_Y, PARTICLE_COUNT,
    TWO_PLAYER_SHAPES, TWO_PLAYER_SPEED, TWO_PLAYER_MIN_SIZE,
    TWO_PLAYER_MAX_SIZE, TWO_PLAYER_ROUNDS, BUZZ_TIMEOUT_MS,
    STORAGE_KEY
} from './config.js';

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
        this.life = 800;
        this.elapsed = 0;
    }
    update(dt) {
        this.elapsed += dt;
        this.y -= dt * 0.08;
    }
    draw(ctx) {
        const p = 1 - this.elapsed / this.life;
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha = p;
        ctx.font = 'bold 32px "Fredoka One", Arial';
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
    get alive() { return this.elapsed < this.life; }
}

// --- Main Game ---
export class Game {
    constructor(canvas, images, audio) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.images = images;
        this.audio = audio;
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

        // Two-player state
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 0;
        this.buzzedPlayer = 0; // 0=none, 1=P1, 2=P2
        this.buzzTimer = 0;

        // Callbacks for UI
        this.onStateChange = null;
        this.onScoreChange = null;
        this.onTimerChange = null;
        this.onBuzzChange = null; // Called when buzz state changes in duo mode

        this.lastTime = 0;
        this._sounds = {};
        this._musicTracks = {};
        this._currentMusic = null;
        this._soundEnabled = true;
        this._audioUnlocked = false;

        this._initAudio();
        this._bindInput();
    }

    _initAudio() {
        const sfx = ['correct', 'wrong', 'btnClick', 'roundWin', 'gameOver', 'buzz', 'tick'];
        for (const name of sfx) {
            if (this.audio[name]) {
                this._sounds[name] = [];
                for (let i = 0; i < 4; i++) {
                    const clone = this.audio[name].cloneNode(true);
                    clone.volume = 0.7;
                    this._sounds[name].push(clone);
                }
                this._sounds[name]._idx = 0;
            }
        }
        if (this.audio.menuMusic) {
            this.audio.menuMusic.loop = true;
            this.audio.menuMusic.volume = 0.4;
            this._musicTracks.menu = this.audio.menuMusic;
        }
        if (this.audio.gameMusic) {
            this.audio.gameMusic.loop = true;
            this.audio.gameMusic.volume = 0.35;
            this._musicTracks.game = this.audio.gameMusic;
        }
    }

    // Must be called from a user gesture context to unlock audio
    _unlockAudio() {
        if (this._audioUnlocked) return;
        this._audioUnlocked = true;
        // Create and play a silent audio context to unlock Web Audio
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
            ctx.resume();
        } catch (e) {}
    }

    _playSound(name) {
        if (!this._soundEnabled) return;
        const pool = this._sounds[name];
        if (!pool || pool.length === 0) return;
        const s = pool[pool._idx % pool.length];
        s.currentTime = 0;
        s.play().catch(() => {});
        pool._idx++;
    }

    _playMusic(name) {
        if (!this._soundEnabled) return;
        if (this._currentMusic === name) return;
        this._stopMusic();
        const track = this._musicTracks[name];
        if (track) {
            track.currentTime = 0;
            track.play().catch(() => {});
            this._currentMusic = name;
        }
    }

    _stopMusic() {
        for (const t of Object.values(this._musicTracks)) {
            t.pause();
            t.currentTime = 0;
        }
        this._currentMusic = null;
    }

    toggleSound() {
        this._unlockAudio();
        this._soundEnabled = !this._soundEnabled;
        if (!this._soundEnabled) {
            this._stopMusic();
        } else {
            // Resume appropriate music
            if (this.state === State.MENU) this._playMusic('menu');
            else if (this.state === State.PLAYING_SOLO || this.state === State.PLAYING_DUO || this.state === State.DUO_BUZZED) {
                this._playMusic('game');
            }
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
        this._unlockAudio();
        this._playSound('btnClick');
        this.state = State.PLAYING_SOLO;
        this.score = 0;
        this.level = 0;
        this.lives = 3;
        this._setupRound();
        this._playMusic('game');
        this.onStateChange?.();
        this.onScoreChange?.();
    }

    startDuo() {
        this._unlockAudio();
        this._playSound('btnClick');
        this.state = State.PLAYING_DUO;
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 0;
        this.buzzedPlayer = 0;
        this._setupDuoRound();
        this._playMusic('game');
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
        this._unlockAudio();
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
        this._showTransition(`Level ${this.level + 1}!`, 1200, State.PLAYING_SOLO);
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
            this._showTransition(`Round ${this.currentRound + 1}`, 1200, State.PLAYING_DUO);
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
            this._showTransition(`Round ${this.currentRound + 1}`, 1200, State.PLAYING_DUO);
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
        this._unlockAudio();
        this._playSound('btnClick');
        this.state = State.MENU;
        this.highScore = this._loadHighScore();
        this._playMusic('menu');
        this.onStateChange?.();
    }

    // --- Update & Render ---

    update(dt) {
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
                        this._showTransition('Time\'s up!', 1000, State.PLAYING_SOLO);
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
                        this._showTransition('Time\'s up!', 1000, State.PLAYING_DUO);
                    }
                } else {
                    // Duo mode - no one buzzed in time
                    if (this.currentRound >= TWO_PLAYER_ROUNDS) {
                        this._gameOver();
                    } else {
                        this._showTransition('Time\'s up!', 1000, State.PLAYING_DUO);
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
                        this._showTransition('Too slow!', 1000, State.PLAYING_DUO);
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

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e1b4b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(-10, -10, GAME_WIDTH + 20, GAME_HEIGHT + 20);

        // Subtle grid
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
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
            // Board area with subtle border
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(10, BOARD_TOP - 10, GAME_WIDTH - 20, BOARD_BOTTOM - BOARD_TOP + 20);
            ctx.setLineDash([]);

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

        // Transition text
        if (this.state === State.ROUND_TRANSITION && this.transitionTimer > 0) {
            ctx.save();
            const progress = 1 - this.transitionTimer / 1200;
            ctx.globalAlpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
            ctx.font = 'bold 64px "Fredoka One", Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
            ctx.shadowBlur = 30;
            ctx.fillText(this.transitionText, GAME_WIDTH / 2, GAME_HEIGHT / 2);
            ctx.restore();
        }

        ctx.restore();
    }

    _drawTargetArea(ctx) {
        const panelY = TARGET_AREA_Y - 40;
        const panelH = 160;

        ctx.save();

        // Glass panel background
        const panelGrad = ctx.createLinearGradient(20, panelY, 20, panelY + panelH);
        panelGrad.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
        panelGrad.addColorStop(1, 'rgba(30, 27, 75, 0.9)');
        ctx.fillStyle = panelGrad;
        ctx.beginPath();
        ctx.roundRect(20, panelY, GAME_WIDTH - 40, panelH, 20);
        ctx.fill();

        // Border glow
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // "FIND:" label
        ctx.font = 'bold 24px "Fredoka One", Arial';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('FIND:', 50, panelY + panelH / 2);

        // Target shape
        if (this.targetShape && this.images[this.targetShape]) {
            const img = this.images[this.targetShape];
            const size = 110;
            const tx = 210;
            const ty = panelY + panelH / 2;

            // Glow
            ctx.shadowColor = '#818CF8';
            ctx.shadowBlur = 30;
            ctx.drawImage(img, tx - size / 2, ty - size / 2, size, size);
            ctx.shadowBlur = 0;

            // Shape name
            ctx.font = 'bold 26px "Fredoka One", Arial';
            ctx.fillStyle = '#E2E8F0';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const name = this.targetShape.replace('_', ' ').toUpperCase();
            ctx.fillText(name, tx + size / 2 + 15, ty);
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
        ctx.font = 'bold 20px "Fredoka One", Arial';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Player ${player} is looking...`, GAME_WIDTH / 2, BOARD_TOP - 45);
        ctx.restore();
    }

    // Called from UI on first user interaction to start menu music
    startMenuMusic() {
        this._unlockAudio();
        this._playMusic('menu');
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
