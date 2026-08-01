'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// We use a dynamic import for electron-store (ESM module)
let Store;
let storeInstance = null;

const CONFIG_DIR = path.join(os.homedir(), '.trimtoken');
const PROVIDER_CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Legacy path for migration from Squeeze
const LEGACY_CONFIG_DIR = path.join(os.homedir(), '.squeeze');
const LEGACY_PROVIDER_CONFIG_PATH = path.join(LEGACY_CONFIG_DIR, 'config.json');

const DEFAULTS = {
  hotkey: 'Ctrl+Shift+C',
  undoHotkey: 'Ctrl+Shift+Z',
  aggressiveness: 3,         // 1-5, default conservative -> now default 3
  tier0Preview: false,        // silent apply
  tier1Preview: true,         // show preview
  tokenThreshold: 150,        // SHORT/LONG boundary
  theme: 'command-center',    // 'command-center' | 'arctic' | 'sunset'
};

const DEFAULT_PROVIDER_CONFIG = {
  providers: [
    {
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      apiKey: '',
      renewable: true
    },
    {
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      model: 'llama-3.3-70b',
      apiKey: '',
      renewable: true
    },
    {
      name: 'nvidia-nim',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'meta/llama-3.3-70b-instruct',
      apiKey: '',
      renewable: false
    }
  ]
};

/**
 * Initialize the electron-store instance (handles ESM import).
 */
async function initStore() {
  if (storeInstance) return storeInstance;

  const ElectronStore = (await import('electron-store')).default;
  storeInstance = new ElectronStore({
    name: 'trimtoken-settings',
    defaults: DEFAULTS,
    schema: {
      hotkey: { type: 'string' },
      undoHotkey: { type: 'string' },
      aggressiveness: { type: 'number', minimum: 1, maximum: 5 },
      tier0Preview: { type: 'boolean' },
      tier1Preview: { type: 'boolean' },
      tokenThreshold: { type: 'number', minimum: 50, maximum: 1000 },
      theme: { type: 'string', enum: ['command-center', 'arctic', 'sunset'] },
    }
  });

  return storeInstance;
}

/**
 * Get a setting value.
 */
async function getSetting(key) {
  const store = await initStore();
  return store.get(key);
}

/**
 * Get all settings.
 */
async function getAllSettings() {
  const store = await initStore();
  return store.store;
}

/**
 * Set a setting value.
 */
async function setSetting(key, value) {
  const store = await initStore();
  store.set(key, value);
}

/**
 * Set multiple settings at once.
 */
async function setSettings(obj) {
  const store = await initStore();
  for (const [key, value] of Object.entries(obj)) {
    store.set(key, value);
  }
}

/**
 * Ensure the ~/.trimtoken directory and config.json template exist.
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  // Migrate from legacy ~/.squeeze if new config doesn't exist yet
  if (!fs.existsSync(PROVIDER_CONFIG_PATH) && fs.existsSync(LEGACY_PROVIDER_CONFIG_PATH)) {
    try {
      fs.copyFileSync(LEGACY_PROVIDER_CONFIG_PATH, PROVIDER_CONFIG_PATH);
      console.log('[config] Migrated config from ~/.squeeze to ~/.trimtoken');
    } catch (err) {
      console.warn('[config] Migration from legacy config failed:', err.message);
    }
  }
  if (!fs.existsSync(PROVIDER_CONFIG_PATH)) {
    fs.writeFileSync(
      PROVIDER_CONFIG_PATH,
      JSON.stringify(DEFAULT_PROVIDER_CONFIG, null, 2),
      'utf-8'
    );
  }
}

/**
 * Load provider config from ~/.trimtoken/config.json.
 * Never logs API keys.
 */
function loadProviderConfig() {
  ensureConfigDir();
  try {
    const raw = fs.readFileSync(PROVIDER_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    if (!config.providers || !Array.isArray(config.providers)) {
      console.warn('[config] Invalid provider config, using defaults');
      return DEFAULT_PROVIDER_CONFIG;
    }
    return config;
  } catch (err) {
    console.warn('[config] Failed to load provider config, using defaults:', err.message);
    return DEFAULT_PROVIDER_CONFIG;
  }
}

/**
 * Save provider config to ~/.trimtoken/config.json.
 */
function saveProviderConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(
    PROVIDER_CONFIG_PATH,
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

module.exports = {
  DEFAULTS,
  CONFIG_DIR,
  PROVIDER_CONFIG_PATH,
  initStore,
  getSetting,
  getAllSettings,
  setSetting,
  setSettings,
  ensureConfigDir,
  loadProviderConfig,
  saveProviderConfig,
  DEFAULT_PROVIDER_CONFIG,
};
