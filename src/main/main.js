'use strict';

if (process.stdout && typeof process.stdout.setEncoding === 'function') {
  process.stdout.setEncoding('utf8');
}
if (process.stderr && typeof process.stderr.setEncoding === 'function') {
  process.stderr.setEncoding('utf8');
}

if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch (e) {
    // non-fatal, just best-effort
  }
}

const { app, BrowserWindow, ipcMain, Notification, screen } = require('electron');
const path = require('path');
const config = require('./config');
const hotkeyMgr = require('./hotkey');
const trayMgr = require('./tray');
const clipboardBridge = require('./clipboard-bridge');
const pipeline = require('./pipeline');
const providerChain = require('./tier1/provider-chain');
const phraseLog = require('./learning/phrase-log');
const sessionCache = require('./session-cache');

// Required for Windows Notifications
app.setAppUserModelId('com.trimtoken.app');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let settingsWindow = null;
let isProcessing = false;

// Set UTF-8 encoding for console logs if supported
if (process.stdout && typeof process.stdout.setEncoding === 'function') {
  process.stdout.setEncoding('utf8');
}
if (process.stderr && typeof process.stderr.setEncoding === 'function') {
  process.stderr.setEncoding('utf8');
}

/**
 * Show a system notification.
 */
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: path.join(__dirname, '../../assets/icon.png') }).show();
  }
}

/**
 * Handle the main compression hotkey.
 */
async function onCompressHotkey() {
  if (isProcessing) return;

  try {
    isProcessing = true;
    console.log('\n[main] --- Compression triggered ---');

    // 1. Read selection
    const text = await clipboardBridge.readSelection();
    if (!text || text.trim().length === 0) {
      console.log('[main] No text selected');
      isProcessing = false;
      return;
    }

    // 2. Process through pipeline
    const result = await pipeline.process(text);

    // 3. Handle preview vs direct paste
    if (result.changed || result.needsPreview) {
      const decision = await clipboardBridge.handleCompressionAndPaste(
        result.originalText,
        result.result,
        {
          needsPreview: result.needsPreview,
          originalTokens: result.originalTokens,
          compressedTokens: result.compressedTokens,
          tier: 'tier' + result.tier,
          provider: result.provider
        }
      );
      if (decision === 'accepted') pipeline.acceptLast();
      else if (decision === 'reverted') pipeline.revertLast();
    } else {
      console.log('[main] No changes from compression, pasting original text directly');
      await clipboardBridge.handleCompressionAndPaste(
        result.originalText,
        result.result,
        {
          needsPreview: false,
          originalTokens: result.originalTokens,
          compressedTokens: result.compressedTokens,
          tier: 'tier' + result.tier,
          provider: result.provider
        }
      );
    }

    // 4. Handle notifications for edge cases
    if (result.allExhausted) {
      showNotification(
        'TrimToken: Free tiers exhausted',
        'All configured AI providers are out of credits for now. Applied local compression only.'
      );
    }

  } catch (err) {
    console.error('[main] Compression error:', err);
    trayMgr.setState('error');
    setTimeout(() => trayMgr.setState('idle'), 5000);
  } finally {
    isProcessing = false;
  }
}

/**
 * Handle the undo hotkey.
 */
async function onUndoHotkey() {
  console.log('[main] Undo triggered');
  const success = await clipboardBridge.undoLastCompression();
  
  if (success) {
    pipeline.revertLast();
    showNotification('TrimToken', 'Reverted compression and logged phrase feedback.');
  }
}

/**
 * Open the settings window.
 */
function openSettingsWindow(tab = 'general') {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    frame: false, // Custom title bar
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    // In a real app we'd pass the initial tab via webContents.send, 
    // but the default UI selects 'general' anyway.
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// preview modal logic has moved to preview-modal.js

/**
 * App initialization.
 */
app.whenReady().then(async () => {
  console.log('[main] App ready');

  // Load config & providers
  await config.initStore();
  providerChain.load();

  // Setup tray
  trayMgr.createTray({
    onSettings: () => openSettingsWindow('general'),
    onPhraseLog: () => openSettingsWindow('phraselog'),
  });

  // Load settings and apply theme to tray
  const settings = await config.getAllSettings();
  if (settings.theme) {
    trayMgr.setTheme(settings.theme);
  }
  hotkeyMgr.updateHotkeys({
    hotkey: settings.hotkey || 'Ctrl+Shift+C',
    undoHotkey: settings.undoHotkey || 'Ctrl+Shift+Z',
    onCompress: onCompressHotkey,
    onUndo: onUndoHotkey,
  });

  // Listen to pipeline state changes to update tray
  pipeline.on('state', (state) => trayMgr.setState(state));
});

// Quit when all windows are closed — NO, keep running in background
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  hotkeyMgr.unregisterAll();
  trayMgr.destroyTray();
});

// ── IPC Handlers for Renderer ───────────────────────────────────

ipcMain.handle('get-settings', async () => await config.getAllSettings());
ipcMain.handle('save-settings', async (event, settings) => {
  await config.setSettings(settings);
  
  // Re-register hotkeys if they changed
  hotkeyMgr.updateHotkeys({
    hotkey: settings.hotkey,
    undoHotkey: settings.undoHotkey,
    onCompress: onCompressHotkey,
    onUndo: onUndoHotkey,
  });

  // Update tray theme if it changed
  if (settings.theme) {
    trayMgr.setTheme(settings.theme);
  }

  if (settings.showBackgroundVideo !== undefined) {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('video-toggled', settings.showBackgroundVideo);
    });
  }
});

ipcMain.handle('get-provider-states', () => providerChain.getAllStates());
ipcMain.handle('update-provider-keys', (event, updates) => providerChain.updateProviderKeys(updates));
ipcMain.handle('clear-nim-flag', () => providerChain.clearNimFlag());

ipcMain.handle('get-phrase-log', () => phraseLog.getLog());
ipcMain.handle('reset-phrase-log', () => phraseLog.reset());
ipcMain.handle('toggle-phrase-exclusion', (event, phrase, excluded) => 
  phraseLog.toggleExclusion(phrase, excluded)
);

ipcMain.on('close-settings', () => {
  if (settingsWindow) settingsWindow.close();
});

ipcMain.on('theme-changed', async (event, theme) => {
  // Persist the theme
  await config.setSetting('theme', theme);
  // Update tray icon colors instantly
  trayMgr.setTheme(theme);
  console.log(`[main] Theme changed to: ${theme}`);
});

app.on('open-settings', (tab) => {
  openSettingsWindow(tab);
});
