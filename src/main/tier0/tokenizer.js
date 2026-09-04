'use strict';

/**
 * Tokenizer — Accurate BPE Token Counter
 *
 * Uses the `gpt-tokenizer` package for exact cl100k_base / o200k_base
 * token counts. Falls back to an improved heuristic if the package
 * is not installed (e.g., during tests or if the user skipped npm install).
 *
 * All operations are 100% local — zero network calls.
 */

let _encoder = null;
let _fallbackMode = false;

/**
 * Lazily initialize the tokenizer.
 * We try to load gpt-tokenizer once; if it fails, we flip to fallback mode.
 */
function _init() {
  if (_encoder !== null || _fallbackMode) return;

  try {
    const { encode, decode } = require('gpt-tokenizer');
    _encoder = { encode, decode };
    console.log('[tokenizer] Loaded gpt-tokenizer (exact BPE mode)');
  } catch (err) {
    _fallbackMode = true;
    console.warn('[tokenizer] gpt-tokenizer not available, using heuristic fallback:', err.message);
  }
}

/**
 * Count the exact number of BPE tokens in a string.
 *
 * @param {string} text - Input text
 * @returns {number} Token count
 */
function countTokens(text) {
  if (!text || text.length === 0) return 0;

  _init();

  if (_encoder) {
    return _encoder.encode(text).length;
  }

  // Improved heuristic fallback — closer to real BPE behavior
  return _heuristicCount(text);
}

/**
 * Tokenize text into an array of token IDs.
 * Returns null in fallback mode.
 *
 * @param {string} text
 * @returns {number[]|null}
 */
function tokenize(text) {
  if (!text || text.length === 0) return [];

  _init();

  if (_encoder) {
    return _encoder.encode(text);
  }

  return null; // Not available in fallback mode
}

/**
 * Detokenize an array of token IDs back to text.
 * Returns null in fallback mode.
 *
 * @param {number[]} ids
 * @returns {string|null}
 */
function detokenize(ids) {
  if (!ids || ids.length === 0) return '';

  _init();

  if (_encoder) {
    return _encoder.decode(ids);
  }

  return null;
}

/**
 * Count how many tokens a single word costs.
 * Useful for the synonym shortener and token optimizer.
 *
 * @param {string} word
 * @returns {number}
 */
function wordTokenCost(word) {
  return countTokens(word);
}

/**
 * Check whether we're running in exact mode (gpt-tokenizer loaded)
 * or heuristic fallback.
 *
 * @returns {boolean} true if exact BPE mode is active
 */
function isExactMode() {
  _init();
  return !_fallbackMode;
}

/**
 * Improved heuristic token counter.
 * Better than simple `words * 1.3` — accounts for:
 * - Punctuation as separate tokens
 * - Long words splitting into multiple tokens
 * - Whitespace patterns
 * - Numbers and special characters
 *
 * @param {string} text
 * @returns {number}
 */
function _heuristicCount(text) {
  let count = 0;

  // Split on whitespace
  const parts = text.split(/(\s+)/);

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      // Whitespace: each newline is usually 1 token, spaces often merge
      const newlines = (part.match(/\n/g) || []).length;
      count += newlines;
      // Remaining spaces: roughly 1 token per space cluster
      if (part.replace(/\n/g, '').length > 0) count += 1;
      continue;
    }

    if (part.length === 0) continue;

    // Single punctuation character → 1 token
    if (/^[^\w\s]$/.test(part)) {
      count += 1;
      continue;
    }

    // Numbers → roughly 1 token per 3 digits
    if (/^\d+$/.test(part)) {
      count += Math.max(1, Math.ceil(part.length / 3));
      continue;
    }

    // Words: estimate based on length (BPE tends to split long words)
    // Short words (1-4 chars): usually 1 token
    // Medium words (5-8 chars): usually 1-2 tokens
    // Long words (9+ chars): 2-4 tokens
    if (part.length <= 4) {
      count += 1;
    } else if (part.length <= 8) {
      count += Math.ceil(part.length / 5);
    } else {
      count += Math.ceil(part.length / 4);
    }

    // Punctuation attached to words (e.g., "word," "word.")
    const trailingPunct = (part.match(/[^\w]+$/g) || [''])[0];
    if (trailingPunct.length > 0) {
      count += trailingPunct.length;
    }
  }

  return Math.max(1, count);
}

module.exports = {
  countTokens,
  tokenize,
  detokenize,
  wordTokenCost,
  isExactMode,
};
