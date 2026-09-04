'use strict';

/**
 * Local Tier 1 Compressor
 *
 * Provides deep semantic compression entirely locally. Replaces the need
 * for LLM APIs for the vast majority of prompts.
 *
 * Techniques:
 * 1. Extractive sentence scoring (drops low-info sentences)
 * 2. Clause pruning (parentheticals, trailing qualifiers)
 * 3. Pronoun resolution (if referent sentence is dropped)
 * 4. Prompt restructuring (intent + constraints)
 */

const { splitSentences, tokenize, informationDensity } = require('../tier0/deduplicator');
const { parseSegments, SEGMENT_TYPES } = require('../tier0/segment-parser');

// ── 1. Extractive Sentence Scoring ────────────────────────────────

const CONSTRAINT_KEYWORDS = new Set(['must', 'should', 'always', 'never', 'only', 'don\'t', 'do not', 'cannot', 'can\'t', 'required', 'needs to', 'important', 'make sure', 'ensure']);
const TECHNICAL_KEYWORDS = new Set(['code', 'function', 'class', 'api', 'database', 'db', 'frontend', 'backend', 'server', 'client', 'react', 'node', 'python', 'javascript', 'js', 'html', 'css', 'sql', 'json', 'xml', 'yaml', 'yml', 'docker', 'git']);

/**
 * Score a sentence's importance (0 to ~2.0+).
 * Sentences below a threshold get dropped.
 *
 * @param {string} text - Sentence text
 * @param {number} index - Index in paragraph
 * @param {number} totalInParagraph - Total sentences in paragraph
 * @returns {number} Score
 */
function scoreSentence(text, index, totalInParagraph) {
  const terms = tokenize(text);
  if (terms.length === 0) return 0;

  // Base score: information density
  let score = informationDensity(terms);

  // Structural position bonus
  if (index === 0 || index === totalInParagraph - 1) {
    score *= 1.2;
  }

  // Length bonus for very short, punchy sentences (often direct commands)
  if (terms.length < 5) {
    score *= 1.1;
  }

  const lowerText = text.toLowerCase();

  // Keyword boost
  let hasTech = false;
  let hasConstraint = false;

  for (const term of terms) {
    if (TECHNICAL_KEYWORDS.has(term)) hasTech = true;
    if (CONSTRAINT_KEYWORDS.has(term)) hasConstraint = true;
  }

  // Phrasal constraint checks
  if (!hasConstraint) {
    for (const kw of CONSTRAINT_KEYWORDS) {
      if (lowerText.includes(kw)) {
        hasConstraint = true;
        break;
      }
    }
  }

  if (hasTech) score *= 1.3;
  if (hasConstraint) score *= 1.5;

  // Question boost (actual request)
  if (text.includes('?')) {
    score *= 1.5;
  }

  return score;
}

// ── 2. Clause Pruning ─────────────────────────────────────────────

/**
 * Prune low-value clauses from a sentence.
 *
 * @param {string} sentence
 * @returns {string}
 */
function pruneClauses(sentence) {
  let result = sentence;

  // Remove parentheticals unless they contain numbers or technical terms
  // Example: "The button (just a thought) should be blue" -> "The button should be blue"
  result = result.replace(/\(([^)]+)\)/g, (match, content) => {
    const terms = tokenize(content);
    const hasNumbers = /\d/.test(content);
    const hasTech = terms.some(t => TECHNICAL_KEYWORDS.has(t));
    if (hasNumbers || hasTech) return match; // Keep it
    return ''; // Prune it
  });

  // Remove trailing qualifiers
  const qualifiers = [
    ', but i\'m not sure', ', if that makes sense', ', or whatever works',
    ', if possible', ', maybe', ', i think'
  ];

  for (const q of qualifiers) {
    if (result.toLowerCase().endsWith(q + '.') || result.toLowerCase().endsWith(q)) {
      result = result.substring(0, result.length - q.length - (result.endsWith('.') ? 1 : 0));
      if (!result.endsWith('.')) result += '.';
      break;
    }
  }

  // Clean up double spaces left by pruning
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

// ── 3. Pronoun Resolution ─────────────────────────────────────────

/**
 * Very lightweight heuristic pronoun resolution.
 * If a kept sentence starts with "It/This/That" and the PREVIOUS sentence
 * was dropped, we try to pull the subject forward to avoid a dangling reference.
 *
 * @param {Array<{text: string, kept: boolean, subject: string|null}>} sentenceData
 */
