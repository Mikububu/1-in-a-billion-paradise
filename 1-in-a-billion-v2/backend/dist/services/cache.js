"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseCache = void 0;
const lru_cache_1 = require("lru-cache");
class ResponseCache {
    constructor(max = 200) {
        this.cache = new lru_cache_1.LRUCache({ max });
    }
    get(key) {
        return this.cache.get(key);
    }
    set(key, value) {
        this.cache.set(key, value);
    }
}
exports.ResponseCache = ResponseCache;
//# sourceMappingURL=cache.js.map