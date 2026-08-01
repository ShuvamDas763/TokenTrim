'use strict';

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let _tray = null;
let _state = 'idle';
let _currentTheme = 'command-center';
let _onSettingsClick = null;
let _onPhraseLogClick = null;
let _onQuitClick = null;
let _bounceInterval = null;
let _bounceFrame = 0;

/**
 * Theme-aware icon colors for each state.
 * Each theme defines colors for all tray icon states.
 */
const THEME_STATE_COLORS = {
  'command-center': {
    idle:      { r: 77,  g: 159, b: 255, label: 'TrimToken — Idle' },
    tier0:     { r: 62,  g: 207, b: 142, label: 'TrimToken — Compressing (local)' },
    tier1:     { r: 77,  g: 159, b: 255, label: 'TrimToken — Calling API...' },
    error:     { r: 255, g:  92, b:  92, label: 'TrimToken — Error' },
    exhausted: { r: 180, g:  40, b:  40, label: 'TrimToken — All providers exhausted' },
  },
  'arctic': {
    idle:      { r: 136, g: 192, b: 208, label: 'TrimToken — Idle' },
    tier0:     { r: 163, g: 190, b: 140, label: 'TrimToken — Compressing (local)' },
    tier1:     { r: 136, g: 192, b: 208, label: 'TrimToken — Calling API...' },
    error:     { r: 191, g:  97, b: 106, label: 'TrimToken — Error' },
    exhausted: { r: 150, g:  60, b:  68, label: 'TrimToken — All providers exhausted' },
  },
  'sunset': {
    idle:      { r: 255, g: 157, b:  61, label: 'TrimToken — Idle' },
    tier0:     { r: 143, g: 191, b: 111, label: 'TrimToken — Compressing (local)' },
    tier1:     { r: 255, g: 157, b:  61, label: 'TrimToken — Calling API...' },
    error:     { r: 255, g: 107, b:  92, label: 'TrimToken — Error' },
    exhausted: { r: 180, g:  50, b:  40, label: 'TrimToken — All providers exhausted' },
  },
};

/**
 * Get the current theme's state color map.
 */
function getStateColors() {
  return THEME_STATE_COLORS[_currentTheme] || THEME_STATE_COLORS['command-center'];
}

/**
 * Generate a 16x16 RGBA icon with a colored circle.
 * Creates a simple but distinctive tray icon without external files.
 * @param {object} color - { r, g, b }
 * @param {number} [yOffset=0] - Vertical offset for bounce animation
 */
function createIcon(color, yOffset = 0) {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);

  const cx = size / 2;
  const cy = (size / 2) + yOffset;
  const radius = 6;
  const borderRadius = 7;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= radius) {
        // Inner fill
        buffer[idx] = color.r;
        buffer[idx + 1] = color.g;
        buffer[idx + 2] = color.b;
        buffer[idx + 3] = 255;
      } else if (dist <= borderRadius) {
        // Anti-aliased border
        const alpha = Math.max(0, Math.min(255, Math.round((borderRadius - dist) * 255)));
        buffer[idx] = Math.min(255, color.r + 40);
        buffer[idx + 1] = Math.min(255, color.g + 40);
        buffer[idx + 2] = Math.min(255, color.b + 40);
        buffer[idx + 3] = alpha;
      } else {
        // Transparent
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/**
 * Start the processing bounce animation.
 * Alternates the icon between two slight vertical offsets at ~400ms.
 */
function startBounce() {
  stopBounce();
  _bounceFrame = 0;
  _bounceInterval = setInterval(() => {
    if (!_tray) return;
    const colors = getStateColors();
    const color = colors.tier1;
    // Alternate between normal position and 1px offset
    _bounceFrame = (_bounceFrame + 1) % 2;
    const offset = _bounceFrame === 1 ? 1 : -1;
    _tray.setImage(createIcon(color, offset));
  }, 400);
}

/**
 * Stop the processing bounce animation.
 */
function stopBounce() {
  if (_bounceInterval) {
    clearInterval(_bounceInterval);
    _bounceInterval = null;
  }
  _bounceFrame = 0;
}

/**
 * Build the tray context menu.
 */
function buildContextMenu() {
  const colors = getStateColors();
  return Menu.buildFromTemplate([
    {
      label: 'Settings',
      click: () => { if (_onSettingsClick) _onSettingsClick(); },
    },
    {
      label: 'View Phrase Log',
      click: () => { if (_onPhraseLogClick) _onPhraseLogClick(); },
    },
    { type: 'separator' },
    {
      label: `State: ${colors[_state]?.label || 'Unknown'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit TrimToken',
      click: () => {
        if (_onQuitClick) _onQuitClick();
        else app.quit();
      },
    },
  ]);
}

/**
 * Create the system tray.
 * @param {object} callbacks
 * @param {Function} callbacks.onSettings - Called when Settings menu item clicked
 * @param {Function} callbacks.onPhraseLog - Called when View Phrase Log clicked
 * @param {Function} callbacks.onQuit - Called when Quit clicked
 */
function createTray({ onSettings, onPhraseLog, onQuit }) {
  _onSettingsClick = onSettings;
  _onPhraseLogClick = onPhraseLog;
  _onQuitClick = onQuit;

  const colors = getStateColors();
  const icon = createIcon(colors.idle);
  _tray = new Tray(icon);
  _tray.setToolTip(colors.idle.label);
  _tray.setContextMenu(buildContextMenu());

  // Double-click opens settings
  _tray.on('double-click', () => {
    if (_onSettingsClick) _onSettingsClick();
  });

  console.log('[tray] System tray created');
  return _tray;
}

/**
 * Update the tray icon state.
 * @param {'idle'|'tier0'|'tier1'|'error'|'exhausted'} state
 */
function setState(state) {
  const colors = getStateColors();
  if (!_tray || !colors[state]) return;

  _state = state;
  const color = colors[state];

  // Handle bounce animation for processing state
  if (state === 'tier1') {
    startBounce();
  } else {
    stopBounce();
    _tray.setImage(createIcon(color));
  }

  _tray.setToolTip(color.label);
  _tray.setContextMenu(buildContextMenu());
}

/**
 * Set the theme and refresh the tray icon.
 * @param {string} theme - 'command-center' | 'arctic' | 'sunset'
 */
function setTheme(theme) {
  if (THEME_STATE_COLORS[theme]) {
    _currentTheme = theme;
    // Refresh the icon with new theme colors
    setState(_state);
    console.log(`[tray] Theme set to: ${theme}`);
  }
}

/**
 * Get current tray state.
 */
function getState() {
  return _state;
}

/**
 * Destroy the tray.
 */
function destroyTray() {
  stopBounce();
  if (_tray) {
    _tray.destroy();
    _tray = null;
  }
}

module.exports = {
  createTray,
  setState,
  setTheme,
  getState,
  destroyTray,
};
