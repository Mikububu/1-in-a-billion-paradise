import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { uploadHookAudioBase64, type HookAudioType } from '@/services/hookAudioCloud';
import { env } from '@/config/env';
import { isSupabaseConfigured } from '@/services/supabase';

const TYPES: HookAudioType[] = ['sun', 'moon', 'rising'];

const hasPendingBase64 = (value?: string) =>
    Boolean(value && value.length > 500 && !value.startsWith('http'));

export const useSecureOnboardingSync = () => {
    const user = useAuthStore((s) => s.user);
    const isAuthReady = useAuthStore((s) => s.isAuthReady);
    const hookAudio = useOnboardingStore((s) => s.hookAudio);
    const setHookAudio = useOnboardingStore((s) => s.setHookAudio);
    const people = useProfileStore((s) => s.people);
    const updatePerson = useProfileStore((s) => s.updatePerson);

    const [isUploading, setIsUploading] = useState(false);
    const inFlightRef = useRef(false);
    const lastAttemptAtRef = useRef(0);

    useEffect(() => {
        if (!isAuthReady || !user) return;
        if (!env.ENABLE_SUPABASE_LIBRARY_SYNC || !isSupabaseConfigured) return;
        if (isUploading || inFlightRef.current) return;

        const now = Date.now();
        if (now - lastAttemptAtRef.current < 15000) return;

        const mainUser = people.find((p) => p.isUser);
        if (!mainUser?.id) return;
        const existingPaths = mainUser.hookAudioPaths || {};

        // If cloud paths already exist, keep lightweight storage paths in onboarding store.
        // This avoids persisting massive base64 blobs and lets AudioContext sign URLs on demand.
        TYPES.forEach((type) => {
            const path = existingPaths[type];
            if (!path) return;
            const current = hookAudio[type];
            if (!current || hasPendingBase64(current) || current.startsWith('http://') || current.startsWith('https://')) {
                setHookAudio(type, path);
            }
        });

        const pendingTypes = TYPES.filter(
            (type) => hasPendingBase64(hookAudio[type]) && !existingPaths[type]
        );
        if (pendingTypes.length === 0) return;

        const uploadPendingAudio = async () => {
            inFlightRef.current = true;
            setIsUploading(true);
            lastAttemptAtRef.current = Date.now();

            try {
                const uploadedPaths: Partial<Record<HookAudioType, string>> = {};

                for (const type of pendingTypes) {
                    const base64 = hookAudio[type];
                    if (!base64) continue;

                    const result = await uploadHookAudioBase64({
                        userId: user.id,
                        personId: mainUser.id,
                        type,
                        audioBase64: base64,
                    });

                    if (!result.success) {
                        console.warn(`⚠️ [SecureOnboardingSync] ${type} upload failed: ${result.error}`);
                        continue;
                    }

                    uploadedPaths[type] = result.path;
                }

                if (Object.keys(uploadedPaths).length > 0) {
                    const latestUser = useProfileStore.getState().getUser();
                    updatePerson(mainUser.id, {
                        hookAudioPaths: {
                            ...(latestUser?.hookAudioPaths || {}),
                            ...uploadedPaths,
                        },
                    });
                }

                // Replace heavy base64 payloads in memory with lightweight storage paths.
                for (const type of TYPES) {
                    const path = uploadedPaths[type];
                    if (path) setHookAudio(type, path);
                }
            } catch (error) {
                console.warn('⚠️ [SecureOnboardingSync] upload exception', error);
            } finally {
                inFlightRef.current = false;
                setIsUploading(false);
            }
        };

        uploadPendingAudio();
    }, [hookAudio, isAuthReady, isUploading, people, setHookAudio, updatePerson, user]);
};
