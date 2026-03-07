/**
 * INPUT SANITIZATION
 *
 * Sanitizes user-provided strings before they are included in LLM prompts
 * or database queries. Prevents prompt injection attacks.
 */
/**
 * Sanitize a string for use in LLM prompts.
 * - Strips control characters
 * - Removes prompt delimiter sequences
 * - Truncates to maxLength
 */
export declare function sanitizeForLLM(input: unknown, maxLength?: number): string;
/** Sanitize a person's name. */
export declare function sanitizeName(input: unknown): string;
/** Sanitize a user-provided context/description. */
export declare function sanitizeContext(input: unknown): string;
/** Sanitize a prompt layer directive. */
export declare function sanitizeDirective(input: unknown): string;
/**
 * Wrap user content in clearly delimited blocks for LLM consumption.
 * This makes it harder for injection to escape the user content zone.
 */
export declare function wrapUserContent(label: string, content: string): string;
//# sourceMappingURL=sanitizeInput.d.ts.map