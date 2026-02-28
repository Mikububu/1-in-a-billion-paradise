/**
 * GLOBAL ERROR HANDLER MIDDLEWARE
 *
 * Catches unhandled errors from Hono routes and returns safe responses.
 * Logs full error details server-side while sending generic messages to clients.
 */

import { Context, Next } from 'hono';
import { logger } from '../utils/logger';
import { safeErrorMessage } from '../utils/safeError';

/**
 * Global error handler middleware.
 * Must be registered before all routes: app.use('*', errorHandler)
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as any).status : 500;
    const path = c.req.path;
    const method = c.req.method;

    // Log full error details server-side
    logger.error('Unhandled route error', {
      method,
      path,
      status,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Return safe message to client
    return c.json({
      success: false,
      error: safeErrorMessage(err, 'An unexpected error occurred'),
    }, status >= 400 && status < 600 ? status : 500);
  }
}
