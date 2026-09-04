'use strict';

/**
 * Boilerplate Dictionary
 *
 * Phrases that are meaningful in human conversation but add ZERO signal
 * when talking to an LLM. These burn tokens without changing what gets built.
 *
 * Categories:
 * - ai_implicit: Things LLMs do by default (clean code, error handling, etc.)
 * - meta_instruction: Instructions about how to instruct
 * - quality_platitudes: Vague quality requests
 * - sign_off: Closing pleasantries in prompts
 *
 * Each entry has a confidence score (0-1). Higher = safer to remove.
 * Removal is gated by the current aggressiveness preset.
 */

const BOILERPLATE = [
  // ── AI-Implicit (LLMs do these by default) ─────────────────────
  { pattern: 'make sure the code is clean and well-organized', replacement: '', confidence: 0.95, category: 'ai_implicit' },
  { pattern: 'make sure the code is clean and well organized', replacement: '', confidence: 0.95, category: 'ai_implicit' },
  { pattern: 'make sure the code is clean', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'write clean and maintainable code', replacement: '', confidence: 0.95, category: 'ai_implicit' },
  { pattern: 'write clean code', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'use modern best practices', replacement: '', confidence: 0.95, category: 'ai_implicit' },
  { pattern: 'follow best practices', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'use best practices', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'handle all edge cases', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'handle edge cases', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'make it production ready', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'make it production-ready', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'add proper error handling', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'add error handling', replacement: '', confidence: 0.8, category: 'ai_implicit' },
  { pattern: 'make sure it works correctly', replacement: '', confidence: 0.95, category: 'ai_implicit' },
  { pattern: 'make sure it works', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'optimize for performance', replacement: '', confidence: 0.8, category: 'ai_implicit' },
  { pattern: 'follow coding standards', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'use proper naming conventions', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'add comments where necessary', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'add appropriate comments', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'make the code readable', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'write readable code', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'ensure type safety', replacement: '', confidence: 0.8, category: 'ai_implicit' },
  { pattern: 'make it scalable', replacement: '', confidence: 0.75, category: 'ai_implicit' },
  { pattern: 'ensure it is secure', replacement: '', confidence: 0.7, category: 'ai_implicit' },
  { pattern: 'make sure it is efficient', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'use descriptive variable names', replacement: '', confidence: 0.9, category: 'ai_implicit' },
  { pattern: 'keep it simple and clean', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'keep it simple', replacement: '', confidence: 0.7, category: 'ai_implicit' },
  { pattern: 'keep the code dry', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'avoid code duplication', replacement: '', confidence: 0.85, category: 'ai_implicit' },
  { pattern: 'make it reusable', replacement: '', confidence: 0.75, category: 'ai_implicit' },
  { pattern: 'make the code modular', replacement: '', confidence: 0.8, category: 'ai_implicit' },

  // ── Meta-Instructions (instructions about instructing) ─────────
  { pattern: 'i want you to act as', replacement: '', confidence: 0.85, category: 'meta_instruction' },
  { pattern: 'you are an expert in', replacement: '', confidence: 0.8, category: 'meta_instruction' },
  { pattern: 'you are an expert', replacement: '', confidence: 0.75, category: 'meta_instruction' },
  { pattern: 'your task is to', replacement: '', confidence: 0.8, category: 'meta_instruction' },
  { pattern: 'your job is to', replacement: '', confidence: 0.8, category: 'meta_instruction' },
  { pattern: 'i need you to help me', replacement: '', confidence: 0.8, category: 'meta_instruction' },
  { pattern: 'please provide a detailed', replacement: 'provide', confidence: 0.7, category: 'meta_instruction' },
  { pattern: 'please provide a comprehensive', replacement: 'provide', confidence: 0.7, category: 'meta_instruction' },
  { pattern: 'i need a detailed explanation of', replacement: 'explain', confidence: 0.7, category: 'meta_instruction' },
  { pattern: 'as an ai language model', replacement: '', confidence: 0.95, category: 'meta_instruction' },
  { pattern: 'as a large language model', replacement: '', confidence: 0.95, category: 'meta_instruction' },
  { pattern: 'you should know that', replacement: '', confidence: 0.8, category: 'meta_instruction' },
  { pattern: 'keep in mind that', replacement: '', confidence: 0.6, category: 'meta_instruction' },
  { pattern: 'remember that', replacement: '', confidence: 0.55, category: 'meta_instruction' },
  { pattern: 'please note that', replacement: '', confidence: 0.6, category: 'meta_instruction' },

  // ── Quality Platitudes (vague, no actionable detail) ───────────
  { pattern: 'make it look professional', replacement: '', confidence: 0.75, category: 'quality_platitude' },
  { pattern: 'make it look good', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'make it look nice', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'make it user-friendly', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'make it user friendly', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'make it intuitive', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'make the ui clean and modern', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'make the ui look modern', replacement: '', confidence: 0.7, category: 'quality_platitude' },
  { pattern: 'with a good user experience', replacement: '', confidence: 0.75, category: 'quality_platitude' },
  { pattern: 'with good ux', replacement: '', confidence: 0.75, category: 'quality_platitude' },
  { pattern: 'the code should be well-tested', replacement: '', confidence: 0.8, category: 'quality_platitude' },
  { pattern: 'the code should be well tested', replacement: '', confidence: 0.8, category: 'quality_platitude' },
  { pattern: 'please test it thoroughly', replacement: '', confidence: 0.85, category: 'quality_platitude' },
  { pattern: 'it should work well', replacement: '', confidence: 0.9, category: 'quality_platitude' },
  { pattern: 'it needs to work properly', replacement: '', confidence: 0.9, category: 'quality_platitude' },

  // ── Sign-Off / Closing Pleasantries ────────────────────────────
  { pattern: 'that would be great', replacement: '', confidence: 0.85, category: 'sign_off' },
  { pattern: 'that would be really helpful', replacement: '', confidence: 0.85, category: 'sign_off' },
  { pattern: 'that would be awesome', replacement: '', confidence: 0.85, category: 'sign_off' },
  { pattern: 'i would really appreciate your help', replacement: '', confidence: 0.9, category: 'sign_off' },
  { pattern: 'i would appreciate your help', replacement: '', confidence: 0.85, category: 'sign_off' },
  { pattern: 'any help would be appreciated', replacement: '', confidence: 0.85, category: 'sign_off' },
  { pattern: 'looking forward to your response', replacement: '', confidence: 0.9, category: 'sign_off' },
  { pattern: 'looking forward to hearing from you', replacement: '', confidence: 0.9, category: 'sign_off' },
  { pattern: 'let me know what you think', replacement: '', confidence: 0.7, category: 'sign_off' },
  { pattern: 'let me know if that works', replacement: '', confidence: 0.75, category: 'sign_off' },
  { pattern: 'does that make sense', replacement: '', confidence: 0.85, category: 'sign_off' },
];

