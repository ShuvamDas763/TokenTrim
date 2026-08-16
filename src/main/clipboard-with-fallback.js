'use strict';

/**
 * Clipboard Manager with Fallback & History
 * Handles pasting with error recovery + maintains local history
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { clipboard } = require('electron');
const { execSync } = require('child_process');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the handle of the currently focused (foreground) window.
 * Uses Win32 GetForegroundWindow via PowerShell.
 * Returns the handle as a string, or null if the call fails.
 */
function getForegroundWindow() {
  try {
    const psScript = [
      "$ProgressPreference = 'SilentlyContinue';",
      "Add-Type -MemberDefinition '",
      "[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
      "' -Name WinAPI -Namespace TrimToken;",
      "[TrimToken.WinAPI]::GetForegroundWindow()",
    ].join('\n');
    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    const result = execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`,
      { windowsHide: true, timeout: 2000, encoding: 'utf8' }
    );
    return result.trim();
  } catch (err) {
    console.warn('[clipboard] Failed to get foreground window:', err.message);
    return null;
  }
}

/**
 * Get the title of the currently focused window.
 * Used for detecting tab switches within the same application.
 */
function getActiveWindowTitle() {
  const script = `
$ProgressPreference = 'SilentlyContinue';
Add-Type -MemberDefinition '
[DllImport("user32.dll")]
public static extern IntPtr GetForegroundWindow();

[DllImport("user32.dll", CharSet=CharSet.Unicode)]
public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

public static string GetActiveWindowTitle() {
    IntPtr handle = GetForegroundWindow();
    StringBuilder buff = new StringBuilder(256);
    if (GetWindowText(handle, buff, 256) > 0) return buff.ToString();
    return "";
}
' -Name WinAPI -Namespace TrimTokenTitle -Using System.Text;
[TrimTokenTitle.WinAPI]::GetActiveWindowTitle()
`;

  try {
    const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
    const result = execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`,
      { windowsHide: true, timeout: 2000, encoding: 'utf8' }
    );
    return result.trim();
  } catch (err) {
    console.warn('[clipboard] Failed to get foreground window title:', err.message);
    return null;
  }
}

function sendKeys(keys) {
  try {
    execSync(
      `powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')"`,
      { windowsHide: true, timeout: 3000 }
    );
  } catch (err) {
    console.error('[clipboard] SendKeys failed:', err.message);
    throw err;
  }
}

/**
 * Race the actual paste attempt against a hard timeout.
 * Guarantees resolution either way — never hangs silently.
 * @param {Function} pasteFn - async function that performs the paste
 * @param {number} timeoutMs - max time to wait before declaring failure
 * @returns {Promise<boolean>}
 */
function attemptPasteWithTimeout(pasteFn, timeoutMs = 5000) {
  return Promise.race([
    pasteFn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Paste timed out after ${timeoutMs}ms — target window may not have focus`)),
        timeoutMs
      )
    ),
  ]);
}

class ClipboardWithFallback {
  constructor() {
    this.history = [];
    this.maxHistory = 10;
    this.historyFile = path.join(os.homedir(), ".trimtoken", "clipboard-history.json");
    this.loadHistory();
  }

  /**
   * Attempt to paste text to system clipboard
   * If fails, keep in local buffer for manual recovery
   * @param {string} text - Text to paste
   * @param {object} metadata
   * @returns {Promise<{success: boolean, error?: string, recoveryPath?: string}>}
   */
  async pasteWithFallback(text, metadata = {}, targetWindowHandle = null, targetWindowTitle = null) {
    console.log('[clipboard] Attempting paste...');

    try {
      // Try platform-specific paste with a hard timeout
      const success = await attemptPasteWithTimeout(
        () => this.attemptPaste(text, targetWindowHandle, targetWindowTitle),
        5000
      );

      if (success === 'focus_changed') {
        // Paste was skipped — text is still on clipboard for manual Ctrl+V
        console.log('[clipboard] Focus changed before paste, compressed text left on clipboard');
        this.addToHistory(text, metadata, "clipboard_only");
        return {
          success: false,
          error: 'Window changed before auto-paste could complete',
          reason: 'focus_changed',
          recoveryPath: 'Press Ctrl+V in the target window to paste',
        };
      }

      if (success) {
        console.log('[clipboard] Paste succeeded');
        this.addToHistory(text, metadata, "pasted");
        return { success: true };
      } else {
        throw new Error("Paste operation returned false");
      }
    } catch (error) {
      // THIS now always fires — either from a real error or from timeout
      const isFocusLost = error.message.includes('timed out');
      console.warn(`[clipboard] Paste failed: ${error.message}`);
      this.addToHistory(text, metadata, "failed_paste");

      return {
        success: false,
        error: error.message,
        reason: isFocusLost ? 'focus_lost' : 'other',
        recoveryPath: "Use clipboard history to recover",
      };
    }
  }

  /**
   * Attempt system paste
   */
  async attemptPaste(text, targetWindowHandle = null, targetWindowTitle = null) {
    console.log("[clipboard] attemptPaste() starting...");
    
    // Write text to clipboard
    clipboard.writeText(text);

    // Small delay to let clipboard settle
    await sleep(100);

    // Verify the target window still has focus before sending the paste keystroke
    if (targetWindowHandle || targetWindowTitle) {
      const currentWindow = getForegroundWindow();
      const currentWindowTitle = getActiveWindowTitle();

      const handleChanged = targetWindowHandle && currentWindow && currentWindow !== targetWindowHandle;
      const titleChanged = targetWindowTitle && currentWindowTitle && currentWindowTitle !== targetWindowTitle;

      if (handleChanged || titleChanged) {
        const reason = handleChanged ? 'different window' : 'different tab (title changed)';
        console.log(`[clipboard] Target changed (${reason})! Expected "${targetWindowTitle || targetWindowHandle}", now on "${currentWindowTitle || currentWindow}". Aborting auto-paste`);
        // Text is already on clipboard — user can Ctrl+V manually
        return 'focus_changed';
      }
    }

    // Simulate Ctrl+V to paste
    sendKeys('^v');
    
    console.log("[clipboard] attemptPaste() completed");

    // Delay for paste to complete before continuing
    await sleep(500);

    return true;
  }

  /**
   * Add to local clipboard history
   */
  addToHistory(text, metadata = {}, status = "saved") {
    const entry = {
      id: Date.now(),
      text,
      originalText: metadata.originalText || null,
      originalTokens: metadata.originalTokens || 0,
      compressedTokens: metadata.compressedTokens || 0,
      tier: metadata.tier || "unknown",
      provider: metadata.provider || "local",
      timestamp: new Date().toISOString(),
      status, // "pasted" | "failed_paste" | "saved"
    };

    this.history.unshift(entry); // Most recent first
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.saveHistory();
  }

  getHistory() {
    return this.history;
  }

  recover(id) {
    const entry = this.history.find((e) => e.id === id);
    if (!entry) {
      console.warn(`[clipboard] Entry ${id} not found in history`);
      return null;
    }
    return entry.text;
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  saveHistory() {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error(`[clipboard] Failed to save history: ${error.message}`);
    }
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, "utf8");
        this.history = JSON.parse(data).slice(0, this.maxHistory);
      }
    } catch (error) {
      console.warn(`[clipboard] Failed to load history: ${error.message}`);
      this.history = [];
    }
  }
}

const instance = new ClipboardWithFallback();
instance.getForegroundWindow = getForegroundWindow;
instance.getActiveWindowTitle = getActiveWindowTitle;
module.exports = instance;
