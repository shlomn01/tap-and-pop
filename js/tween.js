// tween.js - Lightweight tween system with easing

import { easeOutCubic, easeOutElastic, easeOutQuad, easeInOutQuad } from './utils.js';

const EASING = {
    linear: t => t,
    easeOutCubic,
    easeOutElastic,
    easeOutQuad,
    easeInOutQuad,
};

class Tween {
    constructor(target, props, duration, easing = 'easeOutCubic', onComplete = null) {
        this.target = target;
        this.props = {};
        this.duration = duration;
        this.easingFn = EASING[easing] || EASING.easeOutCubic;
        this.onComplete = onComplete;
        this.elapsed = 0;
        this.done = false;

        for (const key in props) {
            this.props[key] = {
                start: target[key],
                end: props[key],
            };
        }
    }

    update(dt) {
        if (this.done) return;
        this.elapsed += dt;
        const t = Math.min(this.elapsed / this.duration, 1);
        const eased = this.easingFn(t);

        for (const key in this.props) {
            const { start, end } = this.props[key];
            this.target[key] = start + (end - start) * eased;
        }

        if (t >= 1) {
            this.done = true;
            if (this.onComplete) this.onComplete();
        }
    }
}

class TweenManager {
    constructor() {
        this.tweens = [];
    }

    add(target, props, duration, easing, onComplete) {
        const tween = new Tween(target, props, duration, easing, onComplete);
        this.tweens.push(tween);
        return tween;
    }

    update(dt) {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            this.tweens[i].update(dt);
            if (this.tweens[i].done) {
                this.tweens.splice(i, 1);
            }
        }
    }

    clear() {
        this.tweens = [];
    }
}

export const tweenManager = new TweenManager();
