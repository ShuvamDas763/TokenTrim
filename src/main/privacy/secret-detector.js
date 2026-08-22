'use strict';

const { dialog } = require('electron');

/**
 * Detects if the given text contains potential secrets (API keys, passwords, credit cards).
 * 
 * @param {string} text 
 * @returns {boolean} True if a potential secret is detected.
 */
function detectPotentialSecrets(text) {
  if (!text) return false;

  const regexes = [
    /(?:sk|pk)_[a-zA-Z0-9_-]{20,}/, // OpenAI/Stripe
    /sk-[a-zA-Z0-9_-]{20,}/,        // OpenAI standard
    /AKIA[0-9A-Z]{16}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /xox[baprs]-[a-zA-Z0-9]+/,
    /Bearer\s+[A-Za-z0-9\-\._~\+\/]{20,}=*/,
    /(?:key|token|secret|password|api_key|apikey)[\s:=]+([A-Za-z0-9_\-]{20,})/i, // Case-insensitive generic
    /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:\d[ -]*?){13,19}\b/
  ];

  for (const regex of regexes) {
    if (regex.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks text for secrets and warns the user if necessary.
 * 
 * @param {string} text 
 * @returns {Promise<boolean>} True if safe or user wants to proceed anyway. False if user cancels.
 */
async function checkSecretWarning(text) {
  if (!detectPotentialSecrets(text)) {
    return true; // Safe to proceed
  }

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Potential Secret Detected',
    message: 'This looks like it might contain a password, API key, or other sensitive data. Send it to an external API anyway?',
    buttons: ['Send Anyway', 'Cancel'],
    defaultId: 1, // Default to Cancel for safety
    cancelId: 1
  });

  if (response === 0) {
    return true; // Send Anyway
  } else {
    return false; // Cancel
  }
}

module.exports = {
  detectPotentialSecrets,
  checkSecretWarning
};
