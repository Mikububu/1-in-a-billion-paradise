/**
 * MODULAR LLM SERVICE
 * 
 * Easy switching between providers via environment variable or config.
 * SUPPORTS STREAMING for long-form content (2000+ words) - prevents timeouts!
 * 
 * Usage:
 *   import { llm } from './services/llm';
 *   const text = await llm.generate(prompt, 'reading-western');
 *   const longText = await llm.generateStreaming(prompt, 'extended-reading'); // For 2000+ words
 * 
 * To switch providers:
 *   - Set LLM_PROVIDER env var to: 'deepseek' | 'claude' | 'openai'
 *   - Or change DEFAULT_PROVIDER below
 */

import axios from 'axios';
import https from 'https';
import { env } from '../config/env';
import { getApiKey } from './apiKeys';

/**
 * Shared HTTPS agent with keep-alive to reuse TCP connections.
 * Prevents ETIMEDOUT errors caused by opening too many fresh connections
 * during sequential streaming calls (e.g. person1 → person2 → overlay).
 */
const sharedHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 5,
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

type LLMProvider = 'deepseek' | 'claude' | 'openai';

// 🎯 CHANGE THIS OR SET LLM_PROVIDER ENV VAR:
// DeepSeek for all readings - faster and more reliable
const DEFAULT_PROVIDER: LLMProvider = 'deepseek';
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: TokenUsage;
  provider: LLMProvider;
  model: string;
  durationMs: number;
}

