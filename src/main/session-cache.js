'use strict';

const crypto = require('crypto');

/**
 * In-memory session cache for deduplicating compression requests.
 * Keyed by SHA-256 hash of input text. Cleared on app restart.
 */
class SessionCache {
  constructor() {
    this._cache = new Map();
  }

  /**
   * Generate a SHA-256 hash key for the input text and preset.
   */
  _hash(text, preset) {
    return crypto.createHash('sha256').update(`${preset}::${text}`, 'utf-8').digest('hex');
  }

  /**
   * Check if a result exists for this input.
   * @param {string} text - The input text
   * @param {string} preset - The current preset
   * @returns {object|null} Cached result or null
   */
  get(text, preset) {
    const key = this._hash(text, preset);
    return this._cache.get(key) || null;
  }

  /**
   * Store a result for this input.
   * @param {string} text - The input text
   * @param {string} preset - The current preset
   * @param {object} result - The compression result
   */
  set(text, preset, result) {
    const key = this._hash(text, preset);
    this._cache.set(key, {
      ...result,
      cachedAt: Date.now(),
    });
  }

  /**
   * Clear all cached results.
   */
  clear() {
    this._cache.clear();
  }

  /**
   * Get the number of cached entries.
   */
  get size() {
    return this._cache.size;
  }
}

module.exports = new SessionCache();
