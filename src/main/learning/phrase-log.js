'use strict';

const fs = require('fs');
const path = require('path');
const { CONFIG_DIR, ensureConfigDir } = require('../config');

/**
 * Phrase Learning Log
 *
 * Tracks user accept/reject behavior for Tier 0 filler removals.
 * - Phrases the user consistently keeps → trimmed more confidently
 * - Phrases the user reverts → excluded going forward
 * - 100% local, no API cost, just a small JSON file
 *
 * File: ~/.trimtoken/phrase-log.json
 */

const PHRASE_LOG_PATH = path.join(CONFIG_DIR, 'phrase-log.json');

/**
 * Auto-exclude threshold: if a phrase has been reverted more than 60%
 * of the time over at least 5 uses, auto-exclude it.
 */
const AUTO_EXCLUDE_MIN_USES = 5;
const AUTO_EXCLUDE_REVERT_RATIO = 0.6;

class PhraseLog {
  constructor() {
    this._log = null; // lazy load
  }

  /**
   * Load the phrase log from disk, or create an empty one.
   */
  _load() {
    if (this._log !== null) return;

    ensureConfigDir();

    try {
      if (fs.existsSync(PHRASE_LOG_PATH)) {
        const raw = fs.readFileSync(PHRASE_LOG_PATH, 'utf-8');
        this._log = JSON.parse(raw);

        // Ensure structure
        if (!this._log.phrases || typeof this._log.phrases !== 'object') {
          this._log = { phrases: {} };
        }
      } else {
        this._log = { phrases: {} };
      }
    } catch (err) {
      console.warn('[phrase-log] Failed to load, starting fresh:', err.message);
      this._log = { phrases: {} };
    }
  }

  /**
   * Save the phrase log to disk.
   */
  _save() {
    try {
      ensureConfigDir();
      fs.writeFileSync(PHRASE_LOG_PATH, JSON.stringify(this._log, null, 2), 'utf-8');
    } catch (err) {
      console.error('[phrase-log] Failed to save:', err.message);
    }
  }

  /**
   * Ensure a phrase entry exists.
   */
  _ensurePhrase(phrase) {
    const key = phrase.toLowerCase().trim();
    if (!this._log.phrases[key]) {
      this._log.phrases[key] = {
        applied: 0,
        reverted: 0,
        confidence: 0.5,
        excluded: false,
        lastUpdated: Date.now(),
      };
    }
    return key;
  }

  /**
   * Recalculate confidence for a phrase.
   * confidence = applied / (applied + reverted), weighted towards caution.
   */
  _recalculate(key) {
    const entry = this._log.phrases[key];
    const total = entry.applied + entry.reverted;

    if (total === 0) {
      entry.confidence = 0.5;
      return;
    }

    entry.confidence = entry.applied / total;

    // Auto-exclude check
    if (total >= AUTO_EXCLUDE_MIN_USES &&
        (entry.reverted / total) >= AUTO_EXCLUDE_REVERT_RATIO) {
      entry.excluded = true;
      console.log(`[phrase-log] Auto-excluded "${key}" (reverted ${Math.round(entry.reverted / total * 100)}% of ${total} uses)`);
    }
  }

  /**
   * Record that a filler removal was applied (user accepted or no preview).
   * @param {string} phrase - The filler phrase that was removed
   */
  recordApply(phrase) {
    this._load();
    const key = this._ensurePhrase(phrase);

    this._log.phrases[key].applied++;
    this._log.phrases[key].lastUpdated = Date.now();
    this._recalculate(key);
    this._save();
  }

  /**
   * Record that a filler removal was reverted by the user.
   * @param {string} phrase - The filler phrase whose removal was reverted
   */
  recordRevert(phrase) {
    this._load();
    const key = this._ensurePhrase(phrase);

    this._log.phrases[key].reverted++;
    this._log.phrases[key].lastUpdated = Date.now();
    this._recalculate(key);
    this._save();
  }

  /**
   * Record applies for multiple phrases at once (batch after a compression).
   * @param {Array<string>} phrases
   */
  recordBatchApply(phrases) {
    this._load();
    for (const phrase of phrases) {
      const key = this._ensurePhrase(phrase);
      this._log.phrases[key].applied++;
      this._log.phrases[key].lastUpdated = Date.now();
      this._recalculate(key);
    }
    this._save();
  }

  /**
   * Record reverts for multiple phrases at once.
   * @param {Array<string>} phrases
   */
  recordBatchRevert(phrases) {
    this._load();
    for (const phrase of phrases) {
      const key = this._ensurePhrase(phrase);
      this._log.phrases[key].reverted++;
      this._log.phrases[key].lastUpdated = Date.now();
      this._recalculate(key);
    }
    this._save();
  }

  /**
   * Check if a phrase is excluded from compression.
   * @param {string} phrase
   * @returns {boolean}
   */
  isExcluded(phrase) {
    this._load();
    const key = phrase.toLowerCase().trim();
    return this._log.phrases[key]?.excluded === true;
  }

  /**
   * Get the set of all excluded phrases.
   * @returns {Set<string>}
   */
  getExcludedSet() {
    this._load();
    const excluded = new Set();
    for (const [key, entry] of Object.entries(this._log.phrases)) {
      if (entry.excluded) excluded.add(key);
    }
    return excluded;
  }

  /**
   * Get the full log for UI display.
   */
  getLog() {
    this._load();
    return JSON.parse(JSON.stringify(this._log));
  }

  /**
   * Toggle exclusion status for a phrase (from settings UI).
   */
  toggleExclusion(phrase, excluded) {
    this._load();
    const key = this._ensurePhrase(phrase);
    this._log.phrases[key].excluded = excluded;
    this._log.phrases[key].lastUpdated = Date.now();
    this._save();
  }

  /**
   * Reset the entire log.
   */
  reset() {
    this._log = { phrases: {} };
    this._save();
    console.log('[phrase-log] Log reset');
  }
}

module.exports = new PhraseLog();
