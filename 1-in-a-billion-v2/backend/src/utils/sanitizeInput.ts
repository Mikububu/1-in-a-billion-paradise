/**
 * INPUT SANITIZATION
 *
 * Sanitizes user-provided strings before they are included in LLM prompts
 * or database queries. Prevents prompt injection attacks.
 */

/** Max length for user-provided text fields used in LLM prompts. */
const MAX_PROMPT_INPUT_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const MAX_CONTEXT_LENGTH = 5000;

/** Characters that could be used for prompt injection. */
const PROMPT_DELIMITER_PATTERN = /(<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>|###\s*(System|User|Assistant|Human|AI)\s*:)/gi;

/** Control characters except common whitespace (\n, \r, \t). */
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize a string for use in LLM prompts.
 * - Strips control characters
 * - Removes prompt delimiter sequences
 * - Truncates to maxLength
 */
export function sanitizeForLLM(input: unknown, maxLength = MAX_PROMPT_INPUT_LENGTH): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(CONTROL_CHAR_PATTERN, '')
    .replace(PROMPT_DELIMITER_PATTERN, '[filtered]')
    .trim()
    .slice(0, maxLength);
}

/** Sanitize a person's name. */
export function sanitizeName(input: unknown): string {
  return sanitizeForLLM(input, MAX_NAME_LENGTH);
}

/** Sanitize a user-provided context/description. */
export function sanitizeContext(input: unknown): string {
  return sanitizeForLLM(input, MAX_CONTEXT_LENGTH);
}

/** Sanitize a prompt layer directive. */
export function sanitizeDirective(input: unknown): string {
  return sanitizeForLLM(input, MAX_PROMPT_INPUT_LENGTH);
}

/**
 * Wrap user content in clearly delimited blocks for LLM consumption.
 * This makes it harder for injection to escape the user content zone.
 */
export function wrapUserContent(label: string, content: string): string {
  const sanitized = sanitizeForLLM(content, MAX_CONTEXT_LENGTH);
  return `<user_provided_${label}>\n${sanitized}\n</user_provided_${label}>`;
}
