// ScriptVault — Multi-Profile Support
// Different script configurations for different contexts: work, personal, dev, etc.
// Provides profile creation, switching, auto-activation via URL rules,
// keyboard shortcuts, and a dashboard UI with profile bar + editor modal.

const ProfileManager = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY_PROFILES = 'profiles';
  const STORAGE_KEY_ACTIVE = 'activeProfileId';
  const MAX_PROFILES = 10;
  const DEFAULT_PROFILE_ID = '__default__';

  const PROFILE_COLORS = [
    '#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#fb923c',
    '#c084fc', '#34d399', '#f472b6', '#a78bfa', '#38bdf8'
  ];

  const PROFILE_EMOJIS = [
    '\u{1F3E0}', '\u{1F4BC}', '\u{1F6E0}\uFE0F', '\u{1F3AE}', '\u{1F4DA}',
    '\u{1F680}', '\u{1F50D}', '\u{1F3A8}', '\u{2699}\uFE0F', '\u{1F9EA}'
  ];

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _profileBar = null;
  let _modalEl = null;
  let _styleEl = null;
  let _profiles = [];
  let _activeProfileId = null;
  let _initialized = false;
  let _keydownHandler = null;
  let _comparisonEl = null;
  let _onActivatedListener = null;
  let _onUpdatedListener = null;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Profile Bar */
