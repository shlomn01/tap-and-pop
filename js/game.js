// game.js - State machine & game loop

import {
    MAX_LIVES, COMBO_WINDOW_MS, MAX_COMBO_MULTIPLIER,
    GAME_WIDTH, GAME_HEIGHT
} from './config.js';
import { renderer } from './renderer.js';
import { inputManager } from './input.js';
import { audioManager } from './audio.js';
import { particleSystem } from './particles.js';
import { tweenManager } from './tween.js';
import { Spawner } from './spawner.js';
import { getHighScore, setHighScore } from './storage.js';

export const GameState = {
    LOADING: 'LOADING',
    SPLASH: 'SPLASH',
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER',
};

export class Game {
    constructor(assets, ui) {
        this.assets = assets;
        this.ui = ui;
        this.state = GameState.LOADING;
        this.entities = [];
        this.spawner = new Spawner(assets);

        // Score state
        this.score = 0;
        this.lives = MAX_LIVES;
        this.combo = 0;
        this.comboMultiplier = 1;
        this.lastPopTime = 0;
        this.highScore = getHighScore();
        this.isNewBest = false;

        // Timing
        this.lastTime = 0;
        this.rafId = null;

        this._setupInput();
    }

    _setupInput() {
        inputManager.onTap((x, y) => {
            switch (this.state) {
                case GameState.SPLASH:
                    this._startMenu();
                    break;
                case GameState.PLAYING:
                    this._handleGameTap(x, y);
                    break;
                default:
                    break;
            }
        });
    }

    start() {
        this.setState(GameState.SPLASH);
        this.lastTime = performance.now();
        this._loop(this.lastTime);
    }

    setState(newState) {
        this.state = newState;
        this.ui.showScreen(newState);

        switch (newState) {
            case GameState.SPLASH:
                audioManager.stopMusic();
                break;
            case GameState.MENU:
                this.highScore = getHighScore();
                this.ui.updateHighScore(this.highScore);
                audioManager.playMusic('menuMusic');
                break;
            case GameState.PLAYING:
                audioManager.playMusic('gameMusic');
                break;
            case GameState.GAME_OVER:
                audioManager.stopMusic();
                audioManager.playSound('gameOver');
                break;
        }
    }

    _startMenu() {
        audioManager.resumeContext();
        audioManager.playSound('btnClick');
        this.setState(GameState.MENU);
    }

    startGame() {
        this.score = 0;
        this.lives = MAX_LIVES;
        this.combo = 0;
        this.comboMultiplier = 1;
        this.lastPopTime = 0;
        this.isNewBest = false;
        this.entities = [];
        this.spawner.reset();
        particleSystem.clear();
        tweenManager.clear();

        this.ui.updateScore(0);
        this.ui.updateLives(MAX_LIVES);
        this.ui.updateCombo(1);
        this.ui.updateLevel(1);

        audioManager.playSound('btnClick');
        this.setState(GameState.PLAYING);
    }

    _handleGameTap(x, y) {
        // Check entities from top (newest) to bottom
        let hit = false;
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            if (!entity.alive || entity.popping) continue;

            if (entity.hitTest(x, y)) {
                hit = true;
                this._popEntity(entity);
                break; // Only pop the topmost entity
            }
        }
    }

    _popEntity(entity) {
        entity.pop();

        const now = performance.now();
        const drawY = entity.y + entity.floatY;

        if (entity.type === 'bomb') {
            // Bomb! Lose a life
            this._loseLife();
            audioManager.playSound('bombExplode');
            renderer.shake(12);
            particleSystem.burst(entity.x, drawY, '#333', 20);
            particleSystem.addFloatingText(entity.x, drawY, 'BOOM!', '#ef4444', 44);
            this.combo = 0;
            this.comboMultiplier = 1;
            this.ui.updateCombo(1);
            this._vibrate(100);
            return;
        }

        if (entity.type === 'heart') {
            // Gain a life (up to max)
            if (this.lives < MAX_LIVES) {
                this.lives++;
                this.ui.updateLives(this.lives);
            }
            audioManager.playSound('heartCollect');
            particleSystem.burst(entity.x, drawY, '#ec4899', 15);
            particleSystem.addFloatingText(entity.x, drawY, '+1 ❤️', '#ec4899', 38);
            this._vibrate(30);
            return;
        }

        // Star or Fruit - score points
        // Update combo
        if (now - this.lastPopTime < COMBO_WINDOW_MS) {
            this.combo++;
            this.comboMultiplier = Math.min(1 + Math.floor(this.combo / 2), MAX_COMBO_MULTIPLIER);
        } else {
            this.combo = 0;
            this.comboMultiplier = 1;
        }
        this.lastPopTime = now;

        const points = entity.points * this.comboMultiplier;
        this.score += points;

        this.ui.updateScore(this.score);
        this.ui.updateCombo(this.comboMultiplier);

        if (entity.type === 'star') {
            audioManager.playSound('starCollect');
            particleSystem.burst(entity.x, drawY, '#fbbf24', 20);
            renderer.shake(4);
        } else {
            audioManager.playSound('pop');
            particleSystem.burst(entity.x, drawY, entity.color, 12);
        }

        const textColor = this.comboMultiplier > 1 ? '#f97316' : '#fff';
        const textSize = 30 + this.comboMultiplier * 4;
        let label = `+${points}`;
        if (this.comboMultiplier > 1) label += ` x${this.comboMultiplier}`;
        particleSystem.addFloatingText(entity.x, drawY - 30, label, textColor, textSize);

        this._vibrate(15);
    }

    _loseLife() {
        this.lives--;
        this.ui.updateLives(this.lives);
        audioManager.playSound('lifeLost');
        this._vibrate(80);

        if (this.lives <= 0) {
            this._gameOver();
        }
    }

    _gameOver() {
        this.isNewBest = setHighScore(this.score);
        this.highScore = getHighScore();
        this.ui.showGameOver(this.score, this.highScore, this.isNewBest);
        this.setState(GameState.GAME_OVER);
    }

    _vibrate(ms) {
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    _loop(timestamp) {
        const dt = Math.min(timestamp - this.lastTime, 50); // Cap at 50ms
        this.lastTime = timestamp;

        this._update(dt);
        this._render();

        this.rafId = requestAnimationFrame((t) => this._loop(t));
    }

    _update(dt) {
        tweenManager.update(dt);
        renderer.updateShake(dt);

        if (this.state !== GameState.PLAYING) return;

        // Spawn entities
        const newEntity = this.spawner.update(dt, this.entities);
        if (newEntity) {
            this.entities.push(newEntity);
        }

        // Update level display
        const currentLevel = this.spawner.level + 1;
        this.ui.updateLevel(currentLevel);

        // Update entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            entity.update(dt);

            if (!entity.alive) {
                // Entity expired without being tapped (not popping = missed)
                if (!entity.popping && entity.type !== 'bomb') {
                    // Missed a fruit/star - lose a life (not for bombs or hearts)
                    if (entity.type !== 'heart') {
                        this._loseLife();
                    }
                }
                this.entities.splice(i, 1);
            }
        }

        // Update particles
        particleSystem.update(dt);
    }

    _render() {
        renderer.clear();
        renderer.beginFrame();

        // Background
        renderer.drawBackground(this.assets?.images?.background);

        if (this.state === GameState.PLAYING || this.state === GameState.GAME_OVER) {
            // Draw entities
            for (const entity of this.entities) {
                entity.draw(renderer);
            }

            // Draw particles
            particleSystem.draw(renderer);
        }

        renderer.endFrame();
    }
}
