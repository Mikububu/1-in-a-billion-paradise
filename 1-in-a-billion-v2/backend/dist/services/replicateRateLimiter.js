"use strict";
/**
 * REPLICATE RATE LIMITER
 *
 * Centralized, process-local pacing for Replicate API calls.
 * - Serializes Replicate requests within a process
 * - Enforces minimum spacing derived from account RPM / expected process count
 * - Applies adaptive cooldown when 429/rate-limit responses appear
 *
 * Note: this is process-local. Cross-instance coordination still depends on
 * deploy sizing and env configuration (REPLICATE_EXPECTED_PROCESSES).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReplicateRateLimitError = isReplicateRateLimitError;
exports.runReplicateWithRateLimit = runReplicateWithRateLimit;
function sleep(ms) {
    if (ms <= 0)
        return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function toErrorText(error) {
    if (!error)
        return '';
    if (error instanceof Error)
        return error.message || String(error);
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
function isReplicateRateLimitError(error) {
    const text = toErrorText(error);
    return /(^|[\s:"'])429($|[\s,"'])|throttled|rate.?limit/i.test(text);
}
function parseRetryAfterMs(error) {
    const text = toErrorText(error);
    if (!text)
        return null;
    // Common payload fragment: "retry_after":10
    const jsonMatch = text.match(/retry[_\s-]*after["']?\s*[:=]\s*["']?(\d+)/i);
    if (jsonMatch?.[1])
        return Number(jsonMatch[1]) * 1000;
    // Generic phrase: retry after 12
    const phraseMatch = text.match(/retry\s+after\s+(\d+)/i);
    if (phraseMatch?.[1])
        return Number(phraseMatch[1]) * 1000;
    // Header-ish: Retry-After: 15
    const headerMatch = text.match(/retry-after["']?\s*[:=]\s*["']?(\d+)/i);
    if (headerMatch?.[1])
        return Number(headerMatch[1]) * 1000;
    return null;
}
class ReplicateRateLimiter {
    constructor() {
        // Queue only request STARTS to preserve RPM pacing while allowing in-flight concurrency.
        this.startTail = Promise.resolve();
        this.nextAllowedAt = 0;
        this.cooldownUntil = 0;
        this.consecutiveRateLimits = 0;
        this.initialized = false;
        // Production default keeps throughput reasonable while still being overrideable via env.
        // Fixed: Paid accounts have 600 RPM limit, so defaulting to 24 needlessly cripples audio generation.
        const envAccountRpm = Number(process.env.REPLICATE_ACCOUNT_RPM || 600);
        const envExpectedProcesses = Number(process.env.REPLICATE_EXPECTED_PROCESSES || 1);
        const envDefaultCooldownMs = Number(process.env.REPLICATE_DEFAULT_COOLDOWN_MS || 12000);
        const envMaxCooldownMs = Number(process.env.REPLICATE_MAX_COOLDOWN_MS || 90000);
        this.accountRpm = Number.isFinite(envAccountRpm) ? Math.max(1, envAccountRpm) : 600;
        this.expectedProcesses = Number.isFinite(envExpectedProcesses)
            ? Math.max(1, envExpectedProcesses)
            : 2;
        this.perProcessRpm = Math.max(1, Math.floor(this.accountRpm / this.expectedProcesses));
        this.baseIntervalMs = Math.max(250, Math.ceil(60000 / this.perProcessRpm));
        this.defaultCooldownMs = Number.isFinite(envDefaultCooldownMs)
            ? Math.max(1000, envDefaultCooldownMs)
            : 12000;
        this.maxCooldownMs = Number.isFinite(envMaxCooldownMs)
            ? Math.max(this.defaultCooldownMs, envMaxCooldownMs)
            : 90000;
    }
    logConfigOnce() {
        if (this.initialized)
            return;
        this.initialized = true;
        console.log(`[ReplicateLimiter] accountRpm=${this.accountRpm}, expectedProcesses=${this.expectedProcesses}, ` +
            `perProcessRpm=${this.perProcessRpm}, baseIntervalMs=${this.baseIntervalMs}`);
    }
    async waitForPermit(label) {
        this.logConfigOnce();
        const now = Date.now();
        const waitMs = Math.max(0, this.nextAllowedAt - now, this.cooldownUntil - now);
        if (waitMs > 0) {
            console.log(`[ReplicateLimiter] waiting ${waitMs}ms before ${label}`);
            await sleep(waitMs);
        }
        this.nextAllowedAt = Date.now() + this.baseIntervalMs;
    }
    onSuccess() {
        this.consecutiveRateLimits = 0;
    }
    onError(error) {
        if (!isReplicateRateLimitError(error))
            return;
        const retryAfterMs = parseRetryAfterMs(error) ?? this.defaultCooldownMs;
        this.consecutiveRateLimits += 1;
        // Increase cooldown if 429s persist.
        const adaptiveExtra = (this.consecutiveRateLimits - 1) * 2000;
        const cooldownMs = Math.min(this.maxCooldownMs, retryAfterMs + adaptiveExtra);
        this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + cooldownMs);
        console.warn(`[ReplicateLimiter] rate limit detected; cooldown=${cooldownMs}ms ` +
            `(retryAfter=${retryAfterMs}ms, consecutive=${this.consecutiveRateLimits})`);
    }
    async acquireStartPermit(label) {
        let release = () => { };
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const previous = this.startTail;
        this.startTail = previous.then(() => gate).catch(() => gate);
        await previous;
        await this.waitForPermit(label);
        release();
    }
    async run(label, operation) {
        await this.acquireStartPermit(label);
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onError(error);
            throw error;
        }
    }
}
const singleton = new ReplicateRateLimiter();
async function runReplicateWithRateLimit(label, operation) {
    return singleton.run(label, operation);
}
//# sourceMappingURL=replicateRateLimiter.js.map