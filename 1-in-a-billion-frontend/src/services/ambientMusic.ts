import { Audio } from 'expo-av';
import { useMusicStore } from '@/store/musicStore';

class AmbientMusicService {
    private sound: Audio.Sound | null = null;
    private isLoading = false;

    async load() {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:8',message:'load() called',data:{hasSound:!!this.sound,isLoading:this.isLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        if (this.sound || this.isLoading) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:10',message:'load() early return',data:{hasSound:!!this.sound,isLoading:this.isLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            return;
        }
        this.isLoading = true;

        try {
            console.log('🎵 AmbientMusic: Loading intro music...');
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:13',message:'Starting Audio.Sound.createAsync',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/one_in_a_billion.mp3'),
                { isLooping: true, shouldPlay: false, volume: 1.0 }
            );
            this.sound = sound;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:19',message:'Audio.Sound.createAsync success',data:{hasSound:!!this.sound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            useMusicStore.getState().setIsMusicLoaded(true);
            const isPlayingState = useMusicStore.getState().isPlaying;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:22',message:'Checking isPlaying state',data:{isPlaying:isPlayingState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion

            // If store says we should be playing, start it
            if (isPlayingState) {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:25',message:'Calling play() from load()',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                await this.play();
            }
        } catch (error) {
            console.warn('🎵 AmbientMusic: Failed to load music', error);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:27',message:'load() error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
        } finally {
            this.isLoading = false;
        }
    }

    async play() {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:32',message:'play() called',data:{hasSound:!!this.sound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (!this.sound) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:34',message:'play() early return - no sound',data:{hasSound:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            return;
        }
        try {
            const status = await this.sound.getStatusAsync();
            // #region agent log
            const isLoaded = status.isLoaded;
            const isPlaying = status.isLoaded && 'isPlaying' in status ? status.isPlaying : false;
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:37',message:'getStatusAsync result',data:{isLoaded,isPlaying},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (isLoaded && !isPlaying) {
                await this.sound.setVolumeAsync(1.0);
                await this.sound.playAsync();
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:40',message:'playAsync() called successfully',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                useMusicStore.getState().setIsPlaying(true);
            } else {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:42',message:'play() skipped - conditions not met',data:{isLoaded,isPlaying},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
            }
        } catch (error) {
            console.warn('🎵 AmbientMusic: Play error', error);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ambientMusic.ts:44',message:'play() error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
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
