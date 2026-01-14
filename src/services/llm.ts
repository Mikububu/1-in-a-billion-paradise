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
  },
  claude: {
    name: 'Claude Sonnet 4',
    emoji: '🧠',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514', // Claude Sonnet 4 - CORRECT model name
    maxTokens: 8192,
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

  constructor() {
    this.provider = (process.env.LLM_PROVIDER as LLMProvider) || DEFAULT_PROVIDER;
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
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const words = text.split(/\s+/).length;
        
        console.log(`✅ ${config.name} [${label}] done in ${elapsed}s, got ${words} words`);
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

// Export singleton instance
export const llm = new LLMService();

// Export types for external use
export type { LLMProvider };

