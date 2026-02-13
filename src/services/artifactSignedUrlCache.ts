import { createArtifactSignedUrl } from '@/services/jobArtifacts';

type SignedUrlCacheEntry = {
    signedUrl: string;
    expiresAtMs: number;
};

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60;
const REFRESH_BUFFER_MS = 60 * 1000;
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

const shouldReuse = (entry: SignedUrlCacheEntry | undefined) => {
    if (!entry) return false;
    return entry.expiresAtMs - REFRESH_BUFFER_MS > Date.now();
};

export async function getCachedArtifactSignedUrl(
    storagePath: string,
    expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS
): Promise<string | null> {
    if (!storagePath) return null;

    const cached = signedUrlCache.get(storagePath);
    if (shouldReuse(cached)) {
        return cached!.signedUrl;
    }

    const pending = inFlight.get(storagePath);
    if (pending) {
        return pending;
    }

    const request = (async () => {
        const signedUrl = await createArtifactSignedUrl(storagePath, expiresInSeconds);
        if (signedUrl) {
            signedUrlCache.set(storagePath, {
                signedUrl,
                expiresAtMs: Date.now() + expiresInSeconds * 1000,
            });
        }
        return signedUrl;
    })();

    inFlight.set(storagePath, request);
    try {
        return await request;
    } finally {
        inFlight.delete(storagePath);
    }
}

export async function prewarmArtifactSignedUrls(
    storagePaths: string[],
    expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS
): Promise<void> {
    const uniquePaths = Array.from(
        new Set(storagePaths.filter((path) => Boolean(path && path.trim())))
    );

    await Promise.all(
        uniquePaths.map((path) => getCachedArtifactSignedUrl(path, expiresInSeconds).catch(() => null))
    );
}

export function clearArtifactSignedUrlCache() {
    signedUrlCache.clear();
    inFlight.clear();
}
