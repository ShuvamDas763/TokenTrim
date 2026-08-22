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
    theme,
    showBackgroundVideo,
  } = config;

  // Apply theme and video settings
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  const bgContainer = document.querySelector('.bg-container');
  if (bgContainer) {
    bgContainer.style.display = showBackgroundVideo ? 'block' : 'none';
  }

  const percentSaved = originalTokens > 0 ? Math.round(
    ((originalTokens - compressedTokens) / originalTokens) * 100
  ) : 0;
  
  const tierLabel = tier === "tier0" ? "Local compression" : `${provider} API`;

  document.getElementById('statContainer').style.display = 'flex';
  document.getElementById('statTokens').textContent = `${originalTokens} → ${compressedTokens} tokens`;
  document.getElementById('statProvider').textContent = tierLabel;
  document.getElementById('percentText').textContent = `${percentSaved}%`;

  const circle = document.getElementById('progressRing');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentSaved / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  const diffResult = window.Diff.diffWords(originalText || '', compressedText || '');
  
  let origHtml = '';
  let compHtml = '';

  diffResult.forEach((part) => {
    const escaped = escapeHtml(part.value);
    if (part.added) {
      compHtml += `<span style="background: rgba(62, 207, 142, 0.15); color: #66e0a6; text-decoration: none; border-radius: 3px; padding: 0 3px;">${escaped}</span>`;
    } else if (part.removed) {
      origHtml += `<span style="background: rgba(255, 92, 92, 0.15); color: #ff8a8a; text-decoration: line-through; border-radius: 3px; padding: 0 3px;">${escaped}</span>`;
    } else {
      origHtml += escaped;
      compHtml += escaped;
    }
  });

  document.getElementById('originalText').innerHTML = origHtml;
  document.getElementById('originalTokens').textContent = `${originalTokens} tokens`;

  document.getElementById('compressedText').innerHTML = compHtml;
  document.getElementById('compressedTokens').textContent = `${compressedTokens} tokens`;

  let timeLeft = 30;
  const timerEl = document.getElementById('autoAcceptTimer');
  if (timerEl) timerEl.textContent = `Auto-accepting in ${timeLeft}s...`;
  
  if (window.autoAcceptInterval) clearInterval(window.autoAcceptInterval);
  window.autoAcceptInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.textContent = `Auto-accepting in ${timeLeft}s...`;
    if (timeLeft <= 0) {
      clearInterval(window.autoAcceptInterval);
      window.trimtoken.sendPreviewDecision('approve');
    }
  }, 1000);
});

function stopTimer() {
  if (window.autoAcceptInterval) clearInterval(window.autoAcceptInterval);
}

// Setup click handlers to send IPC decision back to main process
document.getElementById('btnApprove').addEventListener('click', () => {
  stopTimer();
  window.trimtoken.sendPreviewDecision('approve');
});

document.getElementById('btnOriginal').addEventListener('click', () => {
  stopTimer();
  window.trimtoken.sendPreviewDecision('original');
});

document.getElementById('btnReject').addEventListener('click', () => {
  stopTimer();
  window.trimtoken.sendPreviewDecision('reject');
});

// ── Video Background Performance ───────────────────────────────
document.addEventListener('visibilitychange', () => {
  const video = document.querySelector('.bg-video');
  if (video) {
    if (document.hidden) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }
});
