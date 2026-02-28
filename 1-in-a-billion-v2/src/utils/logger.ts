/**
 * FRONTEND LOGGER
 *
 * Replaces console.log throughout the app.
 * Silent in production, verbose in development.
 */

const isDev = __DEV__;

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (isDev) console.log(`[DEBUG] ${message}`, ...args);
  },
  info(message: string, ...args: unknown[]) {
    if (isDev) console.log(`[INFO] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    if (isDev) console.warn(`[WARN] ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]) {
    // Always log errors (could send to crash reporting service)
    console.error(`[ERROR] ${message}`, ...args);
  },
};
