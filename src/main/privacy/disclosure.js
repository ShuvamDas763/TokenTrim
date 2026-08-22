'use strict';

const { app, dialog } = require('electron');
const config = require('../config');

/**
 * Checks if the user has seen the one-time privacy disclosure for Tier 1.
 * If not, displays it.
 * 
 * @returns {Promise<boolean>} True if the user agrees (or has already agreed) and Tier 1 should proceed.
 *                             False if the user cancels and wants to go to settings.
 */
async function checkAndShowDisclosure() {
  const hasSeen = await config.getSetting('hasSeenTier1Disclosure');
  if (hasSeen) {
    return true; // Already saw it, proceed
  }

  // Show one-time dialog
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Privacy Notice: Cloud Compression',
    message: 'Longer messages get sent to a free AI provider (Groq, Cerebras, or NVIDIA) for better compression. Short messages always stay fully local. You can turn this off anytime in Settings → Providers.',
    buttons: ['OK, got it', 'Go to Settings'],
    defaultId: 0,
    cancelId: 1
  });

  if (response === 0) {
    // "OK, got it"
    await config.setSetting('hasSeenTier1Disclosure', true);
    return true;
  } else {
    // "Go to Settings"
    app.emit('open-settings', 'providers');
    return false;
  }
}

module.exports = {
  checkAndShowDisclosure
};
