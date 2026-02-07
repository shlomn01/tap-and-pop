// audio.js - Sound pool & music crossfade

class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = {};
        this.currentMusic = null;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.masterVolume = 1.0;
        this.musicVolume = 0.4;
        this.sfxVolume = 0.7;
        this.poolSize = 4;
    }

    registerSound(name, audioBuffer) {
        // Create a pool of audio clones for overlapping playback
        this.sounds[name] = {
            pool: [],
            index: 0,
            src: audioBuffer.src,
        };
        for (let i = 0; i < this.poolSize; i++) {
            const clone = audioBuffer.cloneNode(true);
            clone.volume = this.sfxVolume * this.masterVolume;
            this.sounds[name].pool.push(clone);
        }
    }

    registerMusic(name, audioElement) {
        audioElement.loop = true;
        audioElement.volume = this.musicVolume * this.masterVolume;
        this.music[name] = audioElement;
    }

    playSound(name) {
        if (!this.soundEnabled) return;
        const sound = this.sounds[name];
        if (!sound) return;

        const audio = sound.pool[sound.index];
        audio.currentTime = 0;
        audio.volume = this.sfxVolume * this.masterVolume;
        audio.play().catch(() => {});
        sound.index = (sound.index + 1) % sound.pool.length;
    }

    playMusic(name) {
        if (!this.musicEnabled) return;
        if (this.currentMusic === name) return;

        this.stopMusic();
        const track = this.music[name];
        if (track) {
            track.currentTime = 0;
            track.volume = this.musicVolume * this.masterVolume;
            track.play().catch(() => {});
            this.currentMusic = name;
        }
    }

    stopMusic() {
        if (this.currentMusic && this.music[this.currentMusic]) {
            this.music[this.currentMusic].pause();
            this.music[this.currentMusic].currentTime = 0;
        }
        this.currentMusic = null;
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        if (!this.soundEnabled) {
            this.musicEnabled = false;
            this.stopMusic();
        } else {
            this.musicEnabled = true;
        }
        return this.soundEnabled;
    }

    resumeContext() {
        // Resume any paused audio on user interaction
        if (this.currentMusic && this.music[this.currentMusic]) {
            this.music[this.currentMusic].play().catch(() => {});
        }
    }
}

export const audioManager = new AudioManager();
