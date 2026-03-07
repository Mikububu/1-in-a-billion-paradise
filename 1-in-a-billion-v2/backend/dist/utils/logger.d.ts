/**
 * STRUCTURED LOGGER
 *
 * Replaces console.log/warn/error throughout the backend.
 * In production, outputs structured JSON. In development, human-readable.
 */
export declare const logger: {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
};
//# sourceMappingURL=logger.d.ts.map