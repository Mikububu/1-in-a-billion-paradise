import { LRUCache } from 'lru-cache';

export class ResponseCache<T extends Record<string, unknown>> {
  private cache: LRUCache<string, T>;

  constructor(max = 200) {
    this.cache = new LRUCache({ max });
  }

  get(key: string) {
    return this.cache.get(key);
  }

  set(key: string, value: T) {
    this.cache.set(key, value);
  }
}