/**
 * Phrases that are on the boundary — only remove at high aggressiveness.
 * These are context-aware: "remember that X" might carry real info.
 */
const CONTEXT_SENSITIVE = new Set([
  'keep in mind that',
  'remember that',
  'please note that',
  'keep it simple',
]);

/**
 * Get the confidence threshold for boilerplate removal given aggressiveness.
 * More conservative than filler removal — we want to be careful.
 *
 * @param {number} aggressiveness - 1-5
 * @returns {number}
 */
function getBoilerplateThreshold(aggressiveness) {
  // Slightly higher thresholds than fillers — boilerplate removal is newer
  return Math.max(0.1, 1.1 - (aggressiveness / 4));
}

/**
 * Get active boilerplate patterns for the current aggressiveness level.
 *
 * @param {number} aggressiveness - 1-5
 * @returns {Array} Filtered boilerplate entries
 */
function getActiveBoilerplate(aggressiveness) {
  const threshold = getBoilerplateThreshold(aggressiveness);
  return BOILERPLATE.filter(b => b.confidence >= threshold);
}

/**
 * Check if a pattern is context-sensitive (needs higher aggressiveness).
 *
 * @param {string} pattern
 * @returns {boolean}
 */
function isContextSensitive(pattern) {
  return CONTEXT_SENSITIVE.has(pattern.toLowerCase().trim());
}

module.exports = {
  BOILERPLATE,
  getActiveBoilerplate,
  getBoilerplateThreshold,
  isContextSensitive,
};
