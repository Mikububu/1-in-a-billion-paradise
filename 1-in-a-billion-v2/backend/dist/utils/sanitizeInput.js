"use strict";
/**
 * INPUT SANITIZATION
 *
 * Sanitizes user-provided strings before they are included in LLM prompts
 * or database queries. Prevents prompt injection attacks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeForLLM = sanitizeForLLM;
exports.sanitizeName = sanitizeName;
exports.sanitizeContext = sanitizeContext;
exports.sanitizeDirective = sanitizeDirective;
exports.wrapUserContent = wrapUserContent;
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
function sanitizeForLLM(input, maxLength = MAX_PROMPT_INPUT_LENGTH) {
    if (typeof input !== 'string')
        return '';
    return input
        .replace(CONTROL_CHAR_PATTERN, '')
        .replace(PROMPT_DELIMITER_PATTERN, '[filtered]')
        .trim()
        .slice(0, maxLength);
}
/** Sanitize a person's name. */
function sanitizeName(input) {
    return sanitizeForLLM(input, MAX_NAME_LENGTH);
}
/** Sanitize a user-provided context/description. */
function sanitizeContext(input) {
    return sanitizeForLLM(input, MAX_CONTEXT_LENGTH);
}
/** Sanitize a prompt layer directive. */
function sanitizeDirective(input) {
    return sanitizeForLLM(input, MAX_PROMPT_INPUT_LENGTH);
}
/**
 * Wrap user content in clearly delimited blocks for LLM consumption.
 * This makes it harder for injection to escape the user content zone.
 */
function wrapUserContent(label, content) {
    const sanitized = sanitizeForLLM(content, MAX_CONTEXT_LENGTH);
    return `<user_provided_${label}>\n${sanitized}\n</user_provided_${label}>`;
}
//# sourceMappingURL=sanitizeInput.js.map