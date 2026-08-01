'use strict';

/* ═══════════════════════════════════════════════════════════════
   TrimToken — Settings Panel Logic
   ═══════════════════════════════════════════════════════════════ */

// ── Theme switching ────────────────────────────────────────────
let currentTheme = 'command-center';

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme card selection UI
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.themeValue === theme);
  });

  // Update the radio button state
  const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
  if (radio) radio.checked = true;
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    const theme = card.dataset.themeValue;
    applyTheme(theme);
    // Notify main process for tray icon color update
    if (window.trimtoken.notifyThemeChanged) {
      window.trimtoken.notifyThemeChanged(theme);
    }
  });
});

// ── Tab switching ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Deactivate all tabs and content
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activate clicked tab
    tab.classList.add('active');
    const tabId = `tab-${tab.dataset.tab}`;
    document.getElementById(tabId).classList.add('active');

    // Load tab-specific data
    if (tab.dataset.tab === 'providers') loadProviders();
    if (tab.dataset.tab === 'phraselog') loadPhraseLog();
  });
});

// ── Load settings ──────────────────────────────────────────────
async function loadSettings() {
  try {
    const settings = await window.trimtoken.getSettings();

    document.getElementById('hotkey').value = settings.hotkey || 'Ctrl+Shift+C';
    document.getElementById('undoHotkey').value = settings.undoHotkey || 'Ctrl+Shift+Z';
    document.getElementById('tier0Preview').checked = settings.tier0Preview || false;
    document.getElementById('tier1Preview').checked = settings.tier1Preview !== false;
    document.getElementById('aggressiveness').value = settings.aggressiveness || 2;
    document.getElementById('aggressivenessValue').textContent = settings.aggressiveness || 2;
    document.getElementById('tokenThreshold').value = settings.tokenThreshold || 150;

    // Apply persisted theme
    applyTheme(settings.theme || 'command-center');

    setStatus('Settings loaded');
  } catch (err) {
    setStatus('Failed to load settings: ' + err.message);
  }
}

// ── Save settings ──────────────────────────────────────────────
async function saveSettings() {
  try {
    const settings = {
      hotkey: document.getElementById('hotkey').value,
      undoHotkey: document.getElementById('undoHotkey').value,
      tier0Preview: document.getElementById('tier0Preview').checked,
      tier1Preview: document.getElementById('tier1Preview').checked,
      aggressiveness: parseInt(document.getElementById('aggressiveness').value),
      tokenThreshold: parseInt(document.getElementById('tokenThreshold').value),
      theme: currentTheme,
    };

    await window.trimtoken.saveSettings(settings);
    setStatus('Settings saved ✓');
  } catch (err) {
    setStatus('Failed to save: ' + err.message);
  }
}

// ── Hotkey recording ───────────────────────────────────────────
let recordingInput = null;

document.querySelectorAll('.hotkey-input').forEach(input => {
  input.addEventListener('click', () => {
    if (recordingInput) {
      recordingInput.classList.remove('recording');
      recordingInput.value = recordingInput.dataset.original || recordingInput.value;
    }

    recordingInput = input;
    input.dataset.original = input.value;
    input.value = 'Press keys...';
    input.classList.add('recording');
  });
});

document.addEventListener('keydown', (e) => {
  if (!recordingInput) return;

  e.preventDefault();
  e.stopPropagation();

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  // Ignore modifier-only keypresses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(keyName);

  recordingInput.value = parts.join('+');
  recordingInput.classList.remove('recording');
  recordingInput = null;
});

// Click elsewhere to cancel recording
document.addEventListener('click', (e) => {
  if (recordingInput && !e.target.classList.contains('hotkey-input')) {
    recordingInput.classList.remove('recording');
    recordingInput.value = recordingInput.dataset.original || recordingInput.value;
    recordingInput = null;
  }
});

// ── Aggressiveness slider ──────────────────────────────────────
document.getElementById('aggressiveness').addEventListener('input', (e) => {
  document.getElementById('aggressivenessValue').textContent = e.target.value;
});

