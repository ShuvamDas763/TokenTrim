'use strict';

/**
 * Session Analytics
 *
 * Tracks cumulative compression statistics for the current app session.
 * These stats reset on app restart.
 */

class SessionAnalytics {
  constructor() {
    this.reset();
  }

  reset() {
    this.stats = {
      totalCompressions: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      apiCallsMade: 0,
      bestReductionPercent: 0,
    };
  }

  /**
   * Record a completed compression pipeline run.
   *
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {boolean} usedCloudApi
   */
  record(inputTokens, outputTokens, usedCloudApi = false) {
    if (inputTokens <= 0) return;

    this.stats.totalCompressions++;
    this.stats.totalInputTokens += inputTokens;
    this.stats.totalOutputTokens += outputTokens;
    
    if (usedCloudApi) {
      this.stats.apiCallsMade++;
    }

    const reduction = Math.max(0, (inputTokens - outputTokens) / inputTokens);
    if (reduction > this.stats.bestReductionPercent) {
      this.stats.bestReductionPercent = reduction;
    }
  }

  /**
   * Get current session statistics formatted for display.
   */
  getStats() {
    const totalSaved = Math.max(0, this.stats.totalInputTokens - this.stats.totalOutputTokens);
    let averageReduction = 0;
    if (this.stats.totalInputTokens > 0) {
      averageReduction = (totalSaved / this.stats.totalInputTokens) * 100;
    }

    return {
      totalCompressions: this.stats.totalCompressions,
      totalInputTokens: this.stats.totalInputTokens,
      totalOutputTokens: this.stats.totalOutputTokens,
      totalSavedTokens: totalSaved,
      averageReductionPercent: Math.round(averageReduction),
      bestReductionPercent: Math.round(this.stats.bestReductionPercent * 100),
      apiCallsMade: this.stats.apiCallsMade,
    };
  }
}

module.exports = new SessionAnalytics();
