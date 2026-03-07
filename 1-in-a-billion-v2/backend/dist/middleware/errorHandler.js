"use strict";
/**
 * GLOBAL ERROR HANDLER MIDDLEWARE
 *
 * Catches unhandled errors from Hono routes and returns safe responses.
 * Logs full error details server-side while sending generic messages to clients.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
const safeError_1 = require("../utils/safeError");
/**
 * Global error handler middleware.
 * Must be registered before all routes: app.use('*', errorHandler)
 */
async function errorHandler(c, next) {
    try {
        await next();
    }
    catch (err) {
        const status = err instanceof Error && 'status' in err ? err.status : 500;
        const path = c.req.path;
        const method = c.req.method;
        // Log full error details server-side
        logger_1.logger.error('Unhandled route error', {
            method,
            path,
            status,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
        // Return safe message to client
        return c.json({
            success: false,
            error: (0, safeError_1.safeErrorMessage)(err, 'An unexpected error occurred'),
        }, status >= 400 && status < 600 ? status : 500);
    }
}
//# sourceMappingURL=errorHandler.js.map