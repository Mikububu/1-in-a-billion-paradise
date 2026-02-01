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
import { env } from '../config/env';
import { getApiKey } from './apiKeys';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

type LLMProvider = 'deepseek' | 'claude' | 'openai';

// 🎯 CHANGE THIS OR SET LLM_PROVIDER ENV VAR:
// DeepSeek for all readings - faster and more reliable
const DEFAULT_PROVIDER: LLMProvider = 'deepseek';

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
    name: 'Claude Sonnet 4',
    emoji: '🧠',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514', // Claude Sonnet 4 - CORRECT model name
    maxTokens: 16384, // Increased to support 3000+ word outputs with large prompts
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
  }): Promise<string> {
    const provider = options?.provider || this.provider;
    const config = PROVIDER_CONFIG[provider];
    const maxTokens = options?.maxTokens || config.maxTokens;
    const temperature = options?.temperature || 0.8;
    const maxRetries = options?.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`${config.emoji} ${config.name} [${label}] attempt ${attempt}/${maxRetries}: ${prompt.length} chars`);
        const startTime = Date.now();

        // Build request body based on provider
        let body: any;
        if (provider === 'claude') {
          body = {
            model: config.model,
            max_tokens: maxTokens,
            temperature,
            messages: [{ role: 'user', content: prompt }],
          };
        } else {
          // OpenAI-compatible (DeepSeek, OpenAI, etc.)
          body = {
            model: config.model,
            max_tokens: maxTokens,
            temperature,
            messages: [{ role: 'user', content: prompt }],
          };
        }

        const response = await axios.post(config.url, body, {
          headers: await config.getHeaders(),
          timeout: 300000, // 5 min timeout
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
          console.log(`⚠️ ${config.name} [${label}] error ${status || errorCode || errorMsg.slice(0, 30)}, retrying in ${waitTime / 1000}s... (${attempt}/${maxRetries})`);
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
  }): Promise<string> {
    const maxTokens = options?.maxTokens || 5000;
    const temperature = options?.temperature || 0.8;

    console.log(`🌊 ${this.config.emoji} ${this.config.name} STREAMING [${label}]: ${prompt.length} chars, max ${maxTokens} tokens`);
    const startTime = Date.now();

    let fullText = '';
    let chunkCount = 0;

    try {
      // Build request body
      const body = this.provider === 'claude' 
        ? {
            model: this.config.model,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            messages: [{ role: 'user', content: prompt }],
          }
        : {
            model: this.config.model,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            messages: [{ role: 'user', content: prompt }],
          };

      // Use axios with stream response
      const response = await axios.post(this.config.url, body, {
        headers: await this.config.getHeaders(),
        responseType: 'stream',
        timeout: 600000, // 10 min for streaming
      });

      // Process the stream
      return new Promise((resolve, reject) => {
        let buffer = '';
        const stream = response.data;

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                
                // Claude format
                if (this.provider === 'claude') {
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
                }

                // Progress log every 50 chunks
                if (chunkCount % 50 === 0) {
                  const words = fullText.split(/\s+/).length;
                  console.log(`   📝 Streaming: ${words} words...`);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        });

        stream.on('end', () => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const words = fullText.split(/\s+/).length;
          console.log(`✅ ${this.config.name} STREAMING [${label}] complete: ${words} words in ${elapsed}s (${chunkCount} chunks)`);
          resolve(fullText.trim());
        });

        stream.on('error', (err: Error) => {
          console.error(`❌ ${this.config.name} stream error:`, err.message);
          reject(err);
        });
      });

    } catch (error: any) {
      console.error(`❌ ${this.config.name} STREAMING [${label}] failed:`, error.message);
      throw error;
    }
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

