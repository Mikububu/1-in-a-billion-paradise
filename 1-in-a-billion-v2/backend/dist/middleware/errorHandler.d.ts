/**
 * GLOBAL ERROR HANDLER MIDDLEWARE
 *
 * Catches unhandled errors from Hono routes and returns safe responses.
 * Logs full error details server-side while sending generic messages to clients.
 */
import { Context, Next } from 'hono';
/**
 * Global error handler middleware.
 * Must be registered before all routes: app.use('*', errorHandler)
 */
export declare function errorHandler(c: Context, next: Next): Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, any, "json">) | undefined>;
//# sourceMappingURL=errorHandler.d.ts.map