'use strict';

/**
 * Synonym Shortener
 *
 * Replaces verbose words/phrases with shorter equivalents that LLMs
 * understand identically. Also enforces contractions.
 *
 * Each replacement is semantically equivalent — no meaning change.
 * All replacements are context-safe: matched at word boundaries only.
 *
 * Categories:
 * - tech_terms: Technical vocabulary shortenings (application → app)
 * - contractions: Expand → contract (do not → don't)
 * - verbose_phrases: Multi-word → shorter (for example → e.g.)
 */

const SHORTENINGS = [
  // ── Technical Vocabulary ────────────────────────────────────────
  { from: 'application',    to: 'app',       category: 'tech_terms', confidence: 0.9 },
  { from: 'applications',   to: 'apps',      category: 'tech_terms', confidence: 0.9 },
  { from: 'implementation', to: 'impl',      category: 'tech_terms', confidence: 0.85 },
  { from: 'implementations',to: 'impls',     category: 'tech_terms', confidence: 0.85 },
  { from: 'configuration',  to: 'config',    category: 'tech_terms', confidence: 0.9 },
  { from: 'configurations', to: 'configs',   category: 'tech_terms', confidence: 0.9 },
  { from: 'documentation',  to: 'docs',      category: 'tech_terms', confidence: 0.9 },
  { from: 'authentication', to: 'auth',      category: 'tech_terms', confidence: 0.9 },
  { from: 'authorization',  to: 'authz',     category: 'tech_terms', confidence: 0.85 },
  { from: 'environment',    to: 'env',       category: 'tech_terms', confidence: 0.85 },
  { from: 'environments',   to: 'envs',      category: 'tech_terms', confidence: 0.85 },
  { from: 'repository',     to: 'repo',      category: 'tech_terms', confidence: 0.9 },
  { from: 'repositories',   to: 'repos',     category: 'tech_terms', confidence: 0.9 },
  { from: 'dependencies',   to: 'deps',      category: 'tech_terms', confidence: 0.9 },
  { from: 'dependency',     to: 'dep',       category: 'tech_terms', confidence: 0.85 },
  { from: 'development',    to: 'dev',       category: 'tech_terms', confidence: 0.8 },
  { from: 'database',       to: 'DB',        category: 'tech_terms', confidence: 0.85 },
  { from: 'databases',      to: 'DBs',       category: 'tech_terms', confidence: 0.85 },
  { from: 'parameters',     to: 'params',    category: 'tech_terms', confidence: 0.9 },
  { from: 'parameter',      to: 'param',     category: 'tech_terms', confidence: 0.9 },
  { from: 'directory',      to: 'dir',       category: 'tech_terms', confidence: 0.9 },
  { from: 'directories',    to: 'dirs',      category: 'tech_terms', confidence: 0.9 },
  { from: 'navigation',     to: 'nav',       category: 'tech_terms', confidence: 0.85 },
  { from: 'information',    to: 'info',      category: 'tech_terms', confidence: 0.85 },
  { from: 'functionality',  to: 'features',  category: 'tech_terms', confidence: 0.8 },
  { from: 'specification',  to: 'spec',      category: 'tech_terms', confidence: 0.85 },
  { from: 'specifications', to: 'specs',     category: 'tech_terms', confidence: 0.85 },
  { from: 'properties',     to: 'props',     category: 'tech_terms', confidence: 0.85 },
  { from: 'components',     to: 'comps',     category: 'tech_terms', confidence: 0.75 },
  { from: 'administration', to: 'admin',     category: 'tech_terms', confidence: 0.9 },
  { from: 'administrator',  to: 'admin',     category: 'tech_terms', confidence: 0.9 },
  { from: 'temporary',      to: 'temp',      category: 'tech_terms', confidence: 0.8 },
  { from: 'arguments',      to: 'args',      category: 'tech_terms', confidence: 0.9 },
  { from: 'argument',       to: 'arg',       category: 'tech_terms', confidence: 0.9 },
  { from: 'command line',   to: 'CLI',       category: 'tech_terms', confidence: 0.8 },
  { from: 'user interface', to: 'UI',        category: 'tech_terms', confidence: 0.9 },
  { from: 'application programming interface', to: 'API', category: 'tech_terms', confidence: 0.95 },

  // ── Contraction Enforcement ─────────────────────────────────────
  { from: 'do not',     to: "don't",     category: 'contraction', confidence: 0.95 },
  { from: 'does not',   to: "doesn't",   category: 'contraction', confidence: 0.95 },
  { from: 'did not',    to: "didn't",    category: 'contraction', confidence: 0.95 },
  { from: 'is not',     to: "isn't",     category: 'contraction', confidence: 0.95 },
  { from: 'are not',    to: "aren't",    category: 'contraction', confidence: 0.95 },
  { from: 'was not',    to: "wasn't",    category: 'contraction', confidence: 0.95 },
  { from: 'were not',   to: "weren't",   category: 'contraction', confidence: 0.95 },
  { from: 'will not',   to: "won't",     category: 'contraction', confidence: 0.95 },
  { from: 'would not',  to: "wouldn't",  category: 'contraction', confidence: 0.95 },
  { from: 'could not',  to: "couldn't",  category: 'contraction', confidence: 0.95 },
  { from: 'should not', to: "shouldn't", category: 'contraction', confidence: 0.95 },
  { from: 'can not',    to: "can't",     category: 'contraction', confidence: 0.95 },
  { from: 'cannot',     to: "can't",     category: 'contraction', confidence: 0.95 },
  { from: 'have not',   to: "haven't",   category: 'contraction', confidence: 0.9 },
  { from: 'has not',    to: "hasn't",    category: 'contraction', confidence: 0.9 },
  { from: 'had not',    to: "hadn't",    category: 'contraction', confidence: 0.9 },
  { from: 'it is',      to: "it's",      category: 'contraction', confidence: 0.8 },
  { from: 'it has',     to: "it's",      category: 'contraction', confidence: 0.75 },
  { from: 'that is',    to: "that's",    category: 'contraction', confidence: 0.8 },
  { from: 'there is',   to: "there's",   category: 'contraction', confidence: 0.8 },
  { from: 'there are',  to: "there're",  category: 'contraction', confidence: 0.7 },
  { from: 'i am',       to: "I'm",       category: 'contraction', confidence: 0.9 },
  { from: 'i have',     to: "I've",      category: 'contraction', confidence: 0.9 },
  { from: 'i will',     to: "I'll",      category: 'contraction', confidence: 0.9 },
  { from: 'i would',    to: "I'd",       category: 'contraction', confidence: 0.9 },
  { from: 'we are',     to: "we're",     category: 'contraction', confidence: 0.85 },
  { from: 'we have',    to: "we've",     category: 'contraction', confidence: 0.85 },
  { from: 'we will',    to: "we'll",     category: 'contraction', confidence: 0.85 },
  { from: 'you are',    to: "you're",    category: 'contraction', confidence: 0.85 },
  { from: 'you have',   to: "you've",    category: 'contraction', confidence: 0.85 },
  { from: 'you will',   to: "you'll",    category: 'contraction', confidence: 0.85 },
  { from: 'they are',   to: "they're",   category: 'contraction', confidence: 0.85 },
  { from: 'they have',  to: "they've",   category: 'contraction', confidence: 0.85 },
  { from: 'they will',  to: "they'll",   category: 'contraction', confidence: 0.85 },

  // ── Verbose Phrases ─────────────────────────────────────────────
  { from: 'approximately', to: 'approx',    category: 'verbose_phrase', confidence: 0.85 },
  { from: 'for example',   to: 'e.g.',      category: 'verbose_phrase', confidence: 0.85 },
  { from: 'that is to say',to: 'i.e.',      category: 'verbose_phrase', confidence: 0.9 },
  { from: 'and so on',     to: 'etc.',      category: 'verbose_phrase', confidence: 0.85 },
  { from: 'and so forth',  to: 'etc.',      category: 'verbose_phrase', confidence: 0.85 },
  { from: 'and more',      to: 'etc.',      category: 'verbose_phrase', confidence: 0.7 },
  { from: 'as well as',    to: '&',         category: 'verbose_phrase', confidence: 0.7 },
  { from: 'in addition to',to: '+',         category: 'verbose_phrase', confidence: 0.65 },
  { from: 'with the exception of', to: 'except', category: 'verbose_phrase', confidence: 0.9 },
  { from: 'on the other hand',     to: 'conversely', category: 'verbose_phrase', confidence: 0.8 },
  { from: 'as a matter of fact',   to: 'in fact', category: 'verbose_phrase', confidence: 0.9 },
];

