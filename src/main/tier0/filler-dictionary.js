'use strict';

/**
 * Filler Dictionary
 *
 * Hand-curated, auditable dictionary of filler phrases and their replacements.
 * Each entry has:
 * - pattern: the filler phrase to match (case-insensitive)
 * - replacement: what to replace it with (empty string = remove entirely)
 * - confidence: 0-1, how safe it is to remove. Higher = safer.
 *   Used with the aggressiveness setting: a phrase is applied when
 *   its confidence >= (1 - aggressiveness/5), so at aggressiveness=2 (default),
 *   only phrases with confidence >= 0.6 are applied.
 * - category: for organization and UI display
 *
 * NEVER-TOUCH LIST: words/phrases that might carry real claims or meaning.
 * These are EXCLUDED from any pattern matching.
 */

const NEVER_TOUCH = new Set([
  'i think',
  'i believe',
  'might',
  'possibly',
  'perhaps',
  'arguably',
  'likely',
  'unlikely',
  'probably',
  'may',
  'could',
  'should',
  'would',
  'in my opinion',
  'in my experience',
  'as far as i know',
]);

/**
 * Filler entries, ordered by category.
 * Patterns are matched case-insensitively.
 * The replacement preserves surrounding whitespace — the compressor handles cleanup.
 */
