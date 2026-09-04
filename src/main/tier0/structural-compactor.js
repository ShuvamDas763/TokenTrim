'use strict';

/**
 * Structural Compactor
 *
 * Pattern-based structural transformations that preserve meaning
 * while reducing verbosity:
 *
 * 1. Sequential instruction flattening
 *    "First, do X. Second, do Y. Third, do Z." → "Do X, Y, then Z."
 *
 * 2. Paragraph inlining
 *    Short single-sentence paragraphs → flowing text
 *
 * 3. List compaction
 *    Numbered/bulleted lists with short items → inline comma-separated
 *
 * 4. Markdown trimming
 *    Excessive heading levels, redundant dividers
 */

/**
 * Flatten sequential numbered instructions into a compact list.
 *
 * Detects patterns like:
 * "First, create X. Second, add Y. Third, implement Z."
 * "1. Create X  2. Add Y  3. Implement Z"
 * "Step 1: Create X. Step 2: Add Y."
 *
 * @param {string} text
 * @returns {{ text: string, changed: boolean }}
 */
function flattenSequentialInstructions(text) {
  let result = text;
  let changed = false;

  // Pattern 1: "First, ... Second, ... Third, ..."
  const ordinalPattern = /(?:^|\n)\s*(?:first(?:ly)?)\s*[,:]?\s*(.*?)(?:\.\s*|\n)\s*(?:second(?:ly)?)\s*[,:]?\s*(.*?)(?:\.\s*|\n)\s*(?:third(?:ly)?)\s*[,:]?\s*(.*?)(?:\.\s*|\n)\s*(?:(?:fourth(?:ly)?)\s*[,:]?\s*(.*?)(?:\.\s*|\n))?\s*(?:(?:fifth(?:ly)?|finally|lastly)\s*[,:]?\s*(.*?)(?:\.|$))?/gi;

  result = result.replace(ordinalPattern, (match, first, second, third, fourth, fifth) => {
    changed = true;
    const items = [first, second, third, fourth, fifth]
      .filter(Boolean)
      .map(s => s.trim().replace(/\.$/, ''));

    if (items.length <= 1) return match; // Don't collapse single items

    const last = items.pop();
    return items.join(', ') + ', then ' + last + '.';
  });

  // Pattern 2: "Step 1: ... Step 2: ... Step 3: ..."
  const stepPattern = /(?:step\s+\d+\s*[:.\-)]\s*.+?(?:\.\s*|\n)){2,}/gi;

  result = result.replace(stepPattern, (match) => {
    const steps = match.match(/step\s+\d+\s*[:.\-)]\s*(.+?)(?:\.\s*|\n|$)/gi);
    if (!steps || steps.length < 2) return match;

    changed = true;
    const items = steps.map(s =>
      s.replace(/^step\s+\d+\s*[:.\-)]\s*/i, '').trim().replace(/\.$/, '')
    );

    const last = items.pop();
    return items.join(', ') + ', then ' + last + '.';
  });

  return { text: result, changed };
}

/**
 * Compact short numbered or bulleted list items into an inline list.
 * Only compacts lists where ALL items are short (< 60 chars).
 *
 * Detects:
 * - Markdown bulleted lists (-, *, •)
 * - Numbered lists (1., 2., 3.)
 *
 * @param {string} text
 * @returns {{ text: string, changed: boolean }}
 */
function compactShortLists(text) {
  let result = text;
  let changed = false;

  // Match blocks of 2+ consecutive list items
  const listBlockPattern = /(?:^|\n)((?:\s*(?:[-*•]|\d+[.)])\s+.+(?:\n|$)){2,})/gm;

  result = result.replace(listBlockPattern, (match, block) => {
    // Parse list items
    const items = block
      .split(/\n/)
      .map(line => line.trim())
      .filter(line => /^(?:[-*•]|\d+[.)])\s+/.test(line))
      .map(line => line.replace(/^(?:[-*•]|\d+[.)])\s+/, '').trim());

    if (items.length < 2) return match;

    // Only compact if ALL items are short
    const allShort = items.every(item => item.length < 60);
    if (!allShort) return match;

    changed = true;

    // Join items inline
    const last = items.pop();
    if (items.length === 0) return last;
    return '\n' + items.join(', ') + ', and ' + last;
  });

  return { text: result, changed };
}

/**
 * Inline short single-sentence paragraphs.
 * If a paragraph is just one short sentence (< 80 chars), preceded and
 * followed by blank lines, collapse it into the preceding paragraph.
 *
 * @param {string} text
 * @returns {{ text: string, changed: boolean }}
 */
function inlineShortParagraphs(text) {
  let changed = false;

  // Replace: text\n\nshort sentence\n\n → text. short sentence\n\n
  const result = text.replace(
    /([^\n])\n\n([^\n]{5,80}[.!?])\n\n/g,
    (match, before, short) => {
      // Don't inline if the short paragraph looks like a heading or list
      if (/^[#\-*•\d]/.test(short.trim())) return match;
      // Don't inline if previous line ends with a colon (introducing something)
      if (before.trim().endsWith(':')) return match;

      changed = true;
      return before + ' ' + short + '\n\n';
    }
  );

  return { text: result, changed };
}

/**
 * Trim excessive Markdown formatting.
 * - Collapse multiple consecutive --- or === dividers
 * - Remove excessive # heading depth (#### and deeper → ###)
 *
 * @param {string} text
 * @returns {{ text: string, changed: boolean }}
 */
function trimMarkdown(text) {
  let result = text;
  let changed = false;

  // Collapse consecutive dividers (--- or ===)
  const dividerResult = result.replace(/((?:---+|===+)\s*\n){2,}/g, '---\n');
  if (dividerResult !== result) {
    result = dividerResult;
    changed = true;
  }

  // Flatten deep headings: #### → ###, ##### → ###
  const headingResult = result.replace(/^(#{4,})\s/gm, '### ');
  if (headingResult !== result) {
    result = headingResult;
    changed = true;
  }

  return { text: result, changed };
}

/**
 * Run all structural compaction passes on text.
 *
 * @param {string} text - Input text (editable segments only)
 * @returns {{ text: string, changed: boolean }}
 */
function compact(text) {
  if (!text || text.trim().length === 0) {
    return { text, changed: false };
  }

  let result = text;
  let anyChanged = false;

  // 1. Flatten sequential instructions
  const seq = flattenSequentialInstructions(result);
  result = seq.text;
  anyChanged = anyChanged || seq.changed;

  // 2. Compact short lists
  const lists = compactShortLists(result);
  result = lists.text;
  anyChanged = anyChanged || lists.changed;

  // 3. Inline short paragraphs
  const inline = inlineShortParagraphs(result);
  result = inline.text;
  anyChanged = anyChanged || inline.changed;

  // 4. Trim markdown
  const md = trimMarkdown(result);
  result = md.text;
  anyChanged = anyChanged || md.changed;

  return { text: result, changed: anyChanged };
}

module.exports = {
  compact,
  flattenSequentialInstructions,
  compactShortLists,
  inlineShortParagraphs,
  trimMarkdown,
};
