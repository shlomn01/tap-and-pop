// spawner.js - Difficulty-driven spawn logic

import {
    GAME_WIDTH, GAME_HEIGHT,
    FRUITS, SPECIAL_TYPES,
    SPECIAL_SPAWN_CHANCE, BOMB_RATIO, STAR_RATIO, HEART_RATIO,
    DIFFICULTY_TABLE, DIFFICULTY_INTERVAL_MS, BASE_ENTITY_RADIUS
} from './config.js';
import { Entity } from './entities.js';
import { randomFloat, randomItem, clamp } from './utils.js';

export class Spawner {
    constructor(assets) {
        this.assets = assets;
        this.timeSinceSpawn = 0;
        this.gameTime = 0;
        this.level = 0;
    }

    reset() {
        this.timeSinceSpawn = 0;
        this.gameTime = 0;
        this.level = 0;
    }

    getDifficulty() {
        const idx = clamp(this.level, 0, DIFFICULTY_TABLE.length - 1);
        return DIFFICULTY_TABLE[idx];
    }

    update(dt, entities) {
        this.gameTime += dt;
        this.level = Math.floor(this.gameTime / DIFFICULTY_INTERVAL_MS);
        this.timeSinceSpawn += dt;

        const diff = this.getDifficulty();

        if (this.timeSinceSpawn >= diff.spawnInterval && entities.length < diff.maxOnScreen) {
            this.timeSinceSpawn = 0;
            return this.spawn(diff);
        }
        return null;
    }

    spawn(diff) {
        let config;
        let image;

        if (Math.random() < SPECIAL_SPAWN_CHANCE) {
            const roll = Math.random();
            if (roll < BOMB_RATIO) {
                config = SPECIAL_TYPES.BOMB;
            } else if (roll < BOMB_RATIO + STAR_RATIO) {
                config = SPECIAL_TYPES.STAR;
            } else {
                config = SPECIAL_TYPES.HEART;
            }
            image = this.assets?.images?.[config.type];
        } else {
            config = randomItem(FRUITS);
            image = this.assets?.images?.[config.type];
        }

        const margin = BASE_ENTITY_RADIUS * diff.radiusScale * 1.5;
        const x = randomFloat(margin, GAME_WIDTH - margin);
        const y = randomFloat(200, GAME_HEIGHT - 250);

        return new Entity(config, x, y, diff.ttl, diff.radiusScale, image);
    }
}