const PROVIDER_CONFIG = {
  deepseek: {
    name: 'DeepSeek',
    emoji: '🔮',
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 8192,
    getHeaders: async () => {
      const key = await getApiKey('deepseek', env.DEEPSEEK_API_KEY);
      if (!key) throw new Error('DeepSeek API key not found (check Supabase api_keys table or DEEPSEEK_API_KEY env var)');
      return {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      };
    },
    parseResponse: (data: any) => data?.choices?.[0]?.message?.content || '',
    parseUsage: (data: any): TokenUsage => ({
      inputTokens: data?.usage?.prompt_tokens || 0,
      outputTokens: data?.usage?.completion_tokens || 0,
      totalTokens: data?.usage?.total_tokens || 0,
    }),
  },
  claude: {
    name: 'Claude',
    emoji: '🧠',
    url: 'https://api.anthropic.com/v1/messages',
    model: env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
    maxTokens: 16384,
    getHeaders: async () => {
      const key = await getApiKey('claude', env.CLAUDE_API_KEY);
      if (!key) throw new Error('Claude API key not found (check Supabase api_keys table or CLAUDE_API_KEY env var)');
      return {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
    },
    parseResponse: (data: any) => data?.content?.[0]?.text || '',
    parseUsage: (data: any): TokenUsage => ({
      inputTokens: data?.usage?.input_tokens || 0,
      outputTokens: data?.usage?.output_tokens || 0,
      totalTokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
    }),
  },
  openai: {
    name: 'OpenAI',
    emoji: '🤖',
    url: 'https://api.openai.com/v1/chat/completions',
    model: env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: 4096,
    getHeaders: async () => {
      const key = await getApiKey('openai', env.OPENAI_API_KEY);
      if (!key) throw new Error('OpenAI API key not found (check Supabase api_keys table or OPENAI_API_KEY env var)');
      return {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      };
    },
    parseResponse: (data: any) => data?.choices?.[0]?.message?.content || '',
    parseUsage: (data: any): TokenUsage => ({
      inputTokens: data?.usage?.prompt_tokens || 0,
      outputTokens: data?.usage?.completion_tokens || 0,
      totalTokens: data?.usage?.total_tokens || 0,
    }),
  },
};

function getClaudeModelForAttempt(attempt: number): string {
  const primary = env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
  const fallback = env.CLAUDE_FALLBACK_MODEL || DEFAULT_CLAUDE_MODEL;
  if (attempt <= 1 || !fallback || fallback === primary) return primary;
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM SERVICE
// ═══════════════════════════════════════════════════════════════════════════

class LLMService {
  private provider: LLMProvider;
  private config: typeof PROVIDER_CONFIG[LLMProvider] & {
    getHeaders: () => Promise<Record<string, string>>;
  };

  constructor(provider?: LLMProvider) {
    this.provider = provider || (process.env.LLM_PROVIDER as LLMProvider) || DEFAULT_PROVIDER;
    this.config = PROVIDER_CONFIG[this.provider];
    console.log(`📡 LLM Service initialized: ${this.config.emoji} ${this.config.name}`);
  }

  /**
   * Switch provider at runtime
   */
  setProvider(provider: LLMProvider) {
    this.provider = provider;
    this.config = PROVIDER_CONFIG[provider];
    console.log(`📡 LLM Provider switched to: ${this.config.emoji} ${this.config.name}`);
  }

  /**
   * Get current provider name
   */
  getProvider(): string {
    return this.config.name;
  }

  // Store last usage for cost tracking
  private lastUsage: TokenUsage | null = null;
  private lastProvider: LLMProvider | null = null;
  private lastDurationMs: number = 0;

  /**
   * Get the last call's token usage (for cost tracking)
   */
  getLastUsage(): { usage: TokenUsage; provider: LLMProvider; durationMs: number } | null {
    if (!this.lastUsage || !this.lastProvider) return null;
    return {
      usage: this.lastUsage,
      provider: this.lastProvider,
      durationMs: this.lastDurationMs,
    };
  }

  /**
   * Generate text from prompt (standard non-streaming)
   */
  async generate(prompt: string, label: string, options?: {
    maxTokens?: number;
    temperature?: number;
    maxRetries?: number;
    provider?: LLMProvider;
    systemPrompt?: string;
  }): Promise<string> {
    const provider = options?.provider || this.provider;
    const config = PROVIDER_CONFIG[provider];
    // Clamp to provider limits to avoid 400s when callers request too many tokens.
    const maxTokens = Math.min(options?.maxTokens ?? config.maxTokens, config.maxTokens);
    const temperature = options?.temperature || 0.8;
    const maxRetries = options?.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const modelForAttempt = provider === 'claude' ? getClaudeModelForAttempt(attempt) : config.model;
        console.log(`${config.emoji} ${config.name} [${label}] attempt ${attempt}/${maxRetries}: ${prompt.length} chars, model=${modelForAttempt}`);
        const startTime = Date.now();

        // Build request body based on provider
        let body: any;
        if (provider === 'claude') {
          body = {
            model: modelForAttempt,
            max_tokens: maxTokens,
            temperature,
            ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
            messages: [{ role: 'user', content: prompt }],
          };
        } else {
          // OpenAI-compatible (DeepSeek, OpenAI, etc.)
          body = {
            model: modelForAttempt,
            max_tokens: maxTokens,
            temperature,
            messages: [
              ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
              { role: 'user', content: prompt },
            ],
          };
        }

        const response = await axios.post(config.url, body, {
          headers: await config.getHeaders(),
          timeout: 300000, // 5 min timeout
          httpsAgent: sharedHttpsAgent,
        });

        const text = config.parseResponse(response.data);
        const usage = config.parseUsage(response.data);
        const elapsed = Date.now() - startTime;
        const words = text.split(/\s+/).length;

        // Store usage for cost tracking
        this.lastUsage = usage;
        this.lastProvider = provider;
        this.lastDurationMs = elapsed;

        console.log(`✅ ${config.name} [${label}] done in ${(elapsed / 1000).toFixed(0)}s, got ${words} words (${usage.inputTokens}→${usage.outputTokens} tokens)`);
        return text;

      } catch (error: any) {
        const status = error.response?.status;
        const errorCode = error.code || '';
        const errorMsg = error.message || '';

        const isRetryable =
          status === 529 || status === 503 || status === 500 || status === 429 ||
          errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED' ||
          errorMsg.includes('socket hang up') || errorMsg.includes('network');

        if (isRetryable && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 5000; // 10s, 20s, 40s
          const modelSwitchNote =
            provider === 'claude' && getClaudeModelForAttempt(attempt + 1) !== getClaudeModelForAttempt(attempt)
              ? `; switching model to ${getClaudeModelForAttempt(attempt + 1)}`
              : '';
          console.log(`⚠️ ${config.name} [${label}] error ${status || errorCode || errorMsg.slice(0, 30)}, retrying in ${waitTime / 1000}s... (${attempt}/${maxRetries})${modelSwitchNote}`);
          await new Promise(r => setTimeout(r, waitTime));
        } else {
          console.error(`❌ ${config.name} [${label}] failed after ${attempt} attempts:`, error.message);
          throw error;
        }
      }
    }

    throw new Error(`${config.name} max retries exceeded`);
  }

  /**
   * 🚀 STREAMING GENERATION - for long-form content (2000+ words)
   * Uses axios with responseType: 'stream' for reliable streaming
   */
  async generateStreaming(prompt: string, label: string, options?: {
    maxTokens?: number;
    temperature?: number;
    onChunk?: (chunk: string) => void;
    systemPrompt?: string;
    provider?: LLMProvider;
    maxRetries?: number;
  }): Promise<string> {
    const provider = options?.provider || this.provider;
    const config = PROVIDER_CONFIG[provider];
    // Clamp to provider limits to avoid invalid requests.
    const maxTokens = Math.min(options?.maxTokens ?? 5000, config.maxTokens);
    const temperature = options?.temperature || 0.8;
    const maxRetries = options?.maxRetries ?? 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      let fullText = '';
      let chunkCount = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const modelForAttempt = provider === 'claude' ? getClaudeModelForAttempt(attempt) : config.model;

      console.log(`🌊 ${config.emoji} ${config.name} STREAMING [${label}] attempt ${attempt}/${maxRetries}: ${prompt.length} chars, max ${maxTokens} tokens, model=${modelForAttempt}`);

      try {
        // Build request body
        const body = provider === 'claude'
          ? {
            model: modelForAttempt,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
            messages: [{ role: 'user', content: prompt }],
          }
          : {
            model: modelForAttempt,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            messages: [
              ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
              { role: 'user', content: prompt },
            ],
          };

        // Use axios with stream response
        const response = await axios.post(config.url, body, {
          headers: await config.getHeaders(),
          responseType: 'stream',
          timeout: 1800000, // 30 min for streaming (allows slow Japanese/Chinese generation)
          httpsAgent: sharedHttpsAgent,
        });

        // Process the stream with inactivity timeout.
        // The axios timeout only covers the initial connection. Once streaming starts,
        // a stalled stream (LLM hangs mid-generation) would wait forever.
        // This inactivity timer fires if no data arrives for 5 minutes.
        const STREAM_INACTIVITY_MS = parseInt(process.env.STREAM_INACTIVITY_TIMEOUT_MS || '300000', 10); // 5 min
        const STREAM_TOTAL_MS = parseInt(process.env.STREAM_TOTAL_TIMEOUT_MS || '1800000', 10); // 30 min total

        const text = await new Promise<string>((resolve, reject) => {
          let buffer = '';
          const stream = response.data;
          let inactivityTimer: NodeJS.Timeout | null = null;
          let totalTimer: NodeJS.Timeout | null = null;
          let settled = false;

          const cleanup = () => {
            if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
            if (totalTimer) { clearTimeout(totalTimer); totalTimer = null; }
          };

          const fail = (err: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            try {
              stream.removeAllListeners();
              stream.destroy?.();
            } catch {
              // ignore
            }
            reject(err);
          };

          const succeed = (text: string) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(text);
          };

          const resetInactivityTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
              const words = fullText.split(/\s+/).length;
              fail(new Error(`Stream stalled: no data for ${STREAM_INACTIVITY_MS / 1000}s (got ${words} words so far). LLM may have hung.`));
            }, STREAM_INACTIVITY_MS);
          };

          // Total timeout: hard cap on entire stream duration
          totalTimer = setTimeout(() => {
            const words = fullText.split(/\s+/).length;
            fail(new Error(`Stream total timeout after ${STREAM_TOTAL_MS / 1000}s (got ${words} words). Generation took too long.`));
          }, STREAM_TOTAL_MS);

          // Start inactivity timer
          resetInactivityTimer();

          stream.on('data', (chunk: Buffer) => {
            resetInactivityTimer(); // Got data — reset inactivity timer
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Claude format
                if (provider === 'claude') {
                  if (parsed.type === 'message_start' && parsed.message?.usage) {
                    inputTokens = Number(parsed.message.usage.input_tokens) || inputTokens;
                    outputTokens = Number(parsed.message.usage.output_tokens) || outputTokens;
                  }
                  if (parsed.type === 'message_delta' && parsed.usage) {
                    outputTokens = Number(parsed.usage.output_tokens) || outputTokens;
                  }
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    fullText += parsed.delta.text;
                    chunkCount++;
                    if (options?.onChunk) options.onChunk(parsed.delta.text);
                  }
                } else {
                  // OpenAI/DeepSeek format
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullText += content;
                    chunkCount++;
                    if (options?.onChunk) options.onChunk(content);
                  }

                  // Some providers can include usage at the end when configured.
                  if (parsed.usage) {
                    inputTokens = Number(parsed.usage.prompt_tokens) || inputTokens;
                    outputTokens = Number(parsed.usage.completion_tokens) || outputTokens;
                  }
                }

                // Progress log every 50 chunks
                if (chunkCount % 50 === 0 && chunkCount > 0) {
                  const words = fullText.split(/\s+/).length;
                  console.log(`   📝 Streaming: ${words} words...`);
                }
              } catch {
                // Ignore parse errors (keep streaming)
              }
            }
          });

          stream.on('end', () => succeed(fullText.trim()));
          stream.on('error', (err: Error) => fail(err));
        });

        const elapsedMs = Date.now() - startTime;
        const words = text.split(/\s+/).filter(Boolean).length;

        // Anthropic occasionally returns an empty streamed completion (0 chunks, 0 tokens).
        // Treat that as a retryable transport/model anomaly, not a valid generation.
        if (!text.trim()) {
          const emptyErr: any = new Error('Empty streaming response');
          emptyErr.code = 'EMPTY_STREAM';
          throw emptyErr;
        }

        // Store usage for cost tracking (Claude usage comes via streaming events).
        this.lastUsage = {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        };
        this.lastProvider = provider;
        this.lastDurationMs = elapsedMs;

        console.log(`✅ ${config.name} STREAMING [${label}] complete: ${words} words in ${(elapsedMs / 1000).toFixed(1)}s (${chunkCount} chunks) (${inputTokens}→${outputTokens} tokens)`);
        return text;
      } catch (error: any) {
        const status = error.response?.status;
        const errorCode = error.code || '';
        const errorMsg = error.message || '';

        const isRetryable =
          status === 529 || status === 503 || status === 500 || status === 429 ||
          errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED' || errorCode === 'EMPTY_STREAM' ||
          errorMsg.includes('socket hang up') || errorMsg.includes('network');

        // Retry only if we didn't receive any content; otherwise we'd risk duplicating partial output.
        if (isRetryable && attempt < maxRetries && fullText.trim().length === 0) {
          const waitTime = Math.pow(2, attempt) * 5000;
          const modelSwitchNote =
            provider === 'claude' && getClaudeModelForAttempt(attempt + 1) !== getClaudeModelForAttempt(attempt)
              ? `; switching model to ${getClaudeModelForAttempt(attempt + 1)}`
              : '';
          console.log(`⚠️ ${config.name} STREAMING [${label}] error ${status || errorCode || errorMsg.slice(0, 30)}, retrying in ${waitTime / 1000}s... (${attempt}/${maxRetries})${modelSwitchNote}`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }

        console.error(`❌ ${config.name} STREAMING [${label}] failed:`, error.message);
        throw error;
      }
    }

    throw new Error(`${config.name} streaming max retries exceeded`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK LLM SERVICE (REQUIREMENT #8)
// ═══════════════════════════════════════════════════════════════════════════
// If one LLM fails, automatically try the next in the chain.
// Modular design allows adding new providers (GPT, Minimax) without rewriting.

/**
 * Default fallback order - can be customized per use case
 */
const DEFAULT_FALLBACK_CHAIN: LLMProvider[] = ['deepseek', 'claude', 'openai'];
const PAID_FALLBACK_CHAIN: LLMProvider[] = ['claude', 'deepseek', 'openai'];

class FallbackLLMService {
  private primaryProvider: LLMProvider;
  private fallbackChain: LLMProvider[];

  constructor(primaryProvider: LLMProvider, fallbackChain?: LLMProvider[]) {
    this.primaryProvider = primaryProvider;
    this.fallbackChain = fallbackChain || [primaryProvider, ...DEFAULT_FALLBACK_CHAIN.filter(p => p !== primaryProvider)];
    console.log(`🔄 Fallback LLM initialized: ${this.fallbackChain.join(' → ')}`);
  }

  /**
   * Generate with automatic fallback to next provider on failure
   * 
   * Tries each provider in the fallback chain until one succeeds.
   * Each provider gets its own retry attempts before moving to next.
   */
  async generateWithFallback(prompt: string, label: string, options?: {
    maxTokens?: number;
    temperature?: number;
    retriesPerProvider?: number;
    systemPrompt?: string;
  }): Promise<{ text: string; provider: LLMProvider; usedFallback: boolean }> {
    const retriesPerProvider = options?.retriesPerProvider || 2; // 2 retries per provider before fallback
    let lastError: Error | null = null;

    for (let i = 0; i < this.fallbackChain.length; i++) {
      const provider = this.fallbackChain[i];
      const config = PROVIDER_CONFIG[provider];
      const isFirstProvider = i === 0;

      if (!isFirstProvider) {
        console.log(`🔄 FALLBACK: Trying ${config.emoji} ${config.name} (${i + 1}/${this.fallbackChain.length})`);
      }

      try {
        const llmInstance = new LLMService(provider);
        const text = await llmInstance.generate(prompt, label, {
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
          maxRetries: retriesPerProvider,
          provider,
          systemPrompt: options?.systemPrompt,
        });

        // Success!
        if (!isFirstProvider) {
          console.log(`✅ FALLBACK SUCCESS: ${config.name} worked after ${this.fallbackChain.slice(0, i).join(', ')} failed`);
        }

        return {
          text,
          provider,
          usedFallback: !isFirstProvider,
        };

      } catch (error: any) {
        lastError = error;
        const isRefusal = error.message?.includes('refuse') ||
          error.message?.includes('cannot') ||
          error.message?.includes('inappropriate');

        if (isRefusal) {
          console.warn(`⚠️ ${config.name} refused the request (content policy), trying next provider...`);
        } else {
          console.warn(`⚠️ ${config.name} failed: ${error.message?.slice(0, 100)}, trying next provider...`);
        }
      }
    }

    // All providers failed
    console.error(`❌ ALL LLM PROVIDERS FAILED for [${label}]. Last error:`, lastError?.message);
    throw new Error(`All LLM providers failed (tried: ${this.fallbackChain.join(', ')}). Last error: ${lastError?.message}`);
  }

  /**
   * Streaming generation with fallback
   * Note: Fallback only happens before streaming starts. Once streaming begins,
   * a failure mid-stream will not fallback (to avoid partial duplicate content).
   */
  async generateStreamingWithFallback(prompt: string, label: string, options?: {
    maxTokens?: number;
    temperature?: number;
    onChunk?: (chunk: string) => void;
    systemPrompt?: string;
  }): Promise<{ text: string; provider: LLMProvider; usedFallback: boolean }> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.fallbackChain.length; i++) {
      const provider = this.fallbackChain[i];
      const config = PROVIDER_CONFIG[provider];
      const isFirstProvider = i === 0;

      if (!isFirstProvider) {
        console.log(`🔄 STREAMING FALLBACK: Trying ${config.emoji} ${config.name}`);
      }

      try {
        const llmInstance = new LLMService(provider);
        const text = await llmInstance.generateStreaming(prompt, label, options);

        return {
          text,
          provider,
          usedFallback: !isFirstProvider,
        };

      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ ${config.name} streaming failed: ${error.message?.slice(0, 100)}`);
      }
    }

    throw new Error(`All LLM providers failed for streaming [${label}]. Last error: ${lastError?.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT INSTANCES
// ═══════════════════════════════════════════════════════════════════════════

// Default instance for hook readings (fast, cheap) - with fallback chain
export const llm = new LLMService();

// Fallback-enabled instance for hook readings
export const llmWithFallback = new FallbackLLMService('deepseek', DEFAULT_FALLBACK_CHAIN);

// Paid instance for deep readings (extended, nuclear_v2, synastry, overlays)
// 🎯 ONE LINE TO CHANGE: Set PAID_LLM_PROVIDER in env.ts
export const llmPaid = new LLMService(env.PAID_LLM_PROVIDER as LLMProvider);

// Fallback-enabled paid instance - tries Claude first, then others
export const llmPaidWithFallback = new FallbackLLMService(
  (env.PAID_LLM_PROVIDER as LLMProvider) || 'claude',
  PAID_FALLBACK_CHAIN
);

// Export types for external use
export type { LLMProvider };
export { FallbackLLMService };