const FILLERS = [
  // ── Redundant Preambles ──────────────────────────────────────────
  { pattern: 'so i\'ve been meaning to ask', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'i\'ve been meaning to ask', replacement: '', confidence: 0.75, category: 'preamble' },
  { pattern: 'i just wanted to say that', replacement: '', confidence: 0.9, category: 'preamble' },
  { pattern: 'i just wanted to', replacement: '', confidence: 0.9, category: 'preamble' },
  { pattern: 'i was just wondering if', replacement: '', confidence: 0.85, category: 'preamble' },
  { pattern: 'i was wondering if', replacement: '', confidence: 0.85, category: 'preamble' },
  { pattern: 'i wanted to ask if', replacement: '', confidence: 0.85, category: 'preamble' },
  { pattern: 'i wanted to ask', replacement: '', confidence: 0.85, category: 'preamble' },
  { pattern: 'i was hoping you could', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'i was hoping to', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'what i want to do is', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'what i am trying to do is', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'what i\'m trying to do is', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'so basically what i need is', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'so what i need is', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'i need you to', replacement: '', confidence: 0.7, category: 'preamble' },
  { pattern: 'can you please', replacement: '', confidence: 0.65, category: 'preamble' },
  { pattern: 'could you please', replacement: '', confidence: 0.65, category: 'preamble' },
  { pattern: 'i would like you to', replacement: '', confidence: 0.7, category: 'preamble' },
  { pattern: 'i\'d like you to', replacement: '', confidence: 0.7, category: 'preamble' },
  { pattern: 'i was thinking maybe', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'i was wondering', replacement: '', confidence: 0.8, category: 'preamble' },
  { pattern: 'hey so you could', replacement: 'could you', confidence: 0.8, category: 'preamble' },
  { pattern: 'could you just', replacement: 'could you', confidence: 0.8, category: 'preamble' },
  { pattern: 'maybe we could just', replacement: 'could we', confidence: 0.8, category: 'preamble' },
  { pattern: 'maybe we could', replacement: 'could we', confidence: 0.7, category: 'preamble' },
  { pattern: 'hey can you help me with', replacement: '', confidence: 0.8, category: 'preamble' },

  // ── Wordy Connectors / Substitutions ─────────────────────────────
  { pattern: 'in order to', replacement: 'to', confidence: 0.95, category: 'connector' },
  { pattern: 'in order for', replacement: 'for', confidence: 0.95, category: 'connector' },
  { pattern: 'due to the fact that', replacement: 'because', confidence: 0.95, category: 'connector' },
  { pattern: 'owing to the fact that', replacement: 'because', confidence: 0.95, category: 'connector' },
  { pattern: 'by virtue of the fact that', replacement: 'because', confidence: 0.9, category: 'connector' },
  { pattern: 'for the purpose of', replacement: 'to', confidence: 0.9, category: 'connector' },
  { pattern: 'with the purpose of', replacement: 'to', confidence: 0.9, category: 'connector' },
  { pattern: 'at this point in time', replacement: 'now', confidence: 0.95, category: 'connector' },
  { pattern: 'at the present time', replacement: 'now', confidence: 0.95, category: 'connector' },
  { pattern: 'at this moment', replacement: 'now', confidence: 0.9, category: 'connector' },
  { pattern: 'on a daily basis', replacement: 'daily', confidence: 0.95, category: 'connector' },
  { pattern: 'on a regular basis', replacement: 'regularly', confidence: 0.95, category: 'connector' },
  { pattern: 'on a weekly basis', replacement: 'weekly', confidence: 0.95, category: 'connector' },
  { pattern: 'a large number of', replacement: 'many', confidence: 0.85, category: 'connector' },
  { pattern: 'a number of', replacement: 'several', confidence: 0.8, category: 'connector' },
  { pattern: 'in the event that', replacement: 'if', confidence: 0.95, category: 'connector' },
  { pattern: 'in the case that', replacement: 'if', confidence: 0.9, category: 'connector' },
  { pattern: 'in spite of the fact that', replacement: 'although', confidence: 0.9, category: 'connector' },
  { pattern: 'regardless of the fact that', replacement: 'although', confidence: 0.9, category: 'connector' },
  { pattern: 'with regard to', replacement: 'regarding', confidence: 0.9, category: 'connector' },
  { pattern: 'with regards to', replacement: 'regarding', confidence: 0.9, category: 'connector' },
  { pattern: 'in regard to', replacement: 'regarding', confidence: 0.9, category: 'connector' },
  { pattern: 'in regards to', replacement: 'regarding', confidence: 0.9, category: 'connector' },
  { pattern: 'with respect to', replacement: 'regarding', confidence: 0.85, category: 'connector' },
  { pattern: 'as a result of', replacement: 'because of', confidence: 0.85, category: 'connector' },
  { pattern: 'for the reason that', replacement: 'because', confidence: 0.9, category: 'connector' },
  { pattern: 'has the ability to', replacement: 'can', confidence: 0.95, category: 'connector' },
  { pattern: 'is able to', replacement: 'can', confidence: 0.9, category: 'connector' },
  { pattern: 'make a decision', replacement: 'decide', confidence: 0.9, category: 'connector' },
  { pattern: 'take into consideration', replacement: 'consider', confidence: 0.9, category: 'connector' },
  { pattern: 'take into account', replacement: 'consider', confidence: 0.85, category: 'connector' },
  { pattern: 'give an indication of', replacement: 'indicate', confidence: 0.9, category: 'connector' },
  { pattern: 'is indicative of', replacement: 'indicates', confidence: 0.85, category: 'connector' },
  { pattern: 'it is important to note that', replacement: '', confidence: 0.8, category: 'connector' },
  { pattern: 'it is worth noting that', replacement: '', confidence: 0.8, category: 'connector' },
  { pattern: 'it should be noted that', replacement: '', confidence: 0.8, category: 'connector' },

  // ── Redundant Verbiage ───────────────────────────────────────────
  { pattern: 'the reason why is because', replacement: 'because', confidence: 0.95, category: 'redundancy' },
  { pattern: 'the reason is because', replacement: 'because', confidence: 0.95, category: 'redundancy' },
  { pattern: 'the reason why', replacement: 'why', confidence: 0.85, category: 'redundancy' },
  { pattern: 'each and every', replacement: 'every', confidence: 0.95, category: 'redundancy' },
  { pattern: 'first and foremost', replacement: 'first', confidence: 0.85, category: 'redundancy' },
  { pattern: 'each and every one', replacement: 'each', confidence: 0.95, category: 'redundancy' },
  { pattern: 'basic fundamentals', replacement: 'fundamentals', confidence: 0.95, category: 'redundancy' },
  { pattern: 'completely eliminate', replacement: 'eliminate', confidence: 0.9, category: 'redundancy' },
  { pattern: 'absolutely essential', replacement: 'essential', confidence: 0.9, category: 'redundancy' },
  { pattern: 'final outcome', replacement: 'outcome', confidence: 0.9, category: 'redundancy' },
  { pattern: 'end result', replacement: 'result', confidence: 0.85, category: 'redundancy' },
  { pattern: 'past history', replacement: 'history', confidence: 0.9, category: 'redundancy' },
  { pattern: 'future plans', replacement: 'plans', confidence: 0.85, category: 'redundancy' },
  { pattern: 'added bonus', replacement: 'bonus', confidence: 0.9, category: 'redundancy' },
  { pattern: 'close proximity', replacement: 'proximity', confidence: 0.9, category: 'redundancy' },
  { pattern: 'still remains', replacement: 'remains', confidence: 0.85, category: 'redundancy' },
  { pattern: 'completely finished', replacement: 'finished', confidence: 0.9, category: 'redundancy' },
  { pattern: 'free gift', replacement: 'gift', confidence: 0.9, category: 'redundancy' },
  { pattern: 'help me out with', replacement: 'help with', confidence: 0.8, category: 'redundancy' },
  { pattern: 'there might possibly be', replacement: 'there might be', confidence: 0.8, category: 'redundancy' },
  { pattern: 'the way i want it to', replacement: 'properly', confidence: 0.7, category: 'redundancy' },
  { pattern: 'working the way i want it to', replacement: 'working', confidence: 0.8, category: 'redundancy' },
  { pattern: 'but dont make it too complicated', replacement: '', confidence: 0.7, category: 'redundancy' },


  // ── Filler Words (only safe-to-remove uses as standalone fillers) ─
  // These match as whole words only via the compressor's word-boundary check
  { pattern: 'just curious', replacement: '', confidence: 0.6, category: 'filler' },
  { pattern: 'just checking', replacement: '', confidence: 0.6, category: 'filler' },
  { pattern: 'basically', replacement: '', confidence: 0.7, category: 'filler' },
  { pattern: 'essentially', replacement: '', confidence: 0.65, category: 'filler' },
  { pattern: 'actually', replacement: '', confidence: 0.6, category: 'filler' },
  { pattern: 'literally', replacement: '', confidence: 0.7, category: 'filler' },
  { pattern: 'honestly', replacement: '', confidence: 0.65, category: 'filler' },
  { pattern: 'obviously', replacement: '', confidence: 0.6, category: 'filler' },
  { pattern: 'clearly', replacement: '', confidence: 0.55, category: 'filler' },
  { pattern: 'really', replacement: '', confidence: 0.5, category: 'filler' },
  { pattern: 'very', replacement: '', confidence: 0.45, category: 'filler' },
  { pattern: 'just', replacement: '', confidence: 0.5, category: 'filler' },
  { pattern: 'quite', replacement: '', confidence: 0.45, category: 'filler' },
  { pattern: 'kind of', replacement: '', confidence: 0.7, category: 'filler' },
  { pattern: 'sort of', replacement: '', confidence: 0.7, category: 'filler' },
  { pattern: 'real quick', replacement: '', confidence: 0.8, category: 'filler' },
  { pattern: 'something real quick', replacement: '', confidence: 0.8, category: 'filler' },
  { pattern: 'just kind of', replacement: '', confidence: 0.8, category: 'filler' },
  { pattern: 'i feel like', replacement: '', confidence: 0.7, category: 'filler' },
  { pattern: 'maybe', replacement: '', confidence: 0.6, category: 'filler' },

  // ── Polite Padding ───────────────────────────────────────────────
  { pattern: 'when you get a chance', replacement: '', confidence: 0.75, category: 'polite' },
  { pattern: 'whenever you get a chance', replacement: '', confidence: 0.75, category: 'polite' },
  { pattern: 'no rush but', replacement: '', confidence: 0.7, category: 'polite' },
  { pattern: 'if that makes sense', replacement: '', confidence: 0.9, category: 'polite' },
  { pattern: 'if that helps', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'hope that helps', replacement: '', confidence: 0.9, category: 'polite' },
  { pattern: 'hope this helps', replacement: '', confidence: 0.9, category: 'polite' },
  { pattern: 'thanks in advance', replacement: '', confidence: 0.8, category: 'polite' },
  { pattern: 'thank you in advance', replacement: '', confidence: 0.8, category: 'polite' },
  { pattern: 'sorry to bother you but', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'sorry to bother you', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'sorry for the long message but', replacement: '', confidence: 0.8, category: 'polite' },
  { pattern: 'sorry for the long message', replacement: '', confidence: 0.8, category: 'polite' },
  { pattern: 'i apologize if this is a dumb question but', replacement: '', confidence: 0.9, category: 'polite' },
  { pattern: 'i apologize if this is a stupid question but', replacement: '', confidence: 0.9, category: 'polite' },
  { pattern: 'let me know if you have any questions', replacement: '', confidence: 0.75, category: 'polite' },
  { pattern: 'please let me know', replacement: '', confidence: 0.6, category: 'polite' },
  { pattern: 'not sure if this is the right place to ask but', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'i don\'t know if this is the right way to ask but', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'if that\'s okay', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'if that is okay', replacement: '', confidence: 0.85, category: 'polite' },
  { pattern: 'thanks so much', replacement: 'thanks', confidence: 0.85, category: 'polite' },
  { pattern: 'i really appreciate it', replacement: '', confidence: 0.8, category: 'polite' },
  { pattern: 'i would really appreciate it', replacement: '', confidence: 0.8, category: 'polite' },

  // ── Conversational Padding ───────────────────────────────────────
  { pattern: 'anyway', replacement: '', confidence: 0.6, category: 'conversational' },
  { pattern: 'anyways', replacement: '', confidence: 0.6, category: 'conversational' },
  { pattern: 'you know?', replacement: '', confidence: 0.75, category: 'conversational' },
  { pattern: 'you know,', replacement: ',', confidence: 0.65, category: 'conversational' },
  { pattern: 'so the thing is', replacement: '', confidence: 0.85, category: 'conversational' },
  { pattern: 'the thing is', replacement: '', confidence: 0.8, category: 'conversational' },
  { pattern: 'the point is', replacement: '', confidence: 0.7, category: 'conversational' },
  { pattern: 'to be honest', replacement: '', confidence: 0.7, category: 'conversational' },
  { pattern: 'to be fair', replacement: '', confidence: 0.6, category: 'conversational' },
  { pattern: 'as you can see', replacement: '', confidence: 0.8, category: 'conversational' },
  { pattern: 'as you know', replacement: '', confidence: 0.75, category: 'conversational' },
  { pattern: 'as i mentioned', replacement: '', confidence: 0.7, category: 'conversational' },
  { pattern: 'as i said before', replacement: '', confidence: 0.75, category: 'conversational' },
  { pattern: 'as i was saying', replacement: '', confidence: 0.75, category: 'conversational' },
  { pattern: 'having said that', replacement: '', confidence: 0.6, category: 'conversational' },
  { pattern: 'that being said', replacement: '', confidence: 0.6, category: 'conversational' },
  { pattern: 'with that being said', replacement: '', confidence: 0.65, category: 'conversational' },
  { pattern: 'long story short', replacement: '', confidence: 0.7, category: 'conversational' },
  { pattern: 'to make a long story short', replacement: '', confidence: 0.75, category: 'conversational' },
  { pattern: 'needless to say', replacement: '', confidence: 0.8, category: 'conversational' },
  { pattern: 'it goes without saying that', replacement: '', confidence: 0.85, category: 'conversational' },
  { pattern: 'at the end of the day', replacement: '', confidence: 0.7, category: 'conversational' },
  { pattern: 'when all is said and done', replacement: '', confidence: 0.75, category: 'conversational' },
  { pattern: 'all things considered', replacement: '', confidence: 0.6, category: 'conversational' },
];

/**
 * Get the confidence threshold for a given aggressiveness level.
 * aggressiveness 1 → threshold 0.8 (only very safe removals)
 * aggressiveness 2 → threshold 0.6 (default, conservative)
 * aggressiveness 3 → threshold 0.4
 * aggressiveness 4 → threshold 0.2
 * aggressiveness 5 → threshold 0.0 (everything goes)
 */
function getConfidenceThreshold(aggressiveness) {
  return Math.max(0, 1 - (aggressiveness / 5));
}

/**
 * Get fillers that meet the confidence threshold.
 * @param {number} aggressiveness - 1-5
 * @returns {Array} Filtered filler entries
 */
function getActiveFillers(aggressiveness) {
  const threshold = getConfidenceThreshold(aggressiveness);
  return FILLERS.filter(f => f.confidence >= threshold);
}

/**
 * Check if a phrase is in the never-touch list.
 */
function isNeverTouch(phrase) {
  return NEVER_TOUCH.has(phrase.toLowerCase().trim());
}

module.exports = {
  FILLERS,
  NEVER_TOUCH,
  getActiveFillers,
  getConfidenceThreshold,
  isNeverTouch,
};
