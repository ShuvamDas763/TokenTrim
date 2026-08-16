'use strict';

/**
 * Compression Presets System
 * Maps user-friendly preset names to compression parameters
 */

// PRESET DEFINITIONS
const PRESETS = {
  safe: {
    name: "Safe",
    icon: "🟢",
    description: "Keeps code, quotes, hedging language. Removes only obvious fluff.",
    aggressiveness: 2,
    confidenceThreshold: 0.6,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: false,  // keeps "I think", "maybe", etc.
  },
  balanced: {
    name: "Balanced",
    icon: "🟡",
    description: "Moderate compression. Removes some redundancy + light hedging.",
    aggressiveness: 3,
    confidenceThreshold: 0.4,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: true,   // removes "I think", "maybe", "feels like"
  },
  aggressive: {
    name: "Aggressive",
    icon: "🔴",
    description: "Maximum compression. Restructures sentences, may fall back to Tier 1.",
    aggressiveness: 4,
    confidenceThreshold: 0.3,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: true,
  },
};

module.exports = {
  PRESETS,
  
  /**
   * Get preset by name
   * @param {string} presetName - "safe" | "balanced" | "aggressive"
   * @returns {object} Preset config object
   */
  getPreset(presetName) {
    if (!PRESETS[presetName]) {
      console.warn(`[presets] Unknown preset: ${presetName}, defaulting to balanced`);
      return PRESETS.balanced;
    }
    return PRESETS[presetName];
  },

  /**
   * List all presets (for UI)
   * @returns {array} Array of {id, name, icon, description}
   */
  listPresets() {
    return Object.entries(PRESETS).map(([key, val]) => ({
      id: key,
      name: val.name,
      icon: val.icon,
      description: val.description,
    }));
  },

  /**
   * Convert legacy aggressiveness number to nearest preset
   * Backward compatibility: if config.aggressiveness exists, map to preset
   * @param {number} aggressiveness - 2, 3, or 4
   * @returns {string} Preset name: "safe" | "balanced" | "aggressive"
   */
  migrateFromLegacy(aggressiveness) {
    if (aggressiveness <= 2) return "safe";
    if (aggressiveness === 3) return "balanced";
    return "aggressive";
  },
};
