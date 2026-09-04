'use strict';

/**
 * Multi-Pass Convergence Engine
 *
 * Runs the Tier 0 and Tier 1 Local compression passes repeatedly until
 * the number of tokens saved drops below the convergence threshold,
 * or the maximum number of passes is reached.
 *
 * Why? Each pass can expose new opportunities. E.g., stripping fillers
 * might make two sentences identical, which the deduplicator catches
 * on pass 2.
 */

const tier0 = require('./tier0/compressor');
const tier1Local = require('./tier1/local-compressor');
const presets = require('./compression-presets');
const tokenizer = require('./tier0/tokenizer');

const CONVERGENCE_THRESHOLD = 5; // Stop if we save fewer than this many tokens

/**
 * Run the multi-pass compression algorithm.
 *
 * @param {string} inputText
 * @param {string} presetName
 * @param {Set} excludedPhrases
 * @returns {{
 *   result: string,
 *   passes: number,
 *   changed: boolean,
 *   tier0Result: string,
 *   removals: Array,
 *   finalTokens: number
 * }}
 */
function compress(inputText, presetName, excludedPhrases) {
  let currentText = inputText;
  let pass = 0;
  let totalChanged = false;
  
  const preset = presets.getPreset(presetName);
  const maxPasses = preset.maxPasses || 1;
  
  // Track state from the first pass
  let tier0ResultText = inputText;
  let allRemovals = [];
  
  let currentTokens = tokenizer.countTokens(currentText);

  while (pass < maxPasses) {
    pass++;
    let textAtStartOfPass = currentText;
    
    // --- Run Tier 0 ---
    const t0 = tier0.compress(
      currentText,
      preset.aggressiveness,
      excludedPhrases,
      preset.removeHedging
    );
    
    currentText = t0.result;
    
    if (pass === 1) {
      tier0ResultText = t0.result;
      allRemovals = t0.removals;
    } else if (t0.removals && t0.removals.length > 0) {
      // Append new removals found in subsequent passes
      allRemovals = allRemovals.concat(t0.removals);
    }

    // --- Run Tier 1 Local (if enabled for preset) ---
    if (preset.enableLocalTier1) {
      const dropThreshold = preset.dropThreshold || 0.2;
      const t1 = tier1Local.compressLocal(currentText, dropThreshold);
      currentText = t1.result;
    }
    
    const newTokens = tokenizer.countTokens(currentText);
    const tokensSavedThisPass = currentTokens - newTokens;
    
    if (currentText !== textAtStartOfPass) {
      totalChanged = true;
    }
    
    // Convergence check
    if (tokensSavedThisPass < CONVERGENCE_THRESHOLD) {
      break;
    }
    
    currentTokens = newTokens;
  }
  
  return {
    result: currentText,
    passes: pass,
    changed: totalChanged,
    tier0Result: tier0ResultText,
    removals: allRemovals,
    finalTokens: currentTokens
  };
}

module.exports = {
  compress,
};
