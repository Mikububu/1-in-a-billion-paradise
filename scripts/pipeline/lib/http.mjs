export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetryHttpError(err) {
  const status = Number(err?.status);
  if (!Number.isFinite(status)) return true; // network/parse/etc
  if (status === 408) return true;
  if (status === 425) return true;
  if (status === 429) return true;
  return status >= 500 && status <= 599;
}

function jitter(ms) {
  return Math.round(ms * (0.85 + Math.random() * 0.3));
}

export async function fetchJson(
  url,
  { method = 'GET', headers = {}, body, timeoutMs = 60_000, retries = 3, retryBaseMs = 800 } = {}
) {
  const maxAttempts = Math.max(1, Math.round(retries) + 1);
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.url = url;
        err.body = json;
        throw err;
      }

      return json;
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < maxAttempts && shouldRetryHttpError(err);
      if (!canRetry) throw err;
      const delay = jitter(retryBaseMs * Math.pow(2, attempt - 1));
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr || new Error('fetchJson failed');
}

export async function fetchBinary(
  url,
  { headers = {}, timeoutMs = 120_000, retries = 3, retryBaseMs = 800 } = {}
) {
  const maxAttempts = Math.max(1, Math.round(retries) + 1);
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} fetching ${url}: ${text || 'failed'}`);
        err.status = res.status;
        err.url = url;
        throw err;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { buffer: buf, headers: res.headers };
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < maxAttempts && shouldRetryHttpError(err);
      if (!canRetry) throw err;
      const delay = jitter(retryBaseMs * Math.pow(2, attempt - 1));
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr || new Error('fetchBinary failed');
}
