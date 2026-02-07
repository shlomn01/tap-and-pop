// storage.js - localStorage high score persistence

import { STORAGE_KEY } from './config.js';

export function getHighScore() {
    try {
        const val = localStorage.getItem(STORAGE_KEY);
        return val ? parseInt(val, 10) : 0;
    } catch {
        return 0;
    }
}

export function setHighScore(score) {
    try {
        const current = getHighScore();
        if (score > current) {
            localStorage.setItem(STORAGE_KEY, score.toString());
            return true; // new best
        }
        return false;
    } catch {
        return false;
    }
}
