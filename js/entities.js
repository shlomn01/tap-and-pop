// entities.js - Fruit, Bomb, Star, Heart classes with hit detection & TTL

import { BASE_ENTITY_RADIUS } from './config.js';
import { distance, randomFloat } from './utils.js';

export class Entity {
    constructor(config, x, y, ttl, radiusScale, image) {
        this.type = config.type;
        this.points = config.points;
        this.color = config.color;
        this.x = x;
        this.y = y;
        this.baseRadius = BASE_ENTITY_RADIUS * (config.radius || 1) * radiusScale;
        this.radius = 0; // starts at 0 for pop-in animation
        this.targetRadius = this.baseRadius;
        this.image = image;
        this.ttl = ttl;
        this.maxTtl = ttl;
        this.alive = true;
        this.popping = false;
        this.popProgress = 0;
        this.alpha = 1;
        this.rotation = randomFloat(-0.3, 0.3);
        this.wobblePhase = randomFloat(0, Math.PI * 2);
        this.wobbleSpeed = randomFloat(2, 4);
        this.spawnProgress = 0;

        // Floating animation
        this.floatY = 0;
        this.floatSpeed = randomFloat(1.5, 3);
        this.floatAmplitude = randomFloat(3, 8);
    }

    get isSpecial() {
        return this.type === 'star' || this.type === 'bomb' || this.type === 'heart';
    }

    hitTest(x, y) {
        return distance(x, y, this.x, this.y + this.floatY) <= this.radius;
    }

    pop() {
        if (this.popping) return;
        this.popping = true;
        this.popProgress = 0;
    }

    expire() {
        this.alive = false;
    }

    update(dt) {
        const dtSec = dt / 1000;

        // Spawn-in animation
        if (this.spawnProgress < 1) {
            this.spawnProgress += dt / 300;
            if (this.spawnProgress > 1) this.spawnProgress = 1;
            // Elastic pop-in
            const t = this.spawnProgress;
            const elastic = t < 0.5
                ? 2 * t * t
                : 1 - Math.pow(-2 * t + 2, 2) / 2;
            this.radius = this.targetRadius * Math.min(elastic * 1.2, 1);
        }

        // Floating animation
        this.wobblePhase += dtSec * this.wobbleSpeed;
        this.floatY = Math.sin(this.wobblePhase) * this.floatAmplitude;

        // TTL countdown
        this.ttl -= dt;

        // Fade out when TTL is low
        if (this.ttl < 500 && !this.popping) {
            this.alpha = Math.max(0, this.ttl / 500);
            // Blink effect
            if (this.ttl < 300) {
                this.alpha *= (Math.sin(this.ttl / 30) + 1) / 2;
            }
        }

        if (this.ttl <= 0 && !this.popping) {
            this.expire();
        }

        // Pop animation
        if (this.popping) {
            this.popProgress += dt / 200;
            if (this.popProgress >= 1) {
                this.alive = false;
            } else {
                this.radius = this.targetRadius * (1 + this.popProgress * 0.5);
                this.alpha = 1 - this.popProgress;
            }
        }
    }

    draw(renderer) {
        if (!this.alive) return;

        const drawY = this.y + this.floatY;

        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
            const size = this.radius * 2;
            renderer.drawSprite(
                this.image,
                this.x, drawY,
                size, size,
                this.alpha,
                this.rotation * 0.3 * Math.sin(this.wobblePhase)
            );
        } else {
            // Fallback: draw colored circle
            renderer.drawCircle(this.x, drawY, this.radius, this.color, this.alpha);

            // Draw type label
            renderer.drawText(
                this.type === 'bomb' ? '💣' : this.type === 'star' ? '⭐' : this.type === 'heart' ? '❤️' : this.type.charAt(0).toUpperCase(),
                this.x, drawY,
                `bold ${Math.round(this.radius * 0.8)}px Arial`,
                '#fff',
                'center',
                this.alpha
            );
        }
    }
}
