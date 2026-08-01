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
   * Generate a SHA-256 hash key for the input text.
   */
  _hash(text) {
    return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
  }

  /**
   * Check if a result exists for this input.
   * @param {string} text - The input text
   * @returns {object|null} Cached result or null
   */
  get(text) {
    const key = this._hash(text);
    return this._cache.get(key) || null;
  }

  /**
   * Store a result for this input.
   * @param {string} text - The input text
   * @param {object} result - The compression result
   */
  set(text, result) {
    const key = this._hash(text);
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
