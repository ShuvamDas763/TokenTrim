'use strict';

const { EventEmitter } = require('events');
const sessionCache = require('./session-cache');
const tier0 = require('./tier0/compressor');
const tier1 = require('./tier1/llm-compressor');
const providerChain = require('./tier1/provider-chain');
const phraseLog = require('./learning/phrase-log');
const { getSetting } = require('./config');
const notificationManager = require('./notification-manager');
const presets = require('./compression-presets');
const { checkAndShowDisclosure } = require('./privacy/disclosure');
const { checkSecretWarning } = require('./privacy/secret-detector');

/**
 * Pipeline Orchestrator
 *
 * Central hub that ties Tier 0 and Tier 1 together:
 * 1. Check session cache
 * 2. Classify input as SHORT or LONG
 * 3. Run Tier 0
 * 4. Escalate to Tier 1 only if LONG
 * 5. Cache result
 *
 * Emits events for tray icon state updates.
 */

class Pipeline extends EventEmitter {
  constructor() {
    super();
    this._lastRemovals = []; // Track last Tier 0 removals for undo/learning
  }

  /**
   * Estimate token count. Simple heuristic: ~1.3 tokens per word.
   */
  _estimateTokens(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(words * 1.3);
  }

  /**
   * Classify text as SHORT or LONG based on estimated token count.
   */
  async _classify(text) {
    const threshold = await getSetting('tokenThreshold') || 250;
    const tokens = this._estimateTokens(text);
    return {
      type: tokens <= threshold ? 'SHORT' : 'LONG',
      estimatedTokens: tokens,
    };
  }

