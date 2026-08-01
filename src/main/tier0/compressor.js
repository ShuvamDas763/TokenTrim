'use strict';

const { parseSegments, SEGMENT_TYPES } = require('./segment-parser');
const { getActiveFillers, isNeverTouch } = require('./filler-dictionary');

/**
 * Tier 0 Compressor
 *
 * Conservative, dictionary-based filler/redundancy stripping.
 * - Splits text into protected vs editable segments
 * - Applies filler replacements only to editable segments
 * - Cleans up resulting whitespace
 * - Returns diff metadata for the phrase learning system
 */

/**
 * Apply a single filler replacement to text.
 * Matches case-insensitively but preserves sentence-start capitalization.
 *
 * @param {string} text - Editable text segment
 * @param {object} filler - { pattern, replacement, confidence, category }
 * @param {Set} excludedPhrases - Phrases excluded by the learning system
 * @returns {{ text: string, removals: Array<{phrase: string, replacement: string}> }}
 */
function applyFiller(text, filler, excludedPhrases) {
  const removals = [];

  // Check if this phrase is excluded by learning
  if (excludedPhrases.has(filler.pattern.toLowerCase())) {
    return { text, removals };
  }

  // Check never-touch list (should already be filtered, but defense in depth)
  if (isNeverTouch(filler.pattern)) {
    return { text, removals };
  }

  // Build a case-insensitive regex with word boundaries
  // Escape regex special characters in the pattern
  const escaped = filler.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // For single-word fillers, use strict word boundaries
  // For multi-word phrases, use lookahead/behind for word boundaries
  const isMultiWord = filler.pattern.includes(' ');
  let regexStr;

  if (isMultiWord) {
    // Match at word boundaries, allowing for start/end of string
    regexStr = `(?:^|(?<=\\s))${escaped}(?=\\s|[.,;:!?]|$)`;
  } else {
    // Single word: strict word boundaries
    regexStr = `\\b${escaped}\\b`;
  }

  const regex = new RegExp(regexStr, 'gi');
  let match;
  const matches = [];

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      matched: match[0],
    });
  }

  if (matches.length === 0) {
    return { text, removals };
  }

  // Apply replacements from end to start to preserve indices
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    let rep = filler.replacement;

    // Preserve sentence-start capitalization
    if (rep && m.index === 0 || (m.index > 0 && /[.!?]\s*$/.test(result.slice(0, m.index)))) {
      if (rep.length > 0) {
        rep = rep.charAt(0).toUpperCase() + rep.slice(1);
      }
    }

    result = result.slice(0, m.index) + rep + result.slice(m.index + m.length);

    removals.push({
      phrase: filler.pattern,
      replacement: filler.replacement,
      original: m.matched,
    });
  }

  return { text: result, removals };
}

/**
 * Clean up whitespace artifacts from removals.
 * - Multiple spaces → single space
 * - Space before punctuation → no space
 * - Multiple newlines → at most two
 * - Trim leading/trailing whitespace per line
 */
function cleanWhitespace(text) {
  let result = text;

  // Multiple spaces → single
  result = result.replace(/ {2,}/g, ' ');

  // Space before punctuation
  result = result.replace(/ ([.,;:!?])/g, '$1');

  // Dangling comma or semicolon before sentence-ending punctuation or line end
  result = result.replace(/[,;]\s*([.!?])/g, '$1');
  result = result.replace(/[,;]\s*$/gm, '');

  // Leading space on a line
  result = result.replace(/^ +/gm, '');

  // Three or more newlines → two
  result = result.replace(/\n{3,}/g, '\n\n');

  // Dangling commas at start (from removed preamble: ", rest of sentence")
  result = result.replace(/^[,;]\s*/gm, '');

  // Capitalize first letter after sentence boundary if it became lowercase
  result = result.replace(/([.!?]\s+)([a-z])/g, (_, boundary, letter) => {
    return boundary + letter.toUpperCase();
  });

  // Capitalize very first character if text starts lowercase
  if (result.length > 0 && /^[a-z]/.test(result)) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Compress text using Tier 0 rule-based compression.
 *
 * @param {string} text - Input text
 * @param {number} aggressiveness - 1-5, default 2
 * @param {Set} [excludedPhrases] - Phrases excluded by the learning system
 * @returns {{ result: string, removals: Array, changed: boolean, originalLength: number, compressedLength: number }}
 */
function compress(text, aggressiveness = 2, excludedPhrases = new Set()) {
  if (!text || text.trim().length === 0) {
    return {
      result: text,
      removals: [],
      changed: false,
      originalLength: 0,
      compressedLength: 0,
    };
  }

  const originalLength = text.length;
  const allRemovals = [];

  // 1. Parse into segments
  const segments = parseSegments(text);

  // 2. Get active fillers for this aggressiveness level
  const fillers = getActiveFillers(aggressiveness);

  // 3. Process each segment
  const processedSegments = segments.map(segment => {
    if (segment.protected) {
      // Protected: pass through untouched
      return segment.content;
    }

    // Editable: apply fillers
    let processed = segment.content;

    // Sort fillers by pattern length (longest first) to avoid partial matches
    const sortedFillers = [...fillers].sort(
      (a, b) => b.pattern.length - a.pattern.length
    );

    for (const filler of sortedFillers) {
      const { text: newText, removals } = applyFiller(processed, filler, excludedPhrases);
      processed = newText;
      allRemovals.push(...removals);
    }

    console.log(`[Diagnostic] Segment BEFORE cleanWhitespace (len ${processed.length}): ${JSON.stringify(processed.substring(0, 60))}`);
    processed = cleanWhitespace(processed);
    console.log(`[Diagnostic] Segment AFTER cleanWhitespace (len ${processed.length}): ${JSON.stringify(processed.substring(0, 60))}`);

    return processed;
  });

  // 4. Reassemble
  let result = processedSegments.join('').trim();
  console.log(`[Diagnostic] Reassembled result (len ${result.length})`);

  return {
    result,
    removals: allRemovals,
    changed: result !== text,
    originalLength,
    compressedLength: result.length,
  };
}

module.exports = {
  compress,
};