// ── Providers ──────────────────────────────────────────────────
async function loadProviders() {
  try {
    const states = await window.trimtoken.getProviderStates();
    const container = document.getElementById('providerList');
    container.innerHTML = '';

    states.forEach((provider, index) => {
      const statusClass = provider.creditExhausted ? 'unavailable' :
                          !provider.hasKey ? 'no-key' :
                          provider.available ? 'available' : 'unavailable';
      const statusText = provider.creditExhausted ? 'Exhausted' :
                         !provider.hasKey ? 'No key' :
                         provider.available ? 'Available' : 'Cooling down';

      const card = document.createElement('div');
      card.className = 'provider-card';
      card.innerHTML = `
        <div class="provider-header">
          <div class="provider-name">
            ${index + 1}. ${provider.name}
            <span class="provider-badge ${provider.renewable ? 'badge-renewable' : 'badge-onetime'}">
              ${provider.renewable ? '♻ Daily' : '⚡ One-time'}
            </span>
          </div>
          <div class="provider-status">
            <span class="status-dot ${statusClass}"></span>
            ${statusText}
          </div>
        </div>
        <div class="provider-model">${provider.model}</div>
        <div class="provider-key-row">
          <input type="password" id="key-${provider.name}" placeholder="API key" value="">
          <button class="key-toggle" data-target="key-${provider.name}">👁</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Toggle key visibility
    container.querySelectorAll('.key-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });
  } catch (err) {
    setStatus('Failed to load providers: ' + err.message);
  }
}

// Save provider keys
async function saveProviderKeys() {
  const inputs = document.querySelectorAll('.provider-key-row input');
  const updates = [];

  inputs.forEach(input => {
    const name = input.id.replace('key-', '');
    const apiKey = input.value.trim();
    if (apiKey) {
      updates.push({ name, apiKey });
    }
  });

  if (updates.length > 0) {
    await window.trimtoken.updateProviderKeys(updates);
    loadProviders();
  }
}

// ── Phrase Log ─────────────────────────────────────────────────
async function loadPhraseLog() {
  try {
    const log = await window.trimtoken.getPhraseLog();
    const tbody = document.getElementById('phraseLogBody');
    const phrases = Object.entries(log.phrases || {});

    if (phrases.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">No phrases tracked yet. Use TrimToken to start building history.</td>
        </tr>
      `;
      return;
    }

    // Sort by total uses descending
    phrases.sort((a, b) => (b[1].applied + b[1].reverted) - (a[1].applied + a[1].reverted));

    tbody.innerHTML = '';
    for (const [phrase, data] of phrases) {
      const confidence = Math.round(data.confidence * 100);
      const barColor = confidence >= 70 ? 'var(--success)' :
                       confidence >= 40 ? 'var(--warning)' : 'var(--danger)';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-style: italic; color: var(--text-secondary);">"${phrase}"</td>
        <td>${data.applied}</td>
        <td>${data.reverted}</td>
        <td>
          <div class="confidence-bar">
            <div class="confidence-bar-fill">
              <span style="width: ${confidence}%; background: ${barColor};"></span>
            </div>
            ${confidence}%
          </div>
        </td>
        <td>
          <input type="checkbox" class="exclude-toggle" data-phrase="${phrase}"
                 ${data.excluded ? 'checked' : ''}>
        </td>
      `;
      tbody.appendChild(row);
    }

    // Exclusion toggle handlers
    tbody.querySelectorAll('.exclude-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        await window.trimtoken.togglePhraseExclusion(checkbox.dataset.phrase, checkbox.checked);
        setStatus(`"${checkbox.dataset.phrase}" ${checkbox.checked ? 'excluded' : 'included'}`);
      });
    });
  } catch (err) {
    setStatus('Failed to load phrase log: ' + err.message);
  }
}

// ── Clear NIM flag ─────────────────────────────────────────────
document.getElementById('clearNimBtn').addEventListener('click', async () => {
  await window.trimtoken.clearNimFlag();
  loadProviders();
  setStatus('NIM exhaustion flag cleared');
});

// ── Reset phrase log ───────────────────────────────────────────
document.getElementById('resetLogBtn').addEventListener('click', async () => {
  if (confirm('Reset all phrase learning data? This cannot be undone.')) {
    await window.trimtoken.resetPhraseLog();
    loadPhraseLog();
    setStatus('Phrase log reset');
  }
});

// ── Save button ────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', async () => {
  await saveSettings();
  await saveProviderKeys();
});

// ── Close button ───────────────────────────────────────────────
document.getElementById('closeBtn').addEventListener('click', () => {
  window.trimtoken.closeWindow();
});

// ── Status helper ──────────────────────────────────────────────
function setStatus(msg) {
  const el = document.getElementById('statusText');
  el.textContent = msg;
  // Auto-clear after 4 seconds
  setTimeout(() => {
    if (el.textContent === msg) el.textContent = '';
  }, 4000);
}

// ── Init ───────────────────────────────────────────────────────
loadSettings();
