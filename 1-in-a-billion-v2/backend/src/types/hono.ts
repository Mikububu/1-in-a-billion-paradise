import type { Env } from 'hono';

/**
 * Hono environment type that defines the context variables available across the application.
 * This allows TypeScript strict mode to know about custom variables like userId.
 */
export type AppEnv = {
  Variables: {
    userId: string;
  };
};
