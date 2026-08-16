'use strict';

// Note: Electron preload script exposes `window.electron` with `ipcRenderer` and `receive`

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

window.trimtoken.onPreviewData((config) => {
  console.log('[preview-modal] render() called with:', config);
  const {
    originalText,
    compressedText,
    originalTokens,
    compressedTokens,
    tier,
    provider,
  } = config;

  const percentSaved = originalTokens > 0 ? Math.round(
    ((originalTokens - compressedTokens) / originalTokens) * 100
  ) : 0;
  
  const tierLabel = tier === "tier0" ? "Local compression" : `${provider} API`;

  document.getElementById('statText').textContent = `Compression: ${percentSaved}% saved (${originalTokens} → ${compressedTokens} tokens, ${tierLabel})`;

  const displayOriginal = originalText && originalText.length > 500 
    ? originalText.slice(0, 500) + '...'
    : (originalText || '');
    
  const displayCompressed = compressedText && compressedText.length > 500
    ? compressedText.slice(0, 500) + '...'
    : (compressedText || '');

  document.getElementById('originalText').innerHTML = escapeHtml(displayOriginal);
  document.getElementById('originalTokens').textContent = `${originalTokens} tokens`;

  document.getElementById('compressedText').innerHTML = escapeHtml(displayCompressed);
  document.getElementById('compressedTokens').textContent = `${compressedTokens} tokens`;
});

// Setup click handlers to send IPC decision back to main process
document.getElementById('btnApprove').addEventListener('click', () => {
  window.trimtoken.sendPreviewDecision('approve');
});

document.getElementById('btnOriginal').addEventListener('click', () => {
  window.trimtoken.sendPreviewDecision('original');
});

document.getElementById('btnReject').addEventListener('click', () => {
  window.trimtoken.sendPreviewDecision('reject');
});
