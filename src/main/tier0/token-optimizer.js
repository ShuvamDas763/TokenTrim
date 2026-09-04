'use strict';

/**
 * Token-Level Optimizer
 *
 * Works at the BPE tokenizer boundary to find cheaper word encodings
 * invisible to humans. E.g., "characteristics" (3 tokens) -> "traits" (1 token).
 *
 * This layer is unique because it specifically targets the idiosyncrasies
 * of the cl100k_base tokenizer.
 */

const tokenizer = require('./tokenizer');

// Pre-computed swaps where the synonym is guaranteed to use fewer BPE tokens
// (based on cl100k_base / gpt-4 tokenizer)
const TOKEN_SWAPS = [
  // 4 tokens -> 1 token
  { from: 'approximately', to: '~' },

  // 4 tokens -> 2 tokens
  { from: 'prerequisite', to: 'prereq' },

  // 3 tokens -> 1 token
  { from: 'nevertheless', to: 'still' },
  { from: 'unfortunately', to: 'sadly' },
  { from: 'characteristics', to: 'traits' },
  { from: 'straightforward', to: 'simple' },
  { from: 'comprehensive', to: 'full' },
  { from: 'alternatively', to: 'or' },
  { from: 'modification', to: 'change' },
  { from: 'modifications', to: 'changes' },
  { from: 'utilization', to: 'use' },

  // 3 tokens -> 2 tokens
  { from: 'significantly', to: 'greatly' },
  { from: 'simultaneously', to: 'at once' },
  { from: 'corresponding', to: 'matching' },
  { from: 'specifically', to: 'namely' },
  { from: 'consequently', to: 'thus' },

  // 2 tokens -> 1 token
  { from: 'requirements', to: 'needs' },
  { from: 'demonstrate', to: 'show' },
  { from: 'illustrate', to: 'show' },
  { from: 'facilitate', to: 'ease' },
  { from: 'sufficient', to: 'enough' },
  { from: 'subsequent', to: 'next' },
  { from: 'additional', to: 'extra' },
  { from: 'frequently', to: 'often' },
  { from: 'initially', to: 'first' },
  { from: 'ultimately', to: 'finally' },
  { from: 'furthermore', to: 'also' },
];

/**
 * Apply token-level swaps to editable text.
 * Only applies swaps if the word matches whole-word boundaries.
 *
 * @param {string} text
 * @returns {{ text: string, changed: boolean }}
 */
function optimizeTokens(text) {
  if (!text || text.length === 0) return { text, changed: false };

  let result = text;
  let changed = false;

  for (const swap of TOKEN_SWAPS) {
    const escaped = swap.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

    let match;
    const matches = [];
    while ((match = regex.exec(result)) !== null) {
      matches.push(match);
    }

    if (matches.length > 0) {
      changed = true;
      // Replace from back to front
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        let rep = swap.to;
        
        // Match capitalization of first letter
        if (m[0][0] === m[0][0].toUpperCase() && m[0][0] !== m[0][0].toLowerCase()) {
           rep = rep.charAt(0).toUpperCase() + rep.slice(1);
        }

        result = result.substring(0, m.index) + rep + result.substring(m.index + m[0].length);
      }
    }
  }

  return { text: result, changed };
}

module.exports = {
  optimizeTokens,
  TOKEN_SWAPS,
};
