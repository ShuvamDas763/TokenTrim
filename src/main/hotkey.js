'use strict';

const { globalShortcut } = require('electron');

let _registeredShortcuts = [];

/**
 * Register a global hotkey.
 * @param {string} accelerator - Electron accelerator string (e.g., 'Ctrl+Shift+C')
 * @param {Function} callback - Function to call when hotkey is pressed
 * @returns {boolean} Whether registration succeeded
 */
function registerHotkey(accelerator, callback) {
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      console.warn(`[hotkey] Shortcut ${accelerator} is already registered by another app`);
      return false;
    }

    const success = globalShortcut.register(accelerator, () => {
      console.log(`[hotkey] ${accelerator} triggered`);
      callback();
    });

    if (success) {
      _registeredShortcuts.push(accelerator);
      console.log(`[hotkey] Registered: ${accelerator}`);
    } else {
      console.error(`[hotkey] Failed to register: ${accelerator}`);
    }

    return success;
  } catch (err) {
    console.error(`[hotkey] Error registering ${accelerator}:`, err.message);
    return false;
  }
}

/**
 * Unregister a specific hotkey.
 */
function unregisterHotkey(accelerator) {
  try {
    globalShortcut.unregister(accelerator);
    _registeredShortcuts = _registeredShortcuts.filter(s => s !== accelerator);
    console.log(`[hotkey] Unregistered: ${accelerator}`);
  } catch (err) {
    console.error(`[hotkey] Error unregistering ${accelerator}:`, err.message);
  }
}

/**
 * Unregister all hotkeys (call on app quit).
 */
function unregisterAll() {
  globalShortcut.unregisterAll();
  _registeredShortcuts = [];
  console.log('[hotkey] All shortcuts unregistered');
}

/**
 * Re-register hotkeys when settings change.
 * @param {object} opts
 * @param {string} opts.hotkey - Main compress hotkey
 * @param {string} opts.undoHotkey - Undo hotkey
 * @param {Function} opts.onCompress - Compress callback
 * @param {Function} opts.onUndo - Undo callback
 */
function updateHotkeys({ hotkey, undoHotkey, onCompress, onUndo }) {
  unregisterAll();
  registerHotkey(hotkey, onCompress);
  registerHotkey(undoHotkey, onUndo);
}

/**
 * Get list of currently registered shortcuts.
 */
function getRegistered() {
  return [..._registeredShortcuts];
}

module.exports = {
  registerHotkey,
  unregisterHotkey,
  unregisterAll,
  updateHotkeys,
  getRegistered,
};
