/**
 * SAFE ERROR RESPONSES
 *
 * Strips internal details from errors before returning to clients.
 * Prevents database schema, stack trace, and internal path disclosure.
 */
/**
 * Convert an error to a safe, client-friendly message.
 * Internal details are logged but never sent to the client.
 */
export declare function safeErrorMessage(error: unknown, fallback?: string): string;
/**
 * Create a safe error response object for Hono JSON responses.
 */
export declare function safeErrorResponse(error: unknown, fallback?: string): {
    success: boolean;
    error: string;
};
//# sourceMappingURL=safeError.d.ts.map