'use strict';

const { Notification, dialog } = require('electron');
const path = require('path');

/**
 * Notification Manager
 * Handles toast notifications for compression events and dialog modals
 */
class NotificationManager {
  constructor() {
    this.queue = [];
    this.timeout = null;
    this.displayDuration = 4000; // ms
    this.iconPath = path.join(__dirname, '../../assets/icon.png');
  }

  /**
   * Show compression success notification
   * @param {object} event - Compression event metadata
   */
  notifyCompressionSuccess(event) {
    const { originalTokens, compressedTokens, tier, provider, durationMs, passes } = event;
    const percentSaved = Math.round(
      ((originalTokens - compressedTokens) / originalTokens) * 100
    );
    const passInfo = passes ? ` (${passes} passes)` : '';
    const message = `✓ Compressed ${originalTokens} → ${compressedTokens} tokens (${percentSaved}% saved, Local${passInfo}, ${durationMs}ms)`;

    this.show(message, "success");
  }

  /**
   * Show paste failure with recovery hint
   * @param {object} event
   */
  notifyPasteFailure(event) {
    const { reason, compressedText } = event;
    const hints = {
      clipboard_locked: "Clipboard is locked by another app. Try again.",
      focus_lost: "TrimToken lost focus. Click the target window and try again.",
      focus_changed: "Compressed text copied to clipboard — press Ctrl+V to paste (window changed before auto-paste).",
      timeout: "Paste timed out. Use manual copy/paste instead.",
      other: "Paste failed. Compressed text is in your clipboard.",
    };

    const hint = hints[reason] || hints.other;
    const message = `❌ Paste failed. ${hint}`;

    this.show(message, "error");

    // Keep compressed text in clipboard for manual paste
    if (compressedText) {
      this.logRecoveryInfo(compressedText);
    }
  }

  /**
   * Show Tier 1 API call in progress
   * @param {object} event
   */
  notifyTier1Start(event) {
    const { provider } = event;
    const message = `⏱️ Sending to ${provider} for compression...`;
    this.show(message, "info");
  }

  /**
   * Show Tier 1 API call completed
   * @param {object} event
   */
  notifyTier1Complete(event) {
    const { provider, durationMs, originalTokens, compressedTokens } = event;
    const percentSaved = Math.round(
      ((originalTokens - compressedTokens) / originalTokens) * 100
    );
    const message = `✓ ${provider} compression done (${percentSaved}% saved, ${durationMs}ms)`;
    this.show(message, "success");
  }

  /**
   * Show privacy warning (first Tier 1 use)
   * This is a blocking notification, not a toast
   */
  async notifyPrivacyWarning(event) {
    const { provider, sampleText } = event;
    
    const response = await dialog.showMessageBox({
      type: 'warning',
      title: 'Using External API for Compression',
      message: `TrimToken will send a compressed version of your message to ${provider}'s API to compress further.\n\nSample: "${sampleText.substring(0, 50)}..."\n\nYour original text stays on your device.`,
      buttons: ["I understand", "Switch to local-only mode"],
      defaultId: 0,
      cancelId: 1
    });

    return response.response === 0; // true if 'I understand'
  }

  /**
   * Internal: show a toast using Electron's Notification API
   */
  show(message, level = "info") {
    console.log(`[notification-${level}] ${message}`);
    
    if (Notification.isSupported()) {
      new Notification({
        title: 'TrimToken',
        body: message,
        icon: this.iconPath,
        silent: true
      }).show();
    }
  }

  /**
   * Log recovery info for clipboard history
   */
  logRecoveryInfo(compressedText) {
    console.log(`[recovery] Compressed text available for manual recovery:\n${compressedText.substring(0, 50)}...`);
  }
}

module.exports = new NotificationManager();
