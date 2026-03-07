export declare class ResponseCache<T extends Record<string, unknown>> {
    private cache;
    constructor(max?: number);
    get(key: string): T | undefined;
    set(key: string, value: T): void;
}
//# sourceMappingURL=cache.d.ts.map