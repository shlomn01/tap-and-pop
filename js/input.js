// input.js - Unified touch/mouse/pointer input handler

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';

class InputManager {
    constructor() {
        this.canvas = null;
        this.listeners = [];
        this._onTap = null;
    }

    init(canvas) {
        this.canvas = canvas;
        this._bindEvents();
    }

    onTap(callback) {
        this._onTap = callback;
    }

    _bindEvents() {
        const handler = (e) => {
            e.preventDefault();
            const coords = this._getGameCoords(e);
            if (coords && this._onTap) {
                this._onTap(coords.x, coords.y);
            }
        };

        // Prefer pointer events, fallback to touch/mouse
        if (window.PointerEvent) {
            this.canvas.addEventListener('pointerdown', handler, { passive: false });
        } else {
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const coords = this._getGameCoords(touch);
                if (coords && this._onTap) {
                    this._onTap(coords.x, coords.y);
                }
            }, { passive: false });
            this.canvas.addEventListener('mousedown', handler, { passive: false });
        }
    }

    _getGameCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = GAME_WIDTH / rect.width;
        const scaleY = GAME_HEIGHT / rect.height;

        const clientX = e.clientX !== undefined ? e.clientX : e.pageX;
        const clientY = e.clientY !== undefined ? e.clientY : e.pageY;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }
}

export const inputManager = new InputManager();