function resolvePronouns(sentenceData) {
  for (let i = 1; i < sentenceData.length; i++) {
    const current = sentenceData[i];
    if (!current.kept) continue;

    // Find the most recent sentence (kept or dropped)
    const prev = sentenceData[i - 1];

    if (!prev.kept && prev.subject) {
      // Prev was dropped. Does current start with a pronoun?
      const match = current.text.match(/^(It|This|That)\s+(is|should|needs|has|will|can|must)\b/i);
      if (match) {
        // Replace pronoun with the subject from the dropped sentence
        const pronoun = match[1];
        // Capitalize subject
        const subject = prev.subject.charAt(0).toUpperCase() + prev.subject.slice(1);
        current.text = current.text.replace(new RegExp(`^${pronoun}`, 'i'), subject);
      }
    }
  }
}

/**
 * Extract a likely subject from a sentence (very naive heuristic).
 * Looks for the first noun phrase before the main verb.
 *
 * @param {string} sentence
 * @returns {string|null}
 */
function extractSubject(sentence) {
  // Simple heuristic: take words before the first common verb
  const match = sentence.match(/^([^,]+?)\s+(is|should|needs|has|will|can|must|does)\b/i);
  if (match) {
    let subject = match[1].trim();
    // Strip leading articles
    subject = subject.replace(/^(the|a|an)\s+/i, '');
    if (subject.split(' ').length <= 4) { // Don't take huge phrases
      return subject;
    }
  }
  return null;
}

// ── 4. Prompt Restructuring ───────────────────────────────────────

/**
 * Detect common prompt intents (build, fix, explain) and restructure.
 *
 * @param {string} text
 * @returns {string}
 */
function restructurePrompt(text) {
  // For v1 of the local compressor, we'll do lightweight restructuring.
  // Full intent-parsing is complex without a model, but we can do keyword-based prefixing.

  // Example: move explicit constraints to the very beginning.
  const constraints = [];
  const others = [];

  const sentences = splitSentences(text);
  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    if (lower.startsWith('must ') || lower.startsWith('never ') || lower.includes(' is required')) {
      constraints.push(s.text);
    } else {
      others.push(s.text);
    }
  }

  if (constraints.length > 0 && others.length > 0) {
    return "CONSTRAINTS: " + constraints.join(' ') + "\n\n" + others.join(' ');
  }

  return text;
}

// ── Main Pipeline ─────────────────────────────────────────────────

/**
 * Compress text using Tier 1 local algorithms.
 *
 * @param {string} text
 * @param {number} dropThreshold - 0 to 1. Higher drops more. (Default 0.2 = drop bottom 20%)
 * @returns {{ text: string, changed: boolean }}
 */
function compressLocal(text, dropThreshold = 0.2) {
  if (!text || text.trim().length === 0) return { text, changed: false };

  // We only run this on editable text, so we must parse segments first
  const segments = parseSegments(text);

  let anyChanged = false;

  const processedSegments = segments.map(segment => {
    if (segment.protected) return { ...segment };

    let content = segment.content;

    // Split into paragraphs to preserve structure
    const paragraphs = content.split(/\n\n+/);
    const processedParagraphs = paragraphs.map(para => {
      if (para.trim().length === 0) return para;

      const sentences = splitSentences(para);
      if (sentences.length <= 1) return para; // Don't extractive-compress single-sentence paragraphs

      // 1. Score sentences
      const sentenceData = sentences.map((s, idx) => ({
        text: pruneClauses(s.text),
        score: scoreSentence(s.text, idx, sentences.length),
        subject: extractSubject(s.text),
        kept: true,
      }));

      // Find threshold score (e.g. 20th percentile)
      const scores = sentenceData.map(s => s.score).sort((a, b) => a - b);
      const thresholdIndex = Math.floor(scores.length * dropThreshold);
      const cutoffScore = scores[Math.min(thresholdIndex, scores.length - 1)];

      // Mark dropped
      let droppedCount = 0;
      for (const s of sentenceData) {
        if (s.score <= cutoffScore && droppedCount < thresholdIndex) {
          // Never drop questions or constraints, even if they somehow scored low
          if (!s.text.includes('?') && !s.text.match(/\b(must|should|never|only)\b/i)) {
            s.kept = false;
            droppedCount++;
            anyChanged = true;
          }
        }
      }

      // 3. Resolve pronouns for kept sentences
      resolvePronouns(sentenceData);

      // Reassemble paragraph
      return sentenceData.filter(s => s.kept).map(s => s.text).join(' ');
    });

    let result = processedParagraphs.join('\n\n');

    // 4. Lightweight restructuring
    const restructured = restructurePrompt(result);
    if (restructured !== result) {
      result = restructured;
      anyChanged = true;
    }

    return { ...segment, content: result };
  });

  if (!anyChanged) return { text, changed: false };

  // Reassemble segments
  let finalResult = '';
  for (const seg of processedSegments) {
    finalResult += seg.content;
  }

  return { text: finalResult, changed: true };
}

module.exports = {
  compressLocal,
  scoreSentence,
  pruneClauses,
  resolvePronouns,
};
