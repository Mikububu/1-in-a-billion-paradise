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

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorText(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message || String(error);
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isReplicateRateLimitError(error: unknown): boolean {
  const text = toErrorText(error);
  return /(^|[\s:"'])429($|[\s,"'])|throttled|rate.?limit/i.test(text);
}

function parseRetryAfterMs(error: unknown): number | null {
  const text = toErrorText(error);
  if (!text) return null;

  // Common payload fragment: "retry_after":10
  const jsonMatch = text.match(/retry[_\s-]*after["']?\s*[:=]\s*["']?(\d+)/i);
  if (jsonMatch?.[1]) return Number(jsonMatch[1]) * 1000;

  // Generic phrase: retry after 12
  const phraseMatch = text.match(/retry\s+after\s+(\d+)/i);
  if (phraseMatch?.[1]) return Number(phraseMatch[1]) * 1000;

  // Header-ish: Retry-After: 15
  const headerMatch = text.match(/retry-after["']?\s*[:=]\s*["']?(\d+)/i);
  if (headerMatch?.[1]) return Number(headerMatch[1]) * 1000;

  return null;
}

class ReplicateRateLimiter {
  private readonly accountRpm: number;
  private readonly expectedProcesses: number;
  private readonly perProcessRpm: number;
  private readonly baseIntervalMs: number;
  private readonly defaultCooldownMs: number;
  private readonly maxCooldownMs: number;

  // Queue only request STARTS to preserve RPM pacing while allowing in-flight concurrency.
  private startTail: Promise<void> = Promise.resolve();
  private nextAllowedAt = 0;
  private cooldownUntil = 0;
  private consecutiveRateLimits = 0;
  private initialized = false;

  constructor() {
    // Production default keeps throughput reasonable while still being overrideable via env.
    const envAccountRpm = Number(process.env.REPLICATE_ACCOUNT_RPM || 24);
    const envExpectedProcesses = Number(process.env.REPLICATE_EXPECTED_PROCESSES || 1);
    const envDefaultCooldownMs = Number(process.env.REPLICATE_DEFAULT_COOLDOWN_MS || 12000);
    const envMaxCooldownMs = Number(process.env.REPLICATE_MAX_COOLDOWN_MS || 90000);

    this.accountRpm = Number.isFinite(envAccountRpm) ? Math.max(1, envAccountRpm) : 60;
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

  private logConfigOnce(): void {
    if (this.initialized) return;
    this.initialized = true;
    console.log(
      `[ReplicateLimiter] accountRpm=${this.accountRpm}, expectedProcesses=${this.expectedProcesses}, ` +
      `perProcessRpm=${this.perProcessRpm}, baseIntervalMs=${this.baseIntervalMs}`
    );
  }

  private async waitForPermit(label: string): Promise<void> {
    this.logConfigOnce();
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAllowedAt - now, this.cooldownUntil - now);
    if (waitMs > 0) {
      console.log(`[ReplicateLimiter] waiting ${waitMs}ms before ${label}`);
      await sleep(waitMs);
    }
    this.nextAllowedAt = Date.now() + this.baseIntervalMs;
  }

  private onSuccess(): void {
    this.consecutiveRateLimits = 0;
  }

  private onError(error: unknown): void {
    if (!isReplicateRateLimitError(error)) return;

    const retryAfterMs = parseRetryAfterMs(error) ?? this.defaultCooldownMs;
    this.consecutiveRateLimits += 1;

    // Increase cooldown if 429s persist.
    const adaptiveExtra = (this.consecutiveRateLimits - 1) * 2000;
    const cooldownMs = Math.min(this.maxCooldownMs, retryAfterMs + adaptiveExtra);
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + cooldownMs);
    console.warn(
      `[ReplicateLimiter] rate limit detected; cooldown=${cooldownMs}ms ` +
      `(retryAfter=${retryAfterMs}ms, consecutive=${this.consecutiveRateLimits})`
    );
  }

  private async acquireStartPermit(label: string): Promise<void> {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.startTail;
    this.startTail = previous.then(() => gate).catch(() => gate);
    await previous;
    await this.waitForPermit(label);
    release();
  }

  async run<T>(label: string, operation: () => Promise<T>): Promise<T> {
    await this.acquireStartPermit(label);
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }
}

const singleton = new ReplicateRateLimiter();

export async function runReplicateWithRateLimit<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  return singleton.run(label, operation);
}
