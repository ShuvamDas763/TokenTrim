'use strict';

const { clipboard } = require('electron');
const { execSync } = require('child_process');

/**
 * Clipboard bridge for reading selected text and pasting compressed results.
 *
 * Flow:
 * 1. Save current clipboard content
 * 2. Simulate Ctrl+C to copy selection
 * 3. Read clipboard → that's the selected text
 * 4. After compression: write result to clipboard, simulate Ctrl+V
 * 5. Restore original clipboard content after a delay
 */

let _originalClipboard = '';
let _lastOriginalText = '';  // for undo

/**
 * Small delay helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulate a keyboard shortcut via PowerShell SendKeys.
 * Uses System.Windows.Forms which is available on all Windows installs.
 * @param {string} keys - SendKeys format string (e.g., '^c' for Ctrl+C, '^v' for Ctrl+V)
 */
function sendKeys(keys) {
  try {
    execSync(
      `powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')"`,
      { windowsHide: true, timeout: 3000 }
    );
  } catch (err) {
    console.error('[clipboard-bridge] SendKeys failed:', err.message);
  }
}

/**
 * Read the currently selected text.
 * Saves the existing clipboard, simulates Ctrl+C, reads, and returns the selection.
 * @returns {Promise<string>} The selected text, or empty string if nothing selected
 */
async function readSelection() {
  // VERY IMPORTANT: Wait for the user to physically release their hotkey (like Alt+A).
  // If they are still holding Alt when we simulate Ctrl+C, Windows sees "Ctrl+Alt+C" 
  // and the copy fails, resulting in "No text selected".
  await sleep(400);

  // Save what's currently on the clipboard
  _originalClipboard = clipboard.readText() || '';

  // Clear clipboard so we can detect if Ctrl+C actually copied something
  clipboard.writeText('');

  // Simulate Ctrl+C
  sendKeys('^c');

  // Wait for the OS to process the copy
  await sleep(200);

  // Read what was copied
  const selected = clipboard.readText() || '';

  console.log(`[Diagnostic] Clipboard Bridge: RAW text read from clipboard:\n${JSON.stringify(selected)}\n--- END RAW TEXT ---`);

  return selected;
}

/**
 * Write compressed text to clipboard and paste it, replacing the selection.
 * @param {string} compressedText - The text to paste
 * @param {string} originalText - The original text (saved for undo)
 */
async function writeAndPaste(compressedText, originalText) {
  // Store for undo
  _lastOriginalText = originalText;

  // Write compressed text to clipboard
  console.log(`[Diagnostic] Clipboard Bridge: writing compressed text (len ${compressedText.length}) to clipboard:\n${compressedText.substring(0, 100)}...`);
  clipboard.writeText(compressedText);

  // Small delay to let clipboard settle
  await sleep(100);

  // Simulate Ctrl+V to paste (replaces the current selection)
  sendKeys('^v');

  // Wait for paste to complete, then restore original clipboard
  await sleep(500);
  if (_originalClipboard && _originalClipboard !== originalText) {
    clipboard.writeText(_originalClipboard);
  }
}

/**
 * Undo the last compression — re-select and paste back the original text.
 * This uses Ctrl+Z (native undo) as the most reliable approach.
 */
async function undoLastCompression() {
  if (!_lastOriginalText) {
    console.log('[clipboard-bridge] Nothing to undo');
    return false;
  }

  // Simulate Ctrl+Z to undo the last paste
  sendKeys('^z');

  await sleep(100);

  _lastOriginalText = '';
  return true;
}

/**
 * Get the last original text (for preview/revert purposes).
 */
function getLastOriginalText() {
  return _lastOriginalText;
}

module.exports = {
  readSelection,
  writeAndPaste,
  undoLastCompression,
  getLastOriginalText,
};
