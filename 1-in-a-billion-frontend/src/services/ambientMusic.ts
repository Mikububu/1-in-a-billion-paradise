import { Audio } from 'expo-av';
import { useMusicStore } from '@/store/musicStore';

class AmbientMusicService {
    private sound: Audio.Sound | null = null;
    private isLoading = false;

    async load() {
        if (this.sound || this.isLoading) {
            return;
        }
        this.isLoading = true;

        try {
            console.log('🎵 AmbientMusic: Loading intro music...');
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/one_in_a_billion.mp3'),
                { isLooping: true, shouldPlay: false, volume: 1.0 }
            );
            this.sound = sound;
            useMusicStore.getState().setIsMusicLoaded(true);
            const isPlayingState = useMusicStore.getState().isPlaying;

            // If store says we should be playing, start it
            if (isPlayingState) {
                await this.play();
            }
        } catch (error) {
            console.warn('🎵 AmbientMusic: Failed to load music', error);
        } finally {
            this.isLoading = false;
        }
    }

    async play() {
        if (!this.sound) {
            return;
        }
        try {
            const status = await this.sound.getStatusAsync();
            const isLoaded = status.isLoaded;
            const isPlaying = status.isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            if (isLoaded && !isPlaying) {
                await this.sound.setVolumeAsync(1.0);
                await this.sound.playAsync();
                useMusicStore.getState().setIsPlaying(true);
            }
        } catch (error) {
            console.warn('🎵 AmbientMusic: Play error', error);
        }
    }

    async pause() {
        if (!this.sound) return;
        try {
            const status = await this.sound.getStatusAsync();
            const isLoaded = status.isLoaded;
            const isPlaying = isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            if (isLoaded && isPlaying) {
                await this.sound.pauseAsync();
                useMusicStore.getState().setIsPlaying(false);
            }
        } catch (error) {
            console.warn('🎵 AmbientMusic: Pause error', error);
        }
    }

    async fadeOut(duration = 2000) {
        if (!this.sound) return;
        try {
            const status = await this.sound.getStatusAsync();
            const isLoaded = status.isLoaded;
            const isPlaying = isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            if (!isLoaded || !isPlaying) return;

            console.log(`🎵 AmbientMusic: Fading out over ${duration}ms...`);
            const steps = 20;
            const stepDuration = duration / steps;

            for (let i = steps; i >= 0; i--) {
                if (!this.sound) break;
                await this.sound.setVolumeAsync(i / steps);
                await new Promise(resolve => setTimeout(resolve, stepDuration));
            }

            await this.pause();
            // Reset volume for next time if needed, or leave at 0 if we reset on play
            if (this.sound) await this.sound.setVolumeAsync(1.0);
        } catch (error) {
            console.warn('🎵 AmbientMusic: Fade out error', error);
        }
    }

    async fadeAndPause(duration = 4000) {
        // Convenience method: fade out and pause
        await this.fadeOut(duration);
    }

    async stop() {
        if (!this.sound) return;
        try {
            await this.sound.stopAsync();
            await this.sound.unloadAsync();
            this.sound = null;
            useMusicStore.getState().setIsMusicLoaded(false);
            useMusicStore.getState().setIsPlaying(false);
        } catch (error) {
            console.warn('🎵 AmbientMusic: Stop error', error);
        }
    }
}

export const AmbientMusic = new AmbientMusicService();
