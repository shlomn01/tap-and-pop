// renderer.js - Canvas drawing, DPR scaling, screen shake

import { GAME_WIDTH, GAME_HEIGHT, SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY } from './config.js';
import { randomFloat } from './utils.js';

class Renderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.dpr = 1;
        this.shakeTimer = 0;
        this.shakeIntensity = SCREEN_SHAKE_INTENSITY;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
    }

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        canvas.width = GAME_WIDTH * this.dpr;
        canvas.height = GAME_HEIGHT * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        // CSS size handled by style.css
        canvas.style.width = '';
        canvas.style.height = '';
    }

    shake(intensity = SCREEN_SHAKE_INTENSITY) {
        this.shakeTimer = SCREEN_SHAKE_DURATION;
        this.shakeIntensity = intensity;
    }

    updateShake(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const progress = this.shakeTimer / SCREEN_SHAKE_DURATION;
            const currentIntensity = this.shakeIntensity * progress;
            this.shakeOffsetX = randomFloat(-currentIntensity, currentIntensity);
            this.shakeOffsetY = randomFloat(-currentIntensity, currentIntensity);
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    beginFrame() {
        this.ctx.save();
        this.ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    endFrame() {
        this.ctx.restore();
    }

    drawBackground(bgImage) {
        if (bgImage) {
            this.ctx.drawImage(bgImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
        } else {
            // Fallback gradient
            const grad = this.ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
            grad.addColorStop(0, '#fce4ec');
            grad.addColorStop(0.5, '#e1f5fe');
            grad.addColorStop(1, '#f3e5f5');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
    }

    drawSprite(image, x, y, width, height, alpha = 1, rotation = 0) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.translate(x, y);
        if (rotation) this.ctx.rotate(rotation);
        this.ctx.drawImage(image, -width / 2, -height / 2, width, height);
        this.ctx.restore();
    }

    drawCircle(x, y, radius, color, alpha = 1) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawText(text, x, y, font, color, align = 'center', alpha = 1) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';

        // Text outline for readability
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(text, x, y);
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }
}

export const renderer = new Renderer();