/**
 * Words/phrases that should NEVER be shortened because the short form
 * is ambiguous in certain contexts.
 */
const NEVER_SHORTEN = new Set([
  // 'it is' at sentence start could be emphasis, not just contraction
  // (handled by confidence levels instead)
]);

/**
 * Get active shortenings for a given aggressiveness level.
 *
 * @param {number} aggressiveness - 1-5
 * @returns {Array} Filtered shortening entries
 */
function getActiveShortenings(aggressiveness) {
  const threshold = Math.max(0, 1 - (aggressiveness / 5));
  return SHORTENINGS.filter(s => s.confidence >= threshold);
}

/**
 * Apply synonym shortenings to editable text.
 * Matches are case-insensitive but preserve surrounding structure.
 *
 * @param {string} text - Editable text (not protected segments)
 * @param {number} aggressiveness - 1-5
 * @param {Set} [excludedPhrases] - Phrases excluded by the learning system
 * @returns {{ text: string, replacements: Array<{from: string, to: string}> }}
 */
function applyShortenings(text, aggressiveness = 3, excludedPhrases = new Set()) {
  const active = getActiveShortenings(aggressiveness);
  const replacements = [];
  let result = text;

  // Sort by length (longest first) to avoid partial matches
  const sorted = [...active].sort((a, b) => b.from.length - a.from.length);

  for (const entry of sorted) {
    if (excludedPhrases.has(entry.from.toLowerCase())) continue;

    const escaped = entry.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isMultiWord = entry.from.includes(' ');

    let regexStr;
    if (isMultiWord) {
      regexStr = `(?:^|(?<=\\s))${escaped}(?=\\s|[.,;:!?]|$)`;
    } else {
      regexStr = `\\b${escaped}\\b`;
    }

    const regex = new RegExp(regexStr, 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(result)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        matched: match[0],
      });
    }

    if (matches.length === 0) continue;

    // Apply from end to start
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      let rep = entry.to;

      // Preserve capitalization for first word
      if (m.matched[0] === m.matched[0].toUpperCase() && m.matched[0] !== m.matched[0].toLowerCase()) {
        rep = rep.charAt(0).toUpperCase() + rep.slice(1);
      }

      result = result.slice(0, m.index) + rep + result.slice(m.index + m.length);

      replacements.push({
        from: entry.from,
        to: entry.to,
        original: m.matched,
      });
    }
  }

  return { text: result, replacements };
}

module.exports = {
  SHORTENINGS,
  getActiveShortenings,
  applyShortenings,
};
