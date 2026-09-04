'use strict';

/**
 * Whitespace Minifier
 *
 * Compresses whitespace patterns that waste tokens without adding
 * readability value (when the consumer is an LLM, not a human).
 *
 * - Blank lines → at most 1
 * - Trailing whitespace on every line
 * - Leading whitespace on non-code lines
 * - Multiple spaces → single space
 * - Blank lines between short bullet points
 */

/**
 * Minify whitespace in text, preserving readability structure.
 *
 * @param {string} text - Input text
 * @returns {{ text: string, changed: boolean }}
 */
function minify(text) {
  if (!text || text.length === 0) {
    return { text, changed: false };
  }

  let result = text;

  // 1. Trim trailing whitespace on every line
  result = result.replace(/[ \t]+$/gm, '');

  // 2. Collapse 2+ consecutive blank lines → 1 blank line
  result = result.replace(/\n{3,}/g, '\n\n');

  // 3. Collapse multiple spaces → single space (not at line start — could be indentation)
  result = result.replace(/([^\n]) {2,}/g, '$1 ');

  // 4. Remove blank lines between short consecutive bullet points
  result = result.replace(
    /((?:[-*•]|\d+[.)])\s+.{1,60})\n\n((?:[-*•]|\d+[.)])\s+)/g,
    '$1\n$2'
  );

  // 5. Remove trailing blank lines
  result = result.replace(/\n+$/, '\n');

  // 6. Remove leading blank lines
  result = result.replace(/^\n+/, '');

  const changed = result !== text;

  return { text: result, changed };
}

module.exports = {
  minify,
};
