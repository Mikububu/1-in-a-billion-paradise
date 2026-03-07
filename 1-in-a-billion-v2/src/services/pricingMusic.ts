import { Audio } from 'expo-av';

class PricingMusicService {
    private sound: Audio.Sound | null = null;
    private isLoading = false;
    private isPlaying = false;

    async load() {
        if (this.sound || this.isLoading) {
            return;
        }
        this.isLoading = true;

        try {
            console.log('🎵 PricingMusic: Loading pricing music...');

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/one_in_a_billion_2.mp3'),
                { isLooping: true, shouldPlay: false, volume: 1.0 }
            );
            this.sound = sound;

            if (this.isPlaying) {
                await this.play();
            }
        } catch (error) {
            console.warn('🎵 PricingMusic: Failed to load music', error);
        } finally {
            this.isLoading = false;
        }
    }

    async play() {
        this.isPlaying = true;
        if (!this.sound) {
            return;
        }
        try {
            const status = await this.sound.getStatusAsync();
            const isLoaded = status.isLoaded;
            const currentlyPlaying = isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            if (isLoaded && !currentlyPlaying) {
                await this.sound.setVolumeAsync(1.0);
                await this.sound.playAsync();
            }
        } catch (error) {
            console.warn('🎵 PricingMusic: Play error', error);
        }
    }

    async pause() {
        this.isPlaying = false;
        if (!this.sound) return;
        try {
            const status = await this.sound.getStatusAsync();
            const isLoaded = status.isLoaded;
            const currentlyPlaying = isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            if (isLoaded && currentlyPlaying) {
                await this.sound.pauseAsync();
            }
        } catch (error) {
            console.warn('🎵 PricingMusic: Pause error', error);
        }
    }

    async restart(volume = 1.0) {
        this.isPlaying = true;
        if (!this.sound) return;
        try {
            await this.sound.setPositionAsync(0);
            await this.sound.setVolumeAsync(volume);
            await this.sound.playAsync();
        } catch (error) {
            console.warn('🎵 PricingMusic: Restart error', error);
        }
    }

    async fadeIn(duration = 2000) {
        if (!this.sound) return;
        try {
            const status = await this.sound.getStatusAsync();
            if (!status.isLoaded) return;

            console.log(`🎵 PricingMusic: Fading in over ${duration}ms...`);
            const steps = 20;
            const stepDuration = duration / steps;

            for (let i = 0; i <= steps; i++) {
                if (!this.sound || !this.isPlaying) break;
                const fadeStatus = await this.sound.getStatusAsync();
                if (!fadeStatus.isLoaded) return;
                await this.sound.setVolumeAsync(i / steps);
                await new Promise(resolve => setTimeout(resolve, stepDuration));
            }
        } catch (error) {
            console.warn('🎵 PricingMusic: Fade in error', error);
        }
    }

    async fadeOut(duration = 2000) {
        if (!this.sound) return;
        try {
            const status = await this.sound.getStatusAsync();
            const isLoaded = status.isLoaded;
            const currentlyPlaying = isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            if (!isLoaded || !currentlyPlaying) return;

            console.log(`🎵 PricingMusic: Fading out over ${duration}ms...`);
            const steps = 20;
            const stepDuration = duration / steps;

            for (let i = steps; i >= 0; i--) {
                if (!this.sound) break;
                const fadeStatus = await this.sound.getStatusAsync();
                if (!fadeStatus.isLoaded) return;
                await this.sound.setVolumeAsync(i / steps);
                await new Promise(resolve => setTimeout(resolve, stepDuration));
            }

            await this.pause();
            if (this.sound) await this.sound.setVolumeAsync(1.0);
        } catch (error) {
            console.warn('🎵 PricingMusic: Fade out error', error);
        }
    }

    async stop() {
        this.isPlaying = false;
        if (!this.sound) return;
        try {
            await this.sound.stopAsync();
            await this.sound.unloadAsync();
            this.sound = null;
        } catch (error) {
            console.warn('🎵 PricingMusic: Stop error', error);
        }
    }
}

export const PricingMusic = new PricingMusicService();
