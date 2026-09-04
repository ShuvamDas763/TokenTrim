'use strict';

const { EventEmitter } = require('events');
const sessionCache = require('./session-cache');
const multiPass = require('./multi-pass');
const tokenizer = require('./tier0/tokenizer');
const tier1 = require('./tier1/llm-compressor');
const providerChain = require('./tier1/provider-chain');
const phraseLog = require('./learning/phrase-log');
const { getSetting } = require('./config');
const notificationManager = require('./notification-manager');
const sessionAnalytics = require('./session-analytics');
const { checkAndShowDisclosure } = require('./privacy/disclosure');
const { checkSecretWarning } = require('./privacy/secret-detector');

/**
 * Pipeline Orchestrator (100% Local Default)
 *
 * Central hub for TokenTrim:
 * 1. Checks cache
 * 2. Uses BPE tokenizer for exact measurement
 * 3. Runs Multi-Pass Local Engine
 * 4. Checks if target compression is met
 * 5. Escalate to Cloud (Tier 1) ONLY if target missed AND opt-in is enabled
 */

class Pipeline extends EventEmitter {
  constructor() {
    super();
    this._lastRemovals = []; // Track last removals for undo/learning
  }

  /**
   * Process text through the compression pipeline.
   */
  async process(inputText) {
    const startTime = Date.now();
    
    if (!inputText || inputText.trim().length === 0) {
      return this._createOutput(inputText, inputText, 0, false, [], 'none', 0, 0, 0);
    }

    const presetName = await getSetting('compressionPreset') || 'balanced';
    const enableCloudFallback = await getSetting('enableCloudFallback');
    const compressionTarget = await getSetting('compressionTarget') || 0.50; // default 50% target

    // 1. Check session cache
    const cached = sessionCache.get(inputText, presetName);
    if (cached) {
      console.log(`[pipeline] Cache hit (preset: ${presetName})`);
      this.emit('state', 'idle');
      return cached;
    }

    // 2. Measure input exactly
    const inputTokens = tokenizer.countTokens(inputText);
    console.log(`[pipeline] Input tokens: ${inputTokens} (measured with BPE)`);

    // Extremely short? Skip
    if (inputTokens < 10) {
      return this._createOutput(inputText, inputText, 0, false, [], 'none', inputTokens, inputTokens, 0);
    }

    this.emit('state', 'compressing');

    // 3. Multi-Pass Local Engine
    const excludedPhrases = phraseLog.getExcludedSet();
    const localResult = multiPass.compress(inputText, presetName, excludedPhrases);
    
    this._lastRemovals = localResult.removals;
    const localTokens = localResult.finalTokens;
    const localReduction = (inputTokens - localTokens) / inputTokens;

    console.log(`[pipeline] Local Multi-Pass: ${inputTokens} → ${localTokens} tokens (-${Math.round(localReduction * 100)}%) in ${localResult.passes} passes`);

    // 4. Evaluate success and decide on cloud fallback
    let finalResult = localResult.result;
    let finalTokens = localTokens;
    let usedCloud = false;
    let providerUsed = 'local';
    let outputTier = localResult.passes > 1 ? 'multi-pass' : 'tier0';

    const targetMet = localReduction >= compressionTarget;
    
    if (!targetMet && enableCloudFallback && inputTokens > 200) {
      // Cloud fallback branch
      if (providerChain.hasAnyAvailable()) {
        console.log(`[pipeline] Target missed (${Math.round(localReduction*100)}% < ${Math.round(compressionTarget*100)}%). Escalating to cloud...`);
        
        // Privacy Checks
        let cloudAborted = false;
        if (!(await checkAndShowDisclosure()) || !(await checkSecretWarning(inputText))) {
          console.log('[pipeline] Cloud fallback aborted by privacy dialog');
          cloudAborted = true;
        }

        if (!cloudAborted) {
          notificationManager.notifyTier1Start({ provider: 'API' });
          const cloudResult = await tier1.compress(finalResult); // Feed it the local result to save API tokens
          
          if (cloudResult.success) {
            const cloudTokens = tokenizer.countTokens(cloudResult.result);
            if (cloudTokens < localTokens) { // Only use cloud if it actually helped more
              finalResult = cloudResult.result;
              finalTokens = cloudTokens;
              usedCloud = true;
              providerUsed = cloudResult.provider;
              outputTier = 'tier1_cloud';
              console.log(`[pipeline] Cloud success: ${localTokens} → ${cloudTokens} tokens via ${providerUsed}`);
            } else {
              console.log(`[pipeline] Cloud didn't improve upon local. Sticking with local.`);
            }
          } else {
            console.warn('[pipeline] Cloud fallback failed. Sticking with local.');
          }
        }
      }
    }

    // 5. Build output and cache
    const durationMs = Date.now() - startTime;
    const output = this._createOutput(
      inputText, 
      finalResult, 
      outputTier, 
      finalResult !== inputText, 
      localResult.removals, 
      providerUsed, 
      inputTokens, 
      finalTokens, 
      durationMs
    );

    sessionCache.set(inputText, presetName, output);
    
    // 6. Record analytics
    sessionAnalytics.record(inputTokens, finalTokens, usedCloud);

    // Record auto-applies for local if preview is off
    const tier0Preview = await getSetting('tier0Preview');
    if (!tier0Preview && localResult.removals.length > 0 && !usedCloud) {
      const phrases = localResult.removals.map(r => r.phrase);
      phraseLog.recordBatchApply(phrases);
    }

    // Notify
    if (usedCloud) {
      notificationManager.notifyTier1Complete({
        provider: providerUsed,
        durationMs,
        originalTokens: inputTokens,
        compressedTokens: finalTokens
      });
    } else if (localResult.changed) {
      notificationManager.notifyCompressionSuccess({
        originalTokens: inputTokens,
        compressedTokens: finalTokens,
        tier: 'local',
        provider: 'local',
        durationMs,
        passes: localResult.passes
      });
    }

    this.emit('state', 'idle');
    return output;
  }

  _createOutput(originalText, resultText, tier, changed, removals, provider, originalTokens, compressedTokens, durationMs) {
    return {
      result: resultText,
      tier,
      changed,
      needsPreview: changed, // App handles specifics of whether to show preview
      removals,
      originalText,
      provider,
      originalTokens,
      compressedTokens,
      durationMs
    };
  }

  getLastRemovals() {
    return [...this._lastRemovals];
  }

  acceptLast() {
    if (this._lastRemovals.length > 0) {
      const phrases = this._lastRemovals.map(r => r.phrase);
      phraseLog.recordBatchApply(phrases);
    }
  }

  revertLast() {
    if (this._lastRemovals.length > 0) {
      const phrases = this._lastRemovals.map(r => r.phrase);
      phraseLog.recordBatchRevert(phrases);
    }
  }
}

module.exports = new Pipeline();
