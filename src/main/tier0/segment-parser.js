'use strict';

console.log('[segment-parser] module loaded');

/**
 * Segment Parser
 *
 * Splits input text into protected segments (code blocks, inline code,
 * quoted text, URLs, numbers) and editable segments.
 *
 * Protected segments pass through byte-for-byte unchanged.
 * Only editable segments are processed by the filler dictionary.
 */

/**
 * Segment types — protected types are never modified.
 */
const SEGMENT_TYPES = {
  CODE_BLOCK: 'code_block',
  INLINE_CODE: 'inline_code',
  QUOTED: 'quoted',
  URL: 'url',
  NUMBER: 'number',
  ALPHANUMERIC_TOKEN: 'alphanumeric_token',
  EDITABLE: 'editable',
};

const PROTECTED_TYPES = new Set([
  SEGMENT_TYPES.CODE_BLOCK,
  SEGMENT_TYPES.INLINE_CODE,
  SEGMENT_TYPES.QUOTED,
  SEGMENT_TYPES.URL,
  SEGMENT_TYPES.NUMBER,
  SEGMENT_TYPES.ALPHANUMERIC_TOKEN,
]);

/**
 * Regex patterns for detecting protected content.
 * Order matters — earlier patterns take priority.
 */
const PATTERNS = [
  // Fenced code blocks: ```...``` (with optional language tag)
  {
    type: SEGMENT_TYPES.CODE_BLOCK,
    regex: /```[\s\S]*?```/g,
  },
  // Inline code: `...`
  {
    type: SEGMENT_TYPES.INLINE_CODE,
    regex: /`[^`\n]+`/g,
  },
  // URLs: http(s)://, www., or common protocol-less with TLD
  {
    type: SEGMENT_TYPES.URL,
    regex: /(?:https?:\/\/|www\.)[^\s<>\"'`,;)\]]+/gi,
  },
  // Double-quoted strings (handles escaped quotes)
  {
    type: SEGMENT_TYPES.QUOTED,
    regex: /"(?:[^"\\]|\\.)*"/g,
  },
  // Single-quoted strings (only multi-word to avoid apostrophes, and exclude contractions via lookaround)
  {
    type: SEGMENT_TYPES.QUOTED,
    regex: /(?<![a-zA-Z])'(?:[^'\\]|\\.){2,}'(?![a-zA-Z])/g,
  },
  // Mixed alphanumeric tokens (API keys, hashes, versions). Protects the WHOLE token 
  // so the NUMBER regex below doesn't fragment the digits within it.
  {
    type: SEGMENT_TYPES.ALPHANUMERIC_TOKEN,
    regex: /\b(?=\w*[a-zA-Z])(?=\w*\d)[a-zA-Z0-9_\-]{8,}\b/g,
  },
  // Numbers: integers, decimals, dates, phone numbers, versions, times
  // Must be bounded by word boundaries or punctuation to avoid matching inside words
  // Optional unit suffixes (ms, px, kb, etc.) are consumed to prevent backtracking
  {
    type: SEGMENT_TYPES.NUMBER,
    regex: /(?<![a-zA-Z])(\d[\d,.\-:\/\+\(\)]{1,}[\d]|\d+(?:\.\d+)?%?)(?:ms|[smhd]|px|r?em|vh|vw|[kmgt]i?b|fps|hz|dpi|pt)?(?![a-zA-Z])/gi,
  },
];

/**
 * Detect if a line block is heavily indented code (4+ spaces or tab)
 * with high bracket/semicolon density.
 */