  /**
   * Process text through the compression pipeline.
   *
   * @param {string} inputText - Raw input text
   * @returns {Promise<{
   *   result: string,
   *   tier: 0|1,
   *   changed: boolean,
   *   needsPreview: boolean,
   *   removals: Array,
   *   originalText: string,
   *   tier0Result: string,
   *   provider?: string,
   *   allExhausted?: boolean,
   * }>}
   */
  async process(inputText) {
    const startTime = Date.now();
    
    if (!inputText || inputText.trim().length === 0) {
      return {
        result: inputText,
        tier: 0,
        changed: false,
        needsPreview: false,
        removals: [],
        originalText: inputText,
        tier0Result: inputText,
      };
    }

    const presetName = await getSetting('compressionPreset') || 'balanced';

    // 1. Check session cache
    const cached = sessionCache.get(inputText, presetName);
    if (cached) {
      console.log(`[pipeline] Cache hit (preset: ${presetName})`);
      this.emit('state', 'idle');
      return cached;
    }

    // 2. Classify
    const classification = await this._classify(inputText);
    console.log(`[pipeline] Classified as ${classification.type} (~${classification.estimatedTokens} tokens)`);

    // 3. Run Tier 0
    this.emit('state', 'tier0');

    const preset = presets.getPreset(presetName);
    const excludedPhrases = phraseLog.getExcludedSet();
    const tier0Result = tier0.compress(inputText, preset.aggressiveness, excludedPhrases, preset.removeHedging);

    this._lastRemovals = tier0Result.removals;

    console.log(`[pipeline] Tier 0: ${inputText.length} → ${tier0Result.result.length} chars (${tier0Result.removals.length} removals)`);

    // 4. Decide on escalation
    const tier0Preview = await getSetting('tier0Preview');
    const tier1Preview = await getSetting('tier1Preview');

    // SHORT: never escalate to Tier 1
    if (classification.type === 'SHORT') {
      const output = {
        result: tier0Result.result,
        tier: 0,
        changed: tier0Result.changed,
        needsPreview: tier0Preview && tier0Result.changed,
        removals: tier0Result.removals,
        originalText: inputText,
        tier0Result: tier0Result.result,
        originalTokens: classification.estimatedTokens,
        compressedTokens: this._estimateTokens(tier0Result.result),
      };

      sessionCache.set(inputText, presetName, output);

      // Record applies (Tier 0 is silent by default, so these count as accepted)
      if (!tier0Preview && tier0Result.removals.length > 0) {
        const phrases = tier0Result.removals.map(r => r.phrase);
        phraseLog.recordBatchApply(phrases);
      }

      notificationManager.notifyCompressionSuccess({
        originalTokens: classification.estimatedTokens,
        compressedTokens: this._estimateTokens(tier0Result.result),
        tier: 'tier0',
        provider: 'local',
        durationMs: Date.now() - startTime
      });

      this.emit('state', 'idle');
      return output;
    }

    // LONG: attempt Tier 1 escalation
    if (!providerChain.hasAnyAvailable()) {
      console.log('[pipeline] No Tier 1 providers available, using Tier 0 only');
      this.emit('state', 'idle');

      const output = {
        result: tier0Result.result,
        tier: 0,
        changed: tier0Result.changed,
        needsPreview: tier0Preview && tier0Result.changed,
        removals: tier0Result.removals,
        originalText: inputText,
        tier0Result: tier0Result.result,
        allExhausted: true,
        originalTokens: classification.estimatedTokens,
        compressedTokens: this._estimateTokens(tier0Result.result),
      };

      sessionCache.set(inputText, presetName, output);
      return output;
    }

    // --- Privacy Checks ---
    let tier1Result;
    if (!(await checkAndShowDisclosure())) {
      console.log('[pipeline] Tier 1 aborted by disclosure dialog');
      tier1Result = { success: false, userAborted: true, allExhausted: false };
    } else if (!(await checkSecretWarning(inputText))) {
      console.log('[pipeline] Tier 1 aborted by secret warning');
      tier1Result = { success: false, userAborted: true, allExhausted: false };
    } else {
      this.emit('state', 'tier1');
      console.log('[pipeline] Escalating to Tier 1');
      notificationManager.notifyTier1Start({ provider: 'API' });

      tier1Result = await tier1.compress(tier0Result.result);
    }

    if (tier1Result.success) {
      console.log(`[pipeline] Tier 1 success: ${tier0Result.result.length} → ${tier1Result.result.length} chars via ${tier1Result.provider}`);

      const output = {
        result: tier1Result.result,
        tier: 1,
        changed: true,
        needsPreview: tier1Preview !== false, // Default true
        removals: tier0Result.removals,
        originalText: inputText,
        tier0Result: tier0Result.result,
        provider: tier1Result.provider,
        tokensUsed: tier1Result.tokensUsed,
        originalTokens: classification.estimatedTokens,
        compressedTokens: this._estimateTokens(tier1Result.result),
      };

      sessionCache.set(inputText, presetName, output);
      this.emit('state', 'idle');
      
      notificationManager.notifyTier1Complete({
        provider: tier1Result.provider,
        durationMs: Date.now() - startTime,
        originalTokens: classification.estimatedTokens,
        compressedTokens: this._estimateTokens(tier1Result.result)
      });

      return output;

    } else {
      // Tier 1 failed or was aborted — fall back to Tier 0 result
      if (!tier1Result.userAborted) {
        console.warn('[pipeline] Tier 1 FAILED — all providers exhausted, falling back to Tier 0 result');
      }

      if (tier1Result.allExhausted) {
        this.emit('state', 'exhausted');
        this.emit('allExhausted');
        notificationManager.show(
          '⚠️ AI compression unavailable (all providers failed). Sent with basic compression only.',
          'warning'
        );
      } else if (tier1Result.userAborted) {
        this.emit('state', 'idle');
      } else {
        this.emit('state', 'error');
      }

      const output = {
        result: tier0Result.result,
        success: false,
        tier: 'tier0_fallback',
        failureReason: tier1Result.userAborted ? 'user_aborted' : (tier1Result.allExhausted ? 'all_providers_exhausted' : 'tier1_error'),
        changed: tier0Result.changed,
        needsPreview: tier0Preview && tier0Result.changed,
        removals: tier0Result.removals,
        originalText: inputText,
        tier0Result: tier0Result.result,
        allExhausted: tier1Result.allExhausted || false,
        originalTokens: classification.estimatedTokens,
        compressedTokens: this._estimateTokens(tier0Result.result),
      };

      if (!tier1Result.userAborted) {
        // DO NOT cache failed Tier 1 attempts so they can be retried later
        console.log('[pipeline] Not caching — Tier 1 failed, want to retry next time');
        // Delayed reset to idle
        setTimeout(() => this.emit('state', 'idle'), 5000);
      } else {
        console.log('[pipeline] Not caching — aborted by user');
      }

      return output;
    }
  }

  /**
   * Get the removals from the last Tier 0 pass (for undo/learning).
   */
  getLastRemovals() {
    return [...this._lastRemovals];
  }

  /**
   * Record that the user accepted the last compression.
   */
  acceptLast() {
    if (this._lastRemovals.length > 0) {
      const phrases = this._lastRemovals.map(r => r.phrase);
      phraseLog.recordBatchApply(phrases);
    }
  }

  /**
   * Record that the user reverted the last compression.
   */
  revertLast() {
    if (this._lastRemovals.length > 0) {
      const phrases = this._lastRemovals.map(r => r.phrase);
      phraseLog.recordBatchRevert(phrases);
    }
  }
}

module.exports = new Pipeline();
