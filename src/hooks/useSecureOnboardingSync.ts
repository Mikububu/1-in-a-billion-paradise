import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import type { HookAudioType } from '@/services/hookAudioCloud';

const TYPES: HookAudioType[] = ['sun', 'moon', 'rising'];

export const useSecureOnboardingSync = () => {
    const user = useAuthStore((s) => s.user);
    const isAuthReady = useAuthStore((s) => s.isAuthReady);
    const hookAudio = useOnboardingStore((s) => s.hookAudio);
    const setHookAudio = useOnboardingStore((s) => s.setHookAudio);
    const people = useProfileStore((s) => s.people);

    useEffect(() => {
        if (!isAuthReady || !user) return;

        const mainUser = people.find((p) => p.isUser);
        if (!mainUser?.id) return;
        const existingPaths = mainUser.hookAudioPaths || {};

        TYPES.forEach((type) => {
            const path = existingPaths[type];
            if (!path) return;
            const current = hookAudio[type];
            if (current !== path) {
                setHookAudio(type, path);
            }
        });
    }, [hookAudio, isAuthReady, people, setHookAudio, user]);
};
