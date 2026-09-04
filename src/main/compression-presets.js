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
    description: "Fillers only. 1 pass. Very conservative.",
    aggressiveness: 2,
    confidenceThreshold: 0.6,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: false,
    maxPasses: 1,
    enableLocalTier1: false,
    dropThreshold: 0,
  },
  balanced: {
    name: "Balanced",
    icon: "🟡",
    description: "Fillers + Boilerplate + Synonyms. 2 passes.",
    aggressiveness: 3,
    confidenceThreshold: 0.4,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: true,
    maxPasses: 2,
    enableLocalTier1: true,
    dropThreshold: 0.15, // Drop bottom 15% of sentences
  },
  aggressive: {
    name: "Aggressive",
    icon: "🔴",
    description: "All local optimizations. 3 passes. Max compression.",
    aggressiveness: 4,
    confidenceThreshold: 0.3,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: true,
    maxPasses: 3,
    enableLocalTier1: true,
    dropThreshold: 0.25, // Drop bottom 25% of sentences
  },
  max: {
    name: "Max (Cloud)",
    icon: "🔥",
    description: "Aggressive + Cloud fallback if target missed.",
    aggressiveness: 5,
    confidenceThreshold: 0.2,
    protectCodeBlocks: true,
    protectQuotes: true,
    protectUrls: true,
    removeHedging: true,
    maxPasses: 3,
    enableLocalTier1: true,
    dropThreshold: 0.30, // Drop bottom 30% of sentences
  },
};

module.exports = {
  PRESETS,
  
  /**
   * Get preset by name
   * @param {string} presetName - "safe" | "balanced" | "aggressive" | "max"
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
