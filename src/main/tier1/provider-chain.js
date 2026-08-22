'use strict';

const fs = require('fs');
const path = require('path');
const { loadProviderConfig, saveProviderConfig, CONFIG_DIR } = require('../config');

/**
 * Provider Chain
 *
 * Manages the ordered list of LLM providers with their availability state.
 * - Daily-renewing providers (Groq, Cerebras) reset on app restart
 * - NVIDIA NIM's credit-exhaustion flag is persisted to disk
 */

const NIM_EXHAUSTED_FLAG_PATH = path.join(CONFIG_DIR, '.nim-exhausted');

class ProviderChain {
  constructor() {
    this._providers = [];
    this._state = {};  // { providerName: { available, coolingDownUntil, consecutiveTimeouts, creditExhausted } }
    this._loaded = false;
  }

  /**
   * Load providers from config and initialize state.
   * Daily-renewing providers start fresh. NIM checks persisted flag.
   */
  load() {
    const config = loadProviderConfig();
    this._providers = config.providers || [];

    this._state = {};
    for (const provider of this._providers) {
      const isNimExhausted = !provider.renewable && this._isNimFlagSet();

      this._state[provider.name] = {
        available: !isNimExhausted && !!provider.apiKey,
        coolingDownUntil: 0,
        consecutiveTimeouts: 0,
        creditExhausted: isNimExhausted,
        misconfigured: false,
      };
    }

    this._loaded = true;
    console.log(`[provider-chain] Loaded ${this._providers.length} providers`);

    // Log which ones are available (without revealing keys)
    for (const p of this._providers) {
      const s = this._state[p.name];
      const hasKey = !!p.apiKey;
      console.log(`[provider-chain]   ${p.name}: key=${hasKey ? 'set' : 'MISSING'}, available=${s.available}, exhausted=${s.creditExhausted}`);
    }
  }

  /**
   * Check if the NIM exhaustion flag file exists.
   */
  _isNimFlagSet() {
    try {
      return fs.existsSync(NIM_EXHAUSTED_FLAG_PATH);
    } catch {
      return false;
    }
  }

  /**
   * Persist the NIM exhaustion flag.
   */
  _setNimFlag() {
    try {
      fs.writeFileSync(NIM_EXHAUSTED_FLAG_PATH, new Date().toISOString(), 'utf-8');
    } catch (err) {
      console.error('[provider-chain] Failed to write NIM exhaustion flag:', err.message);
    }
  }

  /**
   * Get the ordered list of providers.
   */
  getProviders() {
    if (!this._loaded) this.load();
    return [...this._providers];
  }

  /**
   * Get the next available provider.
   * Skips providers that are cooling down, exhausted, or have no API key.
   * @param {string[]} [excludeNames=[]] - Array of provider names to skip for this request
   * @returns {object|null} Provider config object, or null if all exhausted
   */
  getNextAvailable(excludeNames = []) {
    if (!this._loaded) this.load();

    const now = Date.now();

    for (const provider of this._providers) {
      if (excludeNames.includes(provider.name)) continue;

      const state = this._state[provider.name];

      // Skip if no API key
      if (!provider.apiKey) continue;

      // Skip if credit-exhausted (permanent for non-renewable)
      if (state.creditExhausted) continue;

      // Skip if misconfigured (requires config update)
      if (state.misconfigured) continue;

      // Skip if cooling down
      if (state.coolingDownUntil > now) continue;

      // If cooling period has passed, mark available again
      if (!state.available && state.coolingDownUntil <= now && !state.creditExhausted) {
        state.available = true;
        state.consecutiveTimeouts = 0;
      }

      if (state.available) {
        return { ...provider };
      }
    }

    return null; // All providers exhausted
  }

  /**
   * Mark a provider as rate-limited / cooling down.
   * @param {string} name - Provider name
   * @param {number} [cooldownMs=300000] - Cool down period (default 5 minutes)
   */
  markCoolingDown(name, cooldownMs = 300000) {
    if (!this._state[name]) return;

    this._state[name].available = false;
    this._state[name].coolingDownUntil = Date.now() + cooldownMs;
    console.log(`[provider-chain] ${name} cooling down for ${cooldownMs / 1000}s`);
  }

  /**
   * Record a timeout for a provider. After 3 consecutive, mark as cooling down.
   * @param {string} name
   */
  recordTimeout(name) {
    if (!this._state[name]) return;

    this._state[name].consecutiveTimeouts++;
    console.log(`[provider-chain] ${name} timeout #${this._state[name].consecutiveTimeouts}`);

    if (this._state[name].consecutiveTimeouts >= 3) {
      this.markCoolingDown(name, 600000); // 10 minutes after 3 timeouts
    }
  }

  /**
   * Mark a provider as credit-exhausted (permanent for non-renewable like NIM).
   * @param {string} name
   */
  markCreditExhausted(name) {
    if (!this._state[name]) return;

    const provider = this._providers.find(p => p.name === name);

    this._state[name].available = false;
    this._state[name].creditExhausted = true;

    // Persist for non-renewable providers (NIM)
    if (provider && !provider.renewable) {
      this._setNimFlag();
      console.log(`[provider-chain] ${name} credit exhausted (persisted — non-renewable)`);
    } else {
      console.log(`[provider-chain] ${name} credit exhausted (session only — renewable)`);
    }
  }

  /**
   * Mark a provider as misconfigured (e.g. invalid model).
   * Remains unavailable until config is reloaded.
   * @param {string} name 
   */
  markMisconfigured(name) {
    if (!this._state[name]) return;
    this._state[name].available = false;
    this._state[name].misconfigured = true;
    console.log(`[provider-chain] ${name} marked as misconfigured (requires config update)`);
  }

  /**
   * Record a successful request (resets consecutive timeout counter).
   */
  recordSuccess(name) {
    if (!this._state[name]) return;
    this._state[name].consecutiveTimeouts = 0;
  }

  /**
   * Check if any provider is available at all.
   */
  hasAnyAvailable() {
    return this.getNextAvailable() !== null;
  }

  /**
   * Get state for all providers (for UI display).
   */
  getAllStates() {
    if (!this._loaded) this.load();

    return this._providers.map(p => ({
      name: p.name,
      model: p.model,
      renewable: p.renewable,
      hasKey: !!p.apiKey,
      ...this._state[p.name],
    }));
  }

  /**
   * Update provider API keys from settings UI.
   */
  updateProviderKeys(updates) {
    const config = loadProviderConfig();

    for (const update of updates) {
      const provider = config.providers.find(p => p.name === update.name);
      if (provider && update.apiKey !== undefined) {
        provider.apiKey = update.apiKey;
      }
    }

    saveProviderConfig(config);
    this.load(); // Reload
  }

  /**
   * Clear the NIM exhaustion flag (manual reset from settings).
   */
  clearNimFlag() {
    try {
      if (fs.existsSync(NIM_EXHAUSTED_FLAG_PATH)) {
        fs.unlinkSync(NIM_EXHAUSTED_FLAG_PATH);
        console.log('[provider-chain] NIM exhaustion flag cleared');
      }
    } catch (err) {
      console.error('[provider-chain] Failed to clear NIM flag:', err.message);
    }
    this.load();
  }
}

module.exports = new ProviderChain();
