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
 * Clean up punctuation artifacts left behind after phrase removal
 * Fixes: double punctuation, orphaned punctuation, spacing issues
 * @param {string} text - Text after filler words have been stripped
 * @returns {string} Cleaned text
 */
function cleanPunctuation(text) {
  let result = text;

  // Collapse ANY combination of two adjacent sentence/clause punctuation marks
  // down to whichever one is "stronger" (. ! ? outrank ,)
  // Covers: ",," "?," ",?" "!," ",!" ".," ",." "?." ".?" "!." ".!" etc.
  result = result.replace(/([,.!?;:])\s*([,.!?;:])/g, (match, first, second) => {
    const strength = { '.': 3, '!': 3, '?': 3, ';': 2, ':': 2, ',': 1 };
    // Keep whichever mark is stronger; if equal, keep the first
    return strength[second] > strength[first] ? second : first;
  });

  // Run it TWICE to catch triple-collisions left over from consecutive 
  // filler removals (e.g. "word,,, next" → after 1 pass: "word, next" 
  // — but rare cases with 3+ marks need a second pass)
  result = result.replace(/([,.!?;:])\s*([,.!?;:])/g, (match, first, second) => {
    const strength = { '.': 3, '!': 3, '?': 3, ';': 2, ':': 2, ',': 1 };
    return strength[second] > strength[first] ? second : first;
  });

  // Capitalize first letter after sentence-ending punctuation
  result = result.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
    return `${punct} ${letter.toUpperCase()}`;
  });

  // Remove leading stray punctuation
  result = result.replace(/^[,;:]\s*/, '');

  // Clean up spacing
  result = result.replace(/\s{2,}/g, ' ');
  result = result.trim();

  return result;
}

/**
 * Reassemble compressed segments into final text.
 * Rules:
 *  - code_block segments always get a \n\n boundary on both sides
 *  - all other protected segments (inline_code, quoted, url, etc.)
 *    get exactly one space boundary on both sides — never zero, never \n\n
 *  - editable segments are joined as-is (already cleaned)
 */
function reassembleSegments(segments) {
  const BLOCK_LEVEL_TYPES = new Set(['code_block']);

  let result = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const content = segment.content;
    const isBlockLevel = segment.protected && BLOCK_LEVEL_TYPES.has(segment.type);
    const isInlineProtected = segment.protected && !isBlockLevel;

    if (isBlockLevel) {
      // Force paragraph break before, unless we're at the very start
      // or already have trailing whitespace
      if (result.length > 0 && !/\n\s*$/.test(result)) {
        result = result.replace(/\s+$/, ''); // trim trailing space first
        result += '\n\n';
      }
      result += content;
      // Mark that we need a paragraph break before the NEXT segment too —
      // handled by checking result state at the top of the next iteration
      if (i < segments.length - 1) {
        result += '\n\n';
      }
    } else if (isInlineProtected) {
      // Ensure exactly one space before, if there's preceding content 
      // and it doesn't already end in whitespace
      if (result.length > 0 && !/\s$/.test(result)) {
        result += ' ';
      }
      result += content;
      // Ensure exactly one space after — peek at next segment to avoid 
      // double-spacing if it already starts with whitespace
      const next = segments[i + 1];
      if (next && next.content.length > 0 && !/^\s/.test(next.content)) {
        result += ' ';
      }
    } else {
      // Plain editable segment — append as-is.
      // Any needed leading space was already handled by the 
      // previous segment's trailing-space logic above.
      result += content;
    }
  }

  // Final cleanup: collapse any accidental double-spaces or 
  // space-before-newline artifacts introduced by the boundary logic
  result = result.replace(/ +\n/g, '\n');   // no trailing space before a newline
  result = result.replace(/\n +/g, '\n');   // no leading space after a newline
  result = result.replace(/ {2,}/g, ' ');   // collapse any double spaces
  result = result.replace(/\n{3,}/g, '\n\n'); // never more than one blank line

  return result.trim();
}

/**
 * Collapse immediately-repeated identical phrases.
 * "I think, I think, I think this works" → "I think this works"
 * "so so basically" → "so basically" (also catches single-word repeats)
 * @param {string} text
 * @returns {string}
 */
function collapseRepeatedPhrases(text) {
  // Matches a short phrase (1-4 words), followed by itself repeated 
  // one or more times, separated by comma+space or just space.
  // Case-insensitive backreference works in JS with the 'i' flag.
  const pattern = /\b([A-Za-z][A-Za-z']*(?:\s+[A-Za-z][A-Za-z']*){0,3})\b(?:\s*,?\s+\1\b)+/gi;

  return text.replace(pattern, (match, phrase) => phrase);
}

/**
 * Compress text using Tier 0 rule-based compression.
 *
 * @param {string} text - Input text
 * @param {number} aggressiveness - 1-5, default 2
 * @param {Set} [excludedPhrases] - Phrases excluded by the learning system
 * @returns {{ result: string, removals: Array, changed: boolean, originalLength: number, compressedLength: number }}
 */
function compress(text, aggressiveness = 3, excludedPhrases = new Set()) {
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
      // Protected: pass through untouched, preserving type
      return { ...segment };
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
    processed = cleanPunctuation(processed);
    processed = collapseRepeatedPhrases(processed);
    console.log(`[Diagnostic] Segment AFTER cleanPunctuation (len ${processed.length}): ${JSON.stringify(processed.substring(0, 60))}`);

    return { ...segment, content: processed };
  });

  // 4. Reassemble
  let result = reassembleSegments(processedSegments);
  console.log(`[Diagnostic] Reassembled result (len ${result.length}): ${JSON.stringify(result)}`);

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
  collapseRepeatedPhrases,
};
