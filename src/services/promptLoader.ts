import fs from 'fs/promises';
import path from 'path';

/**
 * Service to load and cache prompts from the filesystem.
 * This ensures we use the "Master Prompts" (Markdown) instead of hardcoded strings.
 */
class PromptLoader {
  private cache: Map<string, string> = new Map();
  private promptsDir: string;

  constructor() {
    // resolve prompts directory relative to the running process
    // In dev (ts-node): ./prompts
    // In prod (dist): ../prompts via path resolution
    this.promptsDir = path.resolve(process.cwd(), 'prompts'); 
    console.log(`📂 PromptLoader initialized. Looking in: ${this.promptsDir}`);
  }

  /**
   * Load a prompt file by name (e.g. "deep-reading-prompt.md")
   */
  async load(filename: string): Promise<string> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename)!;
    }

    try {
      const filePath = path.join(this.promptsDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      
      this.cache.set(filename, content);
      console.log(`📖 Loaded prompt: ${filename} (${content.length} chars)`);
      return content;
    } catch (error: any) {
      console.error(`❌ Failed to load prompt ${filename}:`, error.message);
      // Fallback or rethrow? For now rethrow as this is critical.
      throw new Error(`Critical: Could not load prompt file '${filename}'. Ensure it exists in ${this.promptsDir}`);
    }
  }

  /**
   * Clear cache (useful for hot-reloading prompts during dev)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Prompt cache cleared');
  }
}

export const promptLoader = new PromptLoader();
