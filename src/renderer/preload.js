'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script — exposes safe IPC bridge to renderer via contextBridge.
 * No direct Node.js or Electron APIs are exposed.
 */
contextBridge.exposeInMainWorld('trimtoken', {
  // ── Settings ──────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // ── Provider Config ───────────────────────────────────────────
  getProviderStates: () => ipcRenderer.invoke('get-provider-states'),
  updateProviderKeys: (updates) => ipcRenderer.invoke('update-provider-keys', updates),
  clearNimFlag: () => ipcRenderer.invoke('clear-nim-flag'),

  // ── Phrase Log ────────────────────────────────────────────────
  getPhraseLog: () => ipcRenderer.invoke('get-phrase-log'),
  resetPhraseLog: () => ipcRenderer.invoke('reset-phrase-log'),
  togglePhraseExclusion: (phrase, excluded) =>
    ipcRenderer.invoke('toggle-phrase-exclusion', phrase, excluded),

  // ── Preview ───────────────────────────────────────────────────
  onPreviewData: (callback) => {
    ipcRenderer.on('preview-data', (_event, data) => callback(data));
  },
  sendPreviewDecision: (decision) =>
    ipcRenderer.send('preview-decision', decision),

  // ── Theme ─────────────────────────────────────────────────────
  notifyThemeChanged: (theme) => ipcRenderer.send('theme-changed', theme),

  // ── Window Control ────────────────────────────────────────────
  closeWindow: () => ipcRenderer.send('close-settings'),
});
