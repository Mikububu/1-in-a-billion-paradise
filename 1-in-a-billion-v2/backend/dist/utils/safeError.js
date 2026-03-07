"use strict";
/**
 * SAFE ERROR RESPONSES
 *
 * Strips internal details from errors before returning to clients.
 * Prevents database schema, stack trace, and internal path disclosure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeErrorMessage = safeErrorMessage;
exports.safeErrorResponse = safeErrorResponse;
/** Patterns that indicate internal details we should not expose. */
const INTERNAL_PATTERNS = [
    /relation "[\w.]+" does not exist/i,
    /column "[\w.]+" of relation/i,
    /duplicate key value violates/i,
    /violates (foreign key|not-null|check) constraint/i,
    /permission denied for (table|schema|function)/i,
    /syntax error at or near/i,
    /PGRST\d+/,
    /supabase/i,
    /postgres/i,
    /node_modules/,
    /\.ts:\d+:\d+/,
    /at\s+\S+\s+\(/,
];
/**
 * Map known error types to user-friendly messages.
 */
const ERROR_MAP = {
    'PGRST116': 'Resource not found',
    '23505': 'A record with this information already exists',
    '23503': 'Referenced record not found',
    '42501': 'Access denied',
    '42P01': 'Service temporarily unavailable',
    '23502': 'Required field missing',
};
/**
 * Convert an error to a safe, client-friendly message.
 * Internal details are logged but never sent to the client.
 */
function safeErrorMessage(error, fallback = 'An unexpected error occurred') {
    if (!error)
        return fallback;
    const msg = error instanceof Error ? error.message : String(error);
    // Check for known DB error codes
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String(error.code);
        if (ERROR_MAP[code])
            return ERROR_MAP[code];
    }
    // Check if message contains internal details
    for (const pattern of INTERNAL_PATTERNS) {
        if (pattern.test(msg))
            return fallback;
    }
    // If the message is short and doesn't look internal, it's probably safe
    if (msg.length < 200 && !msg.includes('/') && !msg.includes('\\')) {
        return msg;
    }
    return fallback;
}
/**
 * Create a safe error response object for Hono JSON responses.
 */
function safeErrorResponse(error, fallback) {
    return {
        success: false,
        error: safeErrorMessage(error, fallback),
    };
}
//# sourceMappingURL=safeError.js.map