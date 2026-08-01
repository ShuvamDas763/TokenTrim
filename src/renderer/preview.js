'use strict';

/**
 * Preview logic
 * Receives original and compressed text via IPC.
 * Renders a naive inline diff.
 * Sends accept/reject back to main process.
 */

let autoDismissTimer = null;

// Listen for data from main process
window.trimtoken.onPreviewData((data) => {
  const { original, compressed, tokensUsed, provider, tier, theme } = data;

  // Apply theme from main process
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  // Update title based on tier
  const titleEl = document.querySelector('.title');
  if (titleEl) {
    const tierDisplay = tier !== undefined ? tier : (provider === 'local' ? 0 : 1);
    titleEl.innerHTML = `<span class="icon">◆</span> Tier ${tierDisplay} Compression`;
  }
  
  // Update meta text
  const savedChars = original.length - compressed.length;
  const savedPercent = Math.round((savedChars / original.length) * 100) || 0;
  
  // Estimate tokens: ~1.3 tokens per word
  const inputTokens = Math.max(1, Math.ceil(original.trim().split(/\s+/).length * 1.3));
  const outputTokens = Math.max(1, Math.ceil(compressed.trim().split(/\s+/).length * 1.3));

  document.getElementById('metaText').textContent = 
    `Tokens: ${inputTokens} → ${outputTokens} (-${savedPercent}% chars) | Cost: ${tokensUsed} tk | ${provider}`;
  
  // Render diff
  renderDiff(original, compressed);
  
  // Start auto-dismiss timer (30s)
  clearTimeout(autoDismissTimer);
  autoDismissTimer = setTimeout(() => {
    sendDecision('accept'); // Default to accept if ignored
  }, 30000);
});

/**
 * Very naive diff visualization for the UI.
 * A full diff-match-patch is overkill for a quick preview, 
 * so we do a simple word-based heuristic to highlight changes.
 */
function renderDiff(original, compressed) {
  const container = document.getElementById('diffContainer');
  
  // If strings are identical, just show it
  if (original === compressed) {
    container.textContent = compressed;
    return;
  }
  
  // Quick heuristic: find common prefix and suffix
  let start = 0;
  while (start < original.length && start < compressed.length && original[start] === compressed[start]) {
    start++;
  }
  
  // Backtrack to word boundary for cleaner visual
  while (start > 0 && !/\s/.test(original[start-1])) start--;
  
  let origEnd = original.length;
  let compEnd = compressed.length;
  while (origEnd > start && compEnd > start && original[origEnd-1] === compressed[compEnd-1]) {
    origEnd--;
    compEnd--;
  }
  
  // Backtrack forward to word boundary
  while (origEnd < original.length && !/\s/.test(original[origEnd])) {
    origEnd++;
    compEnd++;
  }
  
  const prefix = original.substring(0, start);
  const suffix = original.substring(origEnd);
  
  const deleted = original.substring(start, origEnd);
  const added = compressed.substring(start, compEnd);
  
  // Construct HTML
  let html = escapeHtml(prefix);
  
  if (deleted) {
    html += `<del>${escapeHtml(deleted)}</del>`;
  }
  
  if (added) {
    html += `<ins>${escapeHtml(added)}</ins>`;
  }
  
  html += escapeHtml(suffix);
  
  container.innerHTML = html;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sendDecision(decision) {
  clearTimeout(autoDismissTimer);
  window.trimtoken.sendPreviewDecision(decision);
}

// Button handlers
document.getElementById('acceptBtn').addEventListener('click', () => sendDecision('accept'));
document.getElementById('revertBtn').addEventListener('click', () => sendDecision('revert'));

// Keyboard shortcuts (Enter to accept, Esc to revert)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendDecision('accept');
  if (e.key === 'Escape') sendDecision('revert');
});