.sv-profile-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-header, #252525);
  border-bottom: 1px solid var(--border-color, #404040);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  overflow-x: auto;
}
.sv-profile-bar-label {
  color: var(--text-secondary, #a0a0a0);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}
.sv-profile-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid var(--border-color, #404040);
  background: var(--bg-row, #2a2a2a);
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-size: 12px;
  user-select: none;
}
.sv-profile-chip:hover {
  background: var(--bg-row-hover, #333333);
  border-color: var(--text-secondary, #a0a0a0);
}
.sv-profile-chip.active {
  border-color: var(--color, var(--accent-green, #4ade80));
  box-shadow: 0 0 0 1px var(--color, var(--accent-green, #4ade80));
  background: var(--bg-row-selected, #2d3a4d);
}
.sv-profile-chip .sv-chip-emoji {
  font-size: 14px;
}
.sv-profile-chip .sv-chip-shortcut {
  color: var(--text-muted, #707070);
  font-size: 10px;
  margin-left: 2px;
}
.sv-profile-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px dashed var(--border-color, #404040);
  background: transparent;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 16px;
  flex-shrink: 0;
}
.sv-profile-add-btn:hover {
  border-color: var(--accent-green, #4ade80);
  color: var(--accent-green, #4ade80);
  background: rgba(74, 222, 128, 0.08);
}

/* Header Profile Indicator */
.sv-profile-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  transition: background 0.15s ease;
}
.sv-profile-indicator:hover {
  background: rgba(255,255,255,0.06);
}
.sv-profile-indicator .sv-pi-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Profile Dropdown (in header) */
.sv-profile-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-header, #252525);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 9000;
  overflow: hidden;
  animation: sv-profile-dd-in 0.12s ease;
}
@keyframes sv-profile-dd-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.sv-profile-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  transition: background 0.1s ease;
}
.sv-profile-dropdown-item:hover {
  background: var(--bg-row-hover, #333333);
}
.sv-profile-dropdown-item.active {
  background: var(--bg-row-selected, #2d3a4d);
}
.sv-profile-dropdown-item .sv-dd-check {
  color: var(--accent-green, #4ade80);
  font-size: 12px;
  width: 16px;
  text-align: center;
}

/* Profile Editor Modal */
.sv-profile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.sv-profile-overlay.visible { opacity: 1; }

.sv-profile-modal {
  background: var(--bg-header, #252525);
  border: 1px solid var(--border-color, #404040);
  border-radius: 12px;
  width: 560px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  transform: translateY(12px);
  transition: transform 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
}
.sv-profile-overlay.visible .sv-profile-modal {
  transform: translateY(0);
}
.sv-profile-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #404040);
}
.sv-profile-modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.sv-profile-modal-close {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0a0);
  font-size: 20px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.sv-profile-modal-close:hover {
  color: var(--text-primary, #e0e0e0);
  background: rgba(255,255,255,0.08);
}
.sv-profile-modal-body {
  padding: 20px;
}
.sv-profile-field {
  margin-bottom: 16px;
}
.sv-profile-field label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.sv-profile-field input[type="text"],
.sv-profile-field textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input, #333333);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.sv-profile-field input[type="text"]:focus,
.sv-profile-field textarea:focus {
  border-color: var(--accent-green, #4ade80);
}
.sv-profile-field textarea {
  min-height: 60px;
  resize: vertical;
  font-family: monospace;
  font-size: 12px;
}

/* Color / Emoji selectors */
.sv-profile-color-grid,
.sv-profile-emoji-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sv-profile-color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.15s;
}
.sv-profile-color-swatch:hover { transform: scale(1.15); }
.sv-profile-color-swatch.selected { border-color: #fff; }
.sv-profile-emoji-option {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 18px;
  transition: background 0.1s, border-color 0.15s;
}
.sv-profile-emoji-option:hover { background: var(--bg-row-hover, #333333); }
.sv-profile-emoji-option.selected {
  border-color: var(--accent-green, #4ade80);
  background: var(--bg-row-selected, #2d3a4d);
}

/* Script toggle list */
.sv-profile-scripts {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
}
.sv-profile-script-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #404040);
}
.sv-profile-script-row:last-child { border-bottom: none; }
.sv-profile-script-row label {
  flex: 1;
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
}
.sv-profile-script-row input[type="checkbox"] {
  accent-color: var(--accent-green, #4ade80);
}

/* Modal footer */
.sv-profile-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color, #404040);
}
.sv-profile-btn {
  padding: 7px 18px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #404040);
  background: var(--bg-input, #333333);
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}
.sv-profile-btn:hover {
  background: var(--bg-row-hover, #333333);
  border-color: var(--text-secondary, #a0a0a0);
}
.sv-profile-btn-primary {
  background: var(--accent-green-dark, #22c55e);
  border-color: var(--accent-green-dark, #22c55e);
  color: #000;
  font-weight: 600;
}
.sv-profile-btn-primary:hover {
  background: var(--accent-green, #4ade80);
  border-color: var(--accent-green, #4ade80);
}
.sv-profile-btn-danger {
  color: var(--accent-red, #f87171);
  border-color: var(--accent-red, #f87171);
}
.sv-profile-btn-danger:hover {
  background: rgba(248, 113, 113, 0.12);
}

/* Comparison view */
.sv-profile-compare-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sv-profile-compare {
  background: var(--bg-header, #252525);
  border: 1px solid var(--border-color, #404040);
  border-radius: 12px;
  width: 640px;
  max-width: 95vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  padding: 20px;
}
.sv-compare-row {
  display: grid;
  grid-template-columns: 1fr 80px 80px;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color, #404040);
  font-size: 12px;
}
.sv-compare-row.header {
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  text-transform: uppercase;
  font-size: 11px;
}
.sv-compare-on { color: var(--accent-green, #4ade80); }
.sv-compare-off { color: var(--accent-red, #f87171); }
.sv-compare-diff { background: rgba(251, 191, 36, 0.06); }
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-profile-styles';
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function _loadProfiles() {
    const data = await chrome.storage.local.get([STORAGE_KEY_PROFILES, STORAGE_KEY_ACTIVE]);
    _profiles = data[STORAGE_KEY_PROFILES] || [];
    _activeProfileId = data[STORAGE_KEY_ACTIVE] || DEFAULT_PROFILE_ID;

    // Ensure default profile exists
    if (!_profiles.find(p => p.id === DEFAULT_PROFILE_ID)) {
      _profiles.unshift({
        id: DEFAULT_PROFILE_ID,
        name: 'Default',
        emoji: '\u{1F3E0}',
        color: PROFILE_COLORS[0],
        scriptStates: {},
        urlRules: [],
        settingsOverrides: {},
        createdAt: Date.now()
      });
      await _saveProfiles();
    }
    return _profiles;
  }

  async function _saveProfiles() {
    await chrome.storage.local.set({
      [STORAGE_KEY_PROFILES]: _profiles,
      [STORAGE_KEY_ACTIVE]: _activeProfileId
    });
  }

  /** Get all scripts from the extension background. */
  async function _getAllScripts() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getScripts' });
      return res?.scripts || res || [];
    } catch (_) {
      return [];
    }
  }

  /** Enable/disable a script via background message. */
  async function _setScriptEnabled(scriptId, enabled) {
    try {
      await chrome.runtime.sendMessage({
        action: 'toggleScript',
        id: scriptId,
        enabled
      });
    } catch (_) {}
  }

  /* ------------------------------------------------------------------ */
  /*  Profile switching                                                  */
  /* ------------------------------------------------------------------ */

  async function _applyProfile(profile) {
    if (!profile) return;
    const scripts = await _getAllScripts();

    for (const script of scripts) {
      const id = script.id;
      if (id in profile.scriptStates) {
        const shouldBeEnabled = profile.scriptStates[id];
        if ((script.enabled !== false) !== shouldBeEnabled) {
          await _setScriptEnabled(id, shouldBeEnabled);
        }
      }
    }

    _activeProfileId = profile.id;
    await _saveProfiles();
    _renderProfileBar();
  }

  /* ------------------------------------------------------------------ */
  /*  URL rule auto-switching                                            */
  /* ------------------------------------------------------------------ */

  function _checkUrlRules(url) {
    if (!url) return null;
    for (const profile of _profiles) {
      if (!profile.urlRules || profile.urlRules.length === 0) continue;
      for (const rule of profile.urlRules) {
        try {
          if (rule.startsWith('/') && rule.endsWith('/')) {
            // Regex rule — reject overly long patterns to mitigate ReDoS
            const pattern = rule.slice(1, -1);
            if (pattern.length > 200) continue;
            const regex = new RegExp(pattern);
            try {
              if (regex.test(url)) return profile;
            } catch (_) {}
          } else if (url.includes(rule)) {
            return profile;
          }
        } catch (_) {}
      }
    }
    return null;
  }

  function _startUrlWatcher() {
    // Periodically check the current tab URL for auto-switch rules
    // (runs from the dashboard page, observes the current tab)
    if (!chrome.tabs) return;

    _onActivatedListener = async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const match = _checkUrlRules(tab.url);
        if (match && match.id !== _activeProfileId) {
          await _applyProfile(match);
        }
      } catch (_) {}
    };
    chrome.tabs.onActivated?.addListener(_onActivatedListener);

    _onUpdatedListener = (_tabId, changeInfo) => {
      if (changeInfo.url) {
        const match = _checkUrlRules(changeInfo.url);
        if (match && match.id !== _activeProfileId) {
          _applyProfile(match);
        }
      }
    };
    chrome.tabs.onUpdated?.addListener(_onUpdatedListener);
  }

  /* ------------------------------------------------------------------ */
  /*  Keyboard shortcuts (Alt+1 through Alt+9)                           */
  /* ------------------------------------------------------------------ */

  function _setupKeyboardShortcuts() {
    if (_keydownHandler) return;
    _keydownHandler = (e) => {
      if (!e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx < _profiles.length) {
          e.preventDefault();
          _applyProfile(_profiles[idx]);
        }
      }
    };
    document.addEventListener('keydown', _keydownHandler);
  }

  function _teardownKeyboardShortcuts() {
    if (_keydownHandler) {
      document.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Profile Bar UI                                                     */
  /* ------------------------------------------------------------------ */

  function _renderProfileBar() {
    if (!_profileBar) return;

    let html = '<span class="sv-profile-bar-label">Profiles</span>';
    _profiles.forEach((p, idx) => {
      const isActive = p.id === _activeProfileId;
      const shortcut = idx < 9 ? `Alt+${idx + 1}` : '';
      html += `
        <span class="sv-profile-chip${isActive ? ' active' : ''}"
              style="--color: ${p.color}"
              data-profile-id="${p.id}"
              title="${_escapeHtml(p.name)}${shortcut ? ' (' + shortcut + ')' : ''}">
          <span class="sv-chip-emoji">${p.emoji || ''}</span>
          <span>${_escapeHtml(p.name)}</span>
          ${shortcut ? `<span class="sv-chip-shortcut">${shortcut}</span>` : ''}
        </span>`;
    });

    if (_profiles.length < MAX_PROFILES) {
      html += '<button class="sv-profile-add-btn" title="New profile">+</button>';
    }

    _profileBar.innerHTML = html;

    // Click handlers
    _profileBar.querySelectorAll('.sv-profile-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const id = chip.dataset.profileId;
        if (e.shiftKey) {
          // Shift+click opens editor
          const profile = _profiles.find(p => p.id === id);
          if (profile) _openEditorModal(profile);
        } else {
          const profile = _profiles.find(p => p.id === id);
          if (profile) _applyProfile(profile);
        }
      });
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = chip.dataset.profileId;
        const profile = _profiles.find(p => p.id === id);
        if (profile) _openEditorModal(profile);
      });
    });

    const addBtn = _profileBar.querySelector('.sv-profile-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => _openEditorModal(null));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Header dropdown                                                    */
  /* ------------------------------------------------------------------ */

  function _createHeaderIndicator(headerEl) {
    if (!headerEl) return;

    const existing = headerEl.querySelector('.sv-profile-indicator');
    if (existing) existing.remove();

    const active = _profiles.find(p => p.id === _activeProfileId) || _profiles[0];
    if (!active) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-flex';

    const indicator = document.createElement('div');
    indicator.className = 'sv-profile-indicator';
    indicator.innerHTML = `
      <span class="sv-pi-dot" style="background:${active.color}"></span>
      <span>${active.emoji || ''} ${_escapeHtml(active.name)}</span>
      <span style="font-size:10px;color:var(--text-muted)">\u25BE</span>
    `;

    let dropdownOpen = false;
    indicator.addEventListener('click', () => {
      if (dropdownOpen) {
        wrapper.querySelector('.sv-profile-dropdown')?.remove();
        dropdownOpen = false;
        return;
      }
      const dd = document.createElement('div');
      dd.className = 'sv-profile-dropdown';

      _profiles.forEach(p => {
        const item = document.createElement('div');
        item.className = 'sv-profile-dropdown-item' + (p.id === _activeProfileId ? ' active' : '');
        item.innerHTML = `
          <span class="sv-dd-check">${p.id === _activeProfileId ? '\u2713' : ''}</span>
          <span>${p.emoji || ''}</span>
          <span style="flex:1">${_escapeHtml(p.name)}</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          dd.remove();
          dropdownOpen = false;
          _applyProfile(p);
          _createHeaderIndicator(headerEl); // refresh
        });
        dd.appendChild(item);
      });

      wrapper.appendChild(dd);
      dropdownOpen = true;

      // Close on outside click
      const closeHandler = (e) => {
        if (!wrapper.contains(e.target)) {
          dd.remove();
          dropdownOpen = false;
          document.removeEventListener('click', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
    });

    wrapper.appendChild(indicator);
    headerEl.appendChild(wrapper);
  }

  /* ------------------------------------------------------------------ */
  /*  Editor Modal                                                       */
  /* ------------------------------------------------------------------ */

  async function _openEditorModal(profile) {
    const isNew = !profile;
    const scripts = await _getAllScripts();

    const editing = profile ? { ...profile } : {
      id: _generateId(),
      name: '',
      emoji: PROFILE_EMOJIS[_profiles.length % PROFILE_EMOJIS.length],
      color: PROFILE_COLORS[_profiles.length % PROFILE_COLORS.length],
      scriptStates: {},
      urlRules: [],
      settingsOverrides: {},
      createdAt: Date.now()
    };

    // If new, snapshot current script states
    if (isNew) {
      for (const s of scripts) {
        editing.scriptStates[s.id] = s.enabled !== false;
      }
    }

    // Build modal
    const overlay = document.createElement('div');
    overlay.className = 'sv-profile-overlay';
    overlay.innerHTML = `
      <div class="sv-profile-modal">
        <div class="sv-profile-modal-header">
          <h3>${isNew ? 'Create Profile' : 'Edit Profile'}</h3>
          <button class="sv-profile-modal-close">\u00D7</button>
        </div>
        <div class="sv-profile-modal-body">
          <div class="sv-profile-field">
            <label>Name</label>
            <input type="text" id="svProfileName" value="${_escapeHtml(editing.name)}" placeholder="e.g., Work, Personal, Dev..." maxlength="40" />
          </div>
          <div class="sv-profile-field">
            <label>Emoji</label>
            <div class="sv-profile-emoji-grid" id="svProfileEmojiGrid">
              ${PROFILE_EMOJIS.map(e =>
                `<div class="sv-profile-emoji-option${e === editing.emoji ? ' selected' : ''}" data-emoji="${e}">${e}</div>`
              ).join('')}
            </div>
          </div>
          <div class="sv-profile-field">
            <label>Color</label>
            <div class="sv-profile-color-grid" id="svProfileColorGrid">
              ${PROFILE_COLORS.map(c =>
                `<div class="sv-profile-color-swatch${c === editing.color ? ' selected' : ''}" data-color="${c}" style="background:${c}"></div>`
              ).join('')}
            </div>
          </div>
          <div class="sv-profile-field">
            <label>URL Rules (one per line, substring match or /regex/)</label>
            <textarea id="svProfileUrlRules" placeholder="github.com&#10;/^https:\\/\\/mail\\.google\\.com/">${(editing.urlRules || []).join('\n')}</textarea>
          </div>
          <div class="sv-profile-field">
            <label>Script States</label>
            <div class="sv-profile-scripts" id="svProfileScripts">
              ${scripts.map(s => {
                const checked = editing.scriptStates[s.id] !== false;
                return `
                  <div class="sv-profile-script-row">
                    <input type="checkbox" id="sv-ps-${s.id}" data-script-id="${s.id}" ${checked ? 'checked' : ''} />
                    <label for="sv-ps-${s.id}">${_escapeHtml(s.meta?.name || s.id)}</label>
                  </div>`;
              }).join('')}
              ${scripts.length === 0 ? '<div style="padding:12px;color:var(--text-muted)">No scripts installed</div>' : ''}
            </div>
          </div>
        </div>
        <div class="sv-profile-modal-footer">
          ${!isNew && editing.id !== DEFAULT_PROFILE_ID
            ? '<button class="sv-profile-btn sv-profile-btn-danger" id="svProfileDelete">Delete</button>'
            : ''}
          ${!isNew ? '<button class="sv-profile-btn" id="svProfileCompare">Compare</button>' : ''}
          <div style="flex:1"></div>
          <button class="sv-profile-btn" id="svProfileCancel">Cancel</button>
          <button class="sv-profile-btn sv-profile-btn-primary" id="svProfileSave">${isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    _modalEl = overlay;

    // Focus name input
    const nameInput = overlay.querySelector('#svProfileName');
    nameInput?.focus();

    // --- Emoji selection ---
    overlay.querySelectorAll('.sv-profile-emoji-option').forEach(opt => {
      opt.addEventListener('click', () => {
        overlay.querySelectorAll('.sv-profile-emoji-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        editing.emoji = opt.dataset.emoji;
      });
    });

    // --- Color selection ---
    overlay.querySelectorAll('.sv-profile-color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        overlay.querySelectorAll('.sv-profile-color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        editing.color = sw.dataset.color;
      });
    });

    // --- Close ---
    const closeModal = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      _modalEl = null;
    };

    overlay.querySelector('.sv-profile-modal-close').addEventListener('click', closeModal);
    overlay.querySelector('#svProfileCancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // --- Save ---
    overlay.querySelector('#svProfileSave').addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }

      editing.name = name;

      // Collect script states from checkboxes
      editing.scriptStates = {};
      overlay.querySelectorAll('#svProfileScripts input[type="checkbox"]').forEach(cb => {
        editing.scriptStates[cb.dataset.scriptId] = cb.checked;
      });

      // URL rules
      const rulesText = overlay.querySelector('#svProfileUrlRules').value;
      editing.urlRules = rulesText.split('\n').map(l => l.trim()).filter(Boolean);

      if (isNew) {
        _profiles.push(editing);
      } else {
        const idx = _profiles.findIndex(p => p.id === editing.id);
        if (idx !== -1) _profiles[idx] = editing;
      }

      await _saveProfiles();
      _renderProfileBar();
      if (_container) _createHeaderIndicator(_container.querySelector('.sv-profile-header-anchor'));
      closeModal();
    });

    // --- Delete ---
    const deleteBtn = overlay.querySelector('#svProfileDelete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete profile "${editing.name}"?`)) return;
        _profiles = _profiles.filter(p => p.id !== editing.id);
        if (_activeProfileId === editing.id) _activeProfileId = DEFAULT_PROFILE_ID;
        await _saveProfiles();
        _renderProfileBar();
        closeModal();
      });
    }

    // --- Compare ---
    const compareBtn = overlay.querySelector('#svProfileCompare');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => _openComparisonView(editing));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Comparison View                                                    */
  /* ------------------------------------------------------------------ */

  async function _openComparisonView(profile) {
    const scripts = await _getAllScripts();
    const activeProfile = _profiles.find(p => p.id === _activeProfileId) || _profiles[0];
    if (!activeProfile || !profile) return;

    const overlay = document.createElement('div');
    overlay.className = 'sv-profile-compare-overlay';

    let rows = `
      <div class="sv-compare-row header">
        <span>Script</span>
        <span>${_escapeHtml(activeProfile.name)}</span>
        <span>${_escapeHtml(profile.name)}</span>
      </div>`;

    for (const s of scripts) {
      const name = s.meta?.name || s.id;
      const stateA = activeProfile.scriptStates[s.id] !== false;
      const stateB = profile.scriptStates[s.id] !== false;
      const isDiff = stateA !== stateB;
      rows += `
        <div class="sv-compare-row${isDiff ? ' sv-compare-diff' : ''}">
          <span>${_escapeHtml(name)}</span>
          <span class="${stateA ? 'sv-compare-on' : 'sv-compare-off'}">${stateA ? 'ON' : 'OFF'}</span>
          <span class="${stateB ? 'sv-compare-on' : 'sv-compare-off'}">${stateB ? 'ON' : 'OFF'}</span>
        </div>`;
    }

    overlay.innerHTML = `
      <div class="sv-profile-compare">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:15px">Profile Comparison</h3>
          <button class="sv-profile-modal-close" id="svCompareClose">\u00D7</button>
        </div>
        ${rows}
      </div>
    `;

    document.body.appendChild(overlay);
    _comparisonEl = overlay;

    const close = () => { overlay.remove(); _comparisonEl = null; };
    overlay.querySelector('#svCompareClose').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    /**
     * Initialize the profile manager and render the profile bar.
     * @param {HTMLElement} containerEl - The container to render into
     *   (expects a child with class `.sv-profile-header-anchor` for the header indicator).
     */
    init(containerEl) {
      if (_initialized) return;
      _initialized = true;
      _container = containerEl;

      _injectStyles();

      // Create profile bar element
      _profileBar = document.createElement('div');
      _profileBar.className = 'sv-profile-bar';
      if (containerEl) {
        // Insert profile bar at the top of the container
        containerEl.insertBefore(_profileBar, containerEl.firstChild);
      }

      // Load and render
      _loadProfiles().then(() => {
        _renderProfileBar();
        _createHeaderIndicator(containerEl?.querySelector('.sv-profile-header-anchor'));
        _setupKeyboardShortcuts();
        _startUrlWatcher();
      });
    },

    /**
     * Get all profiles.
     * @returns {Promise<Array>}
     */
    async getProfiles() {
      await _loadProfiles();
      return _profiles.map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        scriptStates: { ...p.scriptStates },
        urlRules: [...(p.urlRules || [])],
        createdAt: p.createdAt
      }));
    },

    /**
     * Create a new profile.
     * @param {string} name
     * @param {{ emoji?, color?, scriptStates?, urlRules?, fromWorkspace? }} options
     * @returns {Promise<object|null>} The new profile or null if limit reached
     */
    async createProfile(name, options = {}) {
      await _loadProfiles();
      if (_profiles.length >= MAX_PROFILES) return null;

      let scriptStates = options.scriptStates || {};

      // Create from workspace if requested
      if (options.fromWorkspace) {
        try {
          const wsData = await chrome.storage.local.get('workspaces');
          const ws = (wsData.workspaces?.list || []).find(w => w.id === options.fromWorkspace);
          if (ws?.snapshot) scriptStates = { ...ws.snapshot };
        } catch (_) {}
      }

      // If no explicit scriptStates, snapshot current state
      if (Object.keys(scriptStates).length === 0) {
        const scripts = await _getAllScripts();
        for (const s of scripts) {
          scriptStates[s.id] = s.enabled !== false;
        }
      }

      const profile = {
        id: _generateId(),
        name,
        emoji: options.emoji || PROFILE_EMOJIS[_profiles.length % PROFILE_EMOJIS.length],
        color: options.color || PROFILE_COLORS[_profiles.length % PROFILE_COLORS.length],
        scriptStates,
        urlRules: options.urlRules || [],
        settingsOverrides: {},
        createdAt: Date.now()
      };

      _profiles.push(profile);
      await _saveProfiles();
      _renderProfileBar();
      return profile;
    },

    /**
     * Switch to a profile by ID.
     * @param {string} profileId
     */
    async switchProfile(profileId) {
      await _loadProfiles();
      const profile = _profiles.find(p => p.id === profileId);
      if (!profile) return { error: 'Profile not found' };
      await _applyProfile(profile);
      if (_container) _createHeaderIndicator(_container.querySelector('.sv-profile-header-anchor'));
      return { success: true, name: profile.name };
    },

    /**
     * Get the currently active profile.
     * @returns {Promise<object|null>}
     */
    async getActiveProfile() {
      await _loadProfiles();
      return _profiles.find(p => p.id === _activeProfileId) || _profiles[0] || null;
    },

    /**
     * Delete a profile.
     * @param {string} profileId
     */
    async deleteProfile(profileId) {
      if (profileId === DEFAULT_PROFILE_ID) return { error: 'Cannot delete default profile' };
      await _loadProfiles();
      const existed = _profiles.some(p => p.id === profileId);
      _profiles = _profiles.filter(p => p.id !== profileId);
      if (_activeProfileId === profileId) {
        _activeProfileId = DEFAULT_PROFILE_ID;
      }
      await _saveProfiles();
      _renderProfileBar();
      return existed ? { success: true } : { error: 'Profile not found' };
    },

    /**
     * Import a profile from JSON.
     * @param {string|object} json - JSON string or parsed object
     */
    async importProfile(json) {
      await _loadProfiles();
      if (_profiles.length >= MAX_PROFILES) return { error: 'Maximum profiles reached' };

      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data.name) return { error: 'Invalid profile data' };

      const profile = {
        id: _generateId(),
        name: data.name,
        emoji: data.emoji || PROFILE_EMOJIS[0],
        color: data.color || PROFILE_COLORS[0],
        scriptStates: data.scriptStates || {},
        urlRules: data.urlRules || [],
        settingsOverrides: data.settingsOverrides || {},
        createdAt: Date.now()
      };

      _profiles.push(profile);
      await _saveProfiles();
      _renderProfileBar();
      return { success: true, profile };
    },

    /**
     * Export a profile as a JSON-serializable object.
     * @param {string} profileId
     */
    async exportProfile(profileId) {
      await _loadProfiles();
      const profile = _profiles.find(p => p.id === profileId);
      if (!profile) return null;
      return {
        name: profile.name,
        emoji: profile.emoji,
        color: profile.color,
        scriptStates: { ...profile.scriptStates },
        urlRules: [...(profile.urlRules || [])],
        settingsOverrides: { ...(profile.settingsOverrides || {}) },
        exportedAt: Date.now()
      };
    },

    /**
     * Tear down the profile manager (remove UI, event listeners).
     */
    destroy() {
      _teardownKeyboardShortcuts();
      if (_onActivatedListener) {
        chrome.tabs.onActivated?.removeListener(_onActivatedListener);
        _onActivatedListener = null;
      }
      if (_onUpdatedListener) {
        chrome.tabs.onUpdated?.removeListener(_onUpdatedListener);
        _onUpdatedListener = null;
      }
      if (_profileBar) { _profileBar.remove(); _profileBar = null; }
      if (_modalEl) { _modalEl.remove(); _modalEl = null; }
      if (_comparisonEl) { _comparisonEl.remove(); _comparisonEl = null; }
      if (_styleEl) { _styleEl.remove(); _styleEl = null; }
      _initialized = false;
      _container = null;
      _profiles = [];
      _activeProfileId = null;
    }
  };

  return api;
})();