function isIndentedCode(text) {
  const lines = text.split('\n');
  if (lines.length < 3) return false;

  let indentedCount = 0;
  let bracketDensity = 0;
  let codeTokenCount = 0;

  const codeRegex = /\b(function|const|let|var|if\s*\(|for\s*\(|return|import|export|class)\b|===|==|=>/g;

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    // 1+ space or tab counts as indented
    if (line.match(/^[ \t]+/)) indentedCount++;
    bracketDensity += (line.match(/[{}()\[\];=<>]/g) || []).length;
    codeTokenCount += (line.match(codeRegex) || []).length;
    if (line.trim().endsWith(';')) codeTokenCount++;
  }

  const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
  if (nonEmptyLines === 0) return false;

  const indentRatio = indentedCount / nonEmptyLines;
  const avgBrackets = bracketDensity / nonEmptyLines;
  const avgTokens = codeTokenCount / nonEmptyLines;

  let score = 0;
  if (indentRatio > 0.5) score += 2;
  else if (indentRatio > 0.1) score += 1;

  if (avgBrackets > 1.0) score += 2;
  else if (avgBrackets > 0.4) score += 1;

  if (avgTokens > 0.4) score += 3;
  else if (avgTokens > 0.1) score += 1;

  // Bias towards treating as code. A score of 3 is enough.
  return score >= 3;
}

/**
 * Parse text into an ordered list of segments.
 * Protected segments are identified first; remaining text becomes editable segments.
 *
 * @param {string} text - Input text to parse
 * @returns {Array<{type: string, content: string, start: number, end: number, protected: boolean}>}
 */
function parseSegments(text) {
  // Collect all protected ranges
  const protectedRanges = [];

  const applyPatterns = (patternsList) => {
    for (const pattern of patternsList) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (pattern.type === SEGMENT_TYPES.QUOTED) {
          if (match[0].length > 200 || /\n\s*\n/.test(match[0])) {
            regex.lastIndex = match.index + 1;
            continue;
          }
        }
        const start = match.index;
        const end = start + match[0].length;
        const overlaps = protectedRanges.some(r => start < r.end && end > r.start);
        if (!overlaps) {
          protectedRanges.push({ type: pattern.type, start, end, content: match[0] });
        }
      }
    }
  };

  // First apply HIGH PRIORITY regex patterns (Markdown code blocks)
  const priorityPatterns = PATTERNS.filter(p => 
    p.type === SEGMENT_TYPES.CODE_BLOCK || p.type === SEGMENT_TYPES.INLINE_CODE
  );
  applyPatterns(priorityPatterns);

  // Then check for heuristic code blocks (multi-line detection) in the remaining text
  const lines = text.split('\n');
  let blockStart = -1;
  let blockLines = [];
  let emptyCount = 0;
  let balance = 0;
  let pendingEmptyLines = [];

  const processBlock = () => {
    if (balance === 0 && blockLines.length >= 3) {
      const blockText = blockLines.join('\n');
      // Balance-tracked blocks are already validated:
      // 1. isCodeLine() matched a real code signal on the opening line
      // 2. Bracket balance returned cleanly to zero
      // No secondary heuristic score needed.
      let startPos = 0;
      for (let j = 0; j < blockStart; j++) {
        startPos += lines[j].length + 1; // +1 for newline
      }
      const endPos = startPos + blockText.length;
      
      // Only add if it doesn't overlap with regex-detected protected ranges (like fenced blocks)
      const overlaps = protectedRanges.some(
        r => startPos < r.end && endPos > r.start
      );
      
      if (!overlaps) {
        protectedRanges.push({
          type: SEGMENT_TYPES.CODE_BLOCK,
          start: startPos,
          end: endPos,
          content: blockText,
        });
      }
    }
    blockStart = -1;
    blockLines = [];
    emptyCount = 0;
    balance = 0;
    pendingEmptyLines = [];
  };

  const isCodeLine = (line) => {
    if (line.trim().length === 0) return 'empty';
    if (/^[ \t]+/.test(line)) return true;
    if (/\b(function|const|let|var|if\s*\(|for\s*\(|while\s*\(|return|import|export|class)\b/.test(line)) return true;
    if (/===|==|=>|\+=|-=|\*=/.test(line)) return true;
    if (/[;{}]\s*$/.test(line)) return true;
    if (/^[}\s\])]+;?\s*$/.test(line)) return true;
    return false;
  };

  const getLineDelta = (line) => {
    const open = (line.match(/[\{\[\(]/g) || []).length;
    const close = (line.match(/[\}\]\)]/g) || []).length;
    return open - close;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isCode = isCodeLine(line);
    const lineDelta = getLineDelta(line);

    if (blockStart === -1) {
      if (isCode === true) {
        blockStart = i;
        balance = Math.max(0, lineDelta);
        blockLines.push(line);
        emptyCount = 0;
        pendingEmptyLines = [];
      }
    } else {
      if (balance > 0) {
        // Inside an unclosed block
        if (line.trim().length === 0) {
          emptyCount++;
          pendingEmptyLines.push(line);
          if (emptyCount > 2) {
            processBlock();
          }
        } else {
          blockLines.push(...pendingEmptyLines);
          pendingEmptyLines = [];
          emptyCount = 0;
          
          balance += lineDelta;
          if (balance < 0) balance = 0;
          blockLines.push(line);
          
          if (blockLines.length > 50) {
            processBlock();
          }
        }
      } else {
        // Balance is 0
        if (isCode === true) {
          blockLines.push(...pendingEmptyLines);
          pendingEmptyLines = [];
          emptyCount = 0;
          
          balance = Math.max(0, lineDelta);
          blockLines.push(line);
        } else if (isCode === 'empty') {
          emptyCount++;
          pendingEmptyLines.push(line);
          if (emptyCount > 2) {
            processBlock();
          }
        } else {
          processBlock();
        }
      }
    }
  }
  processBlock();

  // Finally apply SECONDARY regex patterns (URLs, Numbers, Quotes)
  const secondaryPatterns = PATTERNS.filter(p => 
    p.type !== SEGMENT_TYPES.CODE_BLOCK && p.type !== SEGMENT_TYPES.INLINE_CODE
  );
  applyPatterns(secondaryPatterns);

  // Sort by start position
  protectedRanges.sort((a, b) => a.start - b.start);

  // Build final segment list, filling gaps with editable segments
  const segments = [];
  let cursor = 0;

  for (const range of protectedRanges) {
    // Add editable segment before this protected range
    if (range.start > cursor) {
      segments.push({
        type: SEGMENT_TYPES.EDITABLE,
        content: text.slice(cursor, range.start),
        start: cursor,
        end: range.start,
        protected: false,
      });
    }

    // Add the protected segment
    segments.push({
      type: range.type,
      content: range.content,
      start: range.start,
      end: range.end,
      protected: true,
    });

    cursor = range.end;
  }

  // Add remaining editable text
  if (cursor < text.length) {
    segments.push({
      type: SEGMENT_TYPES.EDITABLE,
      content: text.slice(cursor),
      start: cursor,
      end: text.length,
      protected: false,
    });
  }

  console.log('--- DIAGNOSTIC: SEGMENTS ---');
  segments.forEach((seg, i) => {
    console.log(`[${i}] type: ${seg.type}, protected: ${seg.protected}, content: ${JSON.stringify(seg.content.substring(0, 60))}`);
  });
  console.log('----------------------------');

  return segments;
}

module.exports = {
  parseSegments,
  SEGMENT_TYPES,
  PROTECTED_TYPES,
};
