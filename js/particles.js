// particles.js - Burst particles & floating score text

import { PARTICLE_COUNT, PARTICLE_LIFETIME, FLOAT_TEXT_LIFETIME } from './config.js';
import { randomFloat, hexToRgb } from './utils.js';

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const rgb = hexToRgb(color);
        this.r = rgb.r;
        this.g = rgb.g;
        this.b = rgb.b;
        this.radius = randomFloat(3, 8);
        this.lifetime = PARTICLE_LIFETIME;
        this.elapsed = 0;

        const angle = randomFloat(0, Math.PI * 2);
        const speed = randomFloat(100, 350);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.gravity = 400;
        this.alive = true;
    }

    update(dt) {
        const dtSec = dt / 1000;
        this.elapsed += dt;
        if (this.elapsed >= this.lifetime) {
            this.alive = false;
            return;
        }
        this.vx *= 0.98;
        this.vy += this.gravity * dtSec;
        this.x += this.vx * dtSec;
        this.y += this.vy * dtSec;
    }

    draw(renderer) {
        const progress = this.elapsed / this.lifetime;
        const alpha = 1 - progress;
        const r = this.radius * (1 - progress * 0.5);
        const color = `rgb(${this.r},${this.g},${this.b})`;
        renderer.drawCircle(this.x, this.y, r, color, alpha);
    }
}

class FloatingText {
    constructor(x, y, text, color, size = 36) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.lifetime = FLOAT_TEXT_LIFETIME;
        this.elapsed = 0;
        this.alive = true;
        this.vy = -120;
    }

    update(dt) {
        const dtSec = dt / 1000;
        this.elapsed += dt;
        if (this.elapsed >= this.lifetime) {
            this.alive = false;
            return;
        }
        this.y += this.vy * dtSec;
        this.vy *= 0.97;
    }

    draw(renderer) {
        const progress = this.elapsed / this.lifetime;
        const alpha = 1 - progress;
        const scale = 1 + progress * 0.3;
        const size = Math.round(this.size * scale);
        renderer.drawText(
            this.text,
            this.x, this.y,
            `bold ${size}px 'Fredoka One', Arial`,
            this.color,
            'center',
            alpha
        );
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.texts = [];
    }

    burst(x, y, color, count = PARTICLE_COUNT) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    addFloatingText(x, y, text, color, size) {
        this.texts.push(new FloatingText(x, y, text, color, size));
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].alive) {
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            this.texts[i].update(dt);
            if (!this.texts[i].alive) {
                this.texts.splice(i, 1);
            }
        }
    }

    draw(renderer) {
        for (const p of this.particles) p.draw(renderer);
        for (const t of this.texts) t.draw(renderer);
    }

    clear() {
        this.particles = [];
        this.texts = [];
    }
}

export const particleSystem = new ParticleSystem();
