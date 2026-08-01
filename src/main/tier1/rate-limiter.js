'use strict';

/**
 * Rate Limiter
 *
 * Sliding-window rate limiter per provider.
 * Tracks requests-per-minute (RPM) and tokens-per-minute (TPM).
 * Returns wait durations rather than throwing errors.
 */

/**
 * Default known rate limits for each provider.
 * These match the free-tier limits discovered through research.
 */
const DEFAULT_LIMITS = {
  groq: {
    rpm: 30,
    tpm: 12000,
    rpd: 1000,
    tpd: 100000,
  },
  cerebras: {
    rpm: 30,
    tpm: 60000,  // estimated from 1M TPD
    rpd: Infinity,
    tpd: 1000000,
  },
  'nvidia-nim': {
    rpm: 40,
    tpm: Infinity,  // not clearly rate-limited by tokens
    rpd: Infinity,
    tpd: Infinity,
  },
};

class RateLimiter {
  constructor() {
    // Per-provider sliding windows
    // { providerName: { requests: [{timestamp, tokens}], dailyRequests: N, dailyTokens: N, dayStart: timestamp } }
    this._windows = {};
  }

  /**
   * Initialize tracking for a provider.
   */
  _ensureProvider(name) {
    if (!this._windows[name]) {
      this._windows[name] = {
        requests: [],
        dailyRequests: 0,
        dailyTokens: 0,
        dayStart: Date.now(),
      };
    }

    // Reset daily counters if a new day has started
    const window = this._windows[name];
    const elapsed = Date.now() - window.dayStart;
    if (elapsed > 24 * 60 * 60 * 1000) {
      window.dailyRequests = 0;
      window.dailyTokens = 0;
      window.dayStart = Date.now();
    }
  }

  /**
   * Get the rate limits for a provider.
   */
  _getLimits(name) {
    return DEFAULT_LIMITS[name] || { rpm: 30, tpm: Infinity, rpd: Infinity, tpd: Infinity };
  }

  /**
   * Prune entries older than 60 seconds from the sliding window.
   */
  _pruneWindow(name) {
    const window = this._windows[name];
    const cutoff = Date.now() - 60000; // 1 minute
    window.requests = window.requests.filter(r => r.timestamp > cutoff);
  }

  /**
   * Check if a request can be made right now.
   * @param {string} providerName
   * @param {number} [estimatedTokens=500] - Estimated tokens for this request
   * @returns {{ allowed: boolean, waitMs: number }} - waitMs > 0 means "try again after this many ms"
   */
  canRequest(providerName, estimatedTokens = 500) {
    this._ensureProvider(providerName);
    this._pruneWindow(providerName);

    const window = this._windows[providerName];
    const limits = this._getLimits(providerName);

    // Check RPM
    if (window.requests.length >= limits.rpm) {
      const oldest = window.requests[0];
      const waitMs = (oldest.timestamp + 60000) - Date.now();
      return { allowed: false, waitMs: Math.max(waitMs, 1000) };
    }

    // Check TPM
    const minuteTokens = window.requests.reduce((sum, r) => sum + r.tokens, 0);
    if (minuteTokens + estimatedTokens > limits.tpm) {
      const oldest = window.requests[0];
      const waitMs = (oldest.timestamp + 60000) - Date.now();
      return { allowed: false, waitMs: Math.max(waitMs, 1000) };
    }

    // Check RPD
    if (window.dailyRequests >= limits.rpd) {
      return { allowed: false, waitMs: -1 }; // -1 = exhausted for today
    }

    // Check TPD
    if (window.dailyTokens + estimatedTokens > limits.tpd) {
      return { allowed: false, waitMs: -1 }; // exhausted for today
    }

    return { allowed: true, waitMs: 0 };
  }

  /**
   * Record that a request was made.
   * @param {string} providerName
   * @param {number} tokens - Actual tokens used
   */
  recordRequest(providerName, tokens) {
    this._ensureProvider(providerName);

    this._windows[providerName].requests.push({
      timestamp: Date.now(),
      tokens,
    });
    this._windows[providerName].dailyRequests++;
    this._windows[providerName].dailyTokens += tokens;
  }

  /**
   * Reset all tracking (e.g., on app restart).
   */
  reset() {
    this._windows = {};
  }

  /**
   * Get stats for a provider (for debug/UI).
   */
  getStats(providerName) {
    this._ensureProvider(providerName);
    this._pruneWindow(providerName);

    const window = this._windows[providerName];
    const limits = this._getLimits(providerName);
    const minuteTokens = window.requests.reduce((sum, r) => sum + r.tokens, 0);

    return {
      rpm: { used: window.requests.length, limit: limits.rpm },
      tpm: { used: minuteTokens, limit: limits.tpm },
      rpd: { used: window.dailyRequests, limit: limits.rpd },
      tpd: { used: window.dailyTokens, limit: limits.tpd },
    };
  }
}

module.exports = new RateLimiter();
