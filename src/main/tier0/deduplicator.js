'use strict';

/**
 * Sentence Deduplicator
 *
 * Uses TF-IDF cosine similarity to detect when the user says the same
 * thing multiple ways. Merges near-duplicate sentences, keeping the
 * most information-dense version.
 *
 * All computations are local — pure math, zero API calls.
 * Performance: O(n²) on sentence count, but n < 50 for any realistic prompt.
 */

/**
 * Tokenize a sentence into lowercase terms, stripping punctuation.
 *
 * @param {string} sentence
 * @returns {string[]}
 */
function tokenize(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1); // Drop single chars
}

/**
 * Build a term-frequency map for a list of terms.
 *
 * @param {string[]} terms
 * @returns {Map<string, number>}
 */
function termFrequency(terms) {
  const tf = new Map();
  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1);
  }
  // Normalize by total term count
  const total = terms.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / total);
  }
  return tf;
}

/**
 * Build the IDF (inverse document frequency) map from a collection of documents.
 *
 * @param {Array<string[]>} documents - Array of tokenized documents (term arrays)
 * @returns {Map<string, number>}
 */
function inverseDocumentFrequency(documents) {
  const idf = new Map();
  const N = documents.length || 1;

  // Count how many documents contain each term
  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      idf.set(term, (idf.get(term) || 0) + 1);
    }
  }

  // Compute IDF: log(N / df) — terms in every document get low weight
  for (const [term, df] of idf) {
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1); // Smoothed IDF
  }

  return idf;
}

/**
 * Build a TF-IDF vector for a single document.
 *
 * @param {Map<string, number>} tf - Term frequency map
 * @param {Map<string, number>} idf - Inverse document frequency map
 * @returns {Map<string, number>} TF-IDF weighted vector
 */
function tfidfVector(tf, idf) {
  const vec = new Map();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) || 1;
    vec.set(term, tfVal * idfVal);
  }
  return vec;
}

/**
 * Compute cosine similarity between two TF-IDF vectors.
 *
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number} Similarity in [0, 1]
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Dot product (only on shared terms)
  for (const [term, valA] of a) {
    const valB = b.get(term) || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
  }

  for (const [, valB] of b) {
    normB += valB * valB;
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

/**
 * Calculate information density for a sentence.
 * Higher density = more unique information per word.
 *
 * @param {string[]} terms - Tokenized sentence
 * @returns {number}
 */
function informationDensity(terms) {
  if (terms.length === 0) return 0;
  const unique = new Set(terms).size;
  return unique / terms.length;
}

/**
 * Split text into sentences. Handles common sentence boundaries
 * while preserving structure.
 *
 * @param {string} text
 * @returns {Array<{text: string, index: number}>}
 */
function splitSentences(text) {
  const sentences = [];
  // Split on sentence-ending punctuation followed by whitespace or end
  const parts = text.split(/(?<=[.!?])\s+/);

  let idx = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      sentences.push({ text: trimmed, index: idx });
    }
    idx += part.length + 1; // +1 for the split whitespace
  }

  return sentences;
}

/**
 * Deduplicate sentences in text using TF-IDF cosine similarity.
 *
 * @param {string} text - Input text
 * @param {number} [threshold=0.65] - Similarity threshold for merging (0-1)
 * @returns {{ text: string, removed: number, merges: Array<{kept: string, dropped: string, similarity: number}> }}
 */
function deduplicate(text, threshold = 0.65) {
  if (!text || text.trim().length === 0) {
    return { text, removed: 0, merges: [] };
  }

  const sentences = splitSentences(text);

  if (sentences.length < 2) {
    return { text, removed: 0, merges: [] };
  }

  // Tokenize all sentences
  const tokenizedSentences = sentences.map(s => tokenize(s.text));

  // Build IDF from all sentences
  const idf = inverseDocumentFrequency(tokenizedSentences);

  // Build TF-IDF vectors
  const vectors = tokenizedSentences.map(terms => {
    const tf = termFrequency(terms);
    return tfidfVector(tf, idf);
  });

  // Calculate information density for each sentence
  const densities = tokenizedSentences.map(terms => informationDensity(terms));

  // Find near-duplicate pairs
  const dropped = new Set(); // Indices of sentences to drop
  const merges = [];

  for (let i = 0; i < sentences.length; i++) {
    if (dropped.has(i)) continue;

    for (let j = i + 1; j < sentences.length; j++) {
      if (dropped.has(j)) continue;

      const sim = cosineSimilarity(vectors[i], vectors[j]);

      if (sim >= threshold) {
        // Keep the sentence with higher information density
        // Tie-break: keep the longer sentence (usually more specific)
        const keepI = densities[i] >= densities[j] ||
          (densities[i] === densities[j] && sentences[i].text.length >= sentences[j].text.length);

        const dropIdx = keepI ? j : i;
        const keepIdx = keepI ? i : j;

        dropped.add(dropIdx);
        merges.push({
          kept: sentences[keepIdx].text,
          dropped: sentences[dropIdx].text,
          similarity: Math.round(sim * 100) / 100,
        });

        // If we dropped i, stop comparing i against others
        if (dropIdx === i) break;
      }
    }
  }

  // Rebuild text without dropped sentences
  const keptSentences = sentences
    .filter((_, idx) => !dropped.has(idx))
    .map(s => s.text);

  return {
    text: keptSentences.join(' '),
    removed: dropped.size,
    merges,
  };
}

module.exports = {
  deduplicate,
  cosineSimilarity,
  splitSentences,
  tokenize,
  informationDensity,
};
