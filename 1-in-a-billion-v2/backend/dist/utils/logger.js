"use strict";
/**
 * STRUCTURED LOGGER
 *
 * Replaces console.log/warn/error throughout the backend.
 * In production, outputs structured JSON. In development, human-readable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function formatMessage(level, message, meta) {
    if (isProduction) {
        return JSON.stringify({
            level,
            message,
            timestamp: new Date().toISOString(),
            ...meta,
        });
    }
    const prefix = {
        debug: '[DEBUG]',
        info: '[INFO]',
        warn: '[WARN]',
        error: '[ERROR]',
    }[level];
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${prefix} ${message}${metaStr}`;
}
exports.logger = {
    debug(message, meta) {
        if (shouldLog('debug'))
            console.log(formatMessage('debug', message, meta));
    },
    info(message, meta) {
        if (shouldLog('info'))
            console.log(formatMessage('info', message, meta));
    },
    warn(message, meta) {
        if (shouldLog('warn'))
            console.warn(formatMessage('warn', message, meta));
    },
    error(message, meta) {
        if (shouldLog('error'))
            console.error(formatMessage('error', message, meta));
    },
};
//# sourceMappingURL=logger.js.map