// ScriptVault — Script Chaining & Event Triggers
// Visual chain builder for sequential script execution with triggers,
// conditions, drag-and-drop reordering, and execution logging.

const ScriptChains = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_chains';
  const LOG_KEY = 'sv_chain_logs';
  const MAX_LOG_ENTRIES = 500;
  const MAX_DELAY = 10000; // 10s

  const TRIGGER_TYPES = {
    manual:       { label: 'Manual',       icon: '&#9654;' },
    url:          { label: 'URL Match',    icon: '&#128279;' },
    schedule:     { label: 'Schedule',     icon: '&#128339;' },
    event:        { label: 'DOM Event',    icon: '&#9889;' },
    afterScript:  { label: 'After Script', icon: '&#8627;' },
  };

  const CONDITION_TYPES = {
    always:    'Always',
    success:   'On Success',
    failure:   'On Failure',
  };

  const ERROR_MODES = {
    stop:  'Stop on Error',
    skip:  'Skip on Error',
    retry: 'Retry (max 3)',
  };

  const BUILTIN_CHAINS = [
    {
      id: '__builtin_privacy_sweep',
      name: 'Privacy Sweep',
      builtin: true,
      trigger: { type: 'manual' },
      errorMode: 'skip',
      steps: [
        { label: 'Disable Trackers', scriptId: null, placeholder: 'tracker-blocker', condition: 'always', delay: 0 },
        { label: 'Clear Cookies', scriptId: null, placeholder: 'cookie-cleaner', condition: 'success', delay: 500 },
        { label: 'Enable HTTPS Everywhere', scriptId: null, placeholder: 'https-enforcer', condition: 'success', delay: 0 },
      ],
    },
    {
      id: '__builtin_dev_setup',
      name: 'Dev Setup',
      builtin: true,
      trigger: { type: 'manual' },
      errorMode: 'stop',
      steps: [
        { label: 'Console Logger', scriptId: null, placeholder: 'console-logger', condition: 'always', delay: 0 },
        { label: 'Network Monitor', scriptId: null, placeholder: 'network-monitor', condition: 'success', delay: 200 },
        { label: 'Debugger', scriptId: null, placeholder: 'debugger-helper', condition: 'success', delay: 200 },
      ],
    },
  ];

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _chains = {};          // { chainId: chainDef }
  let _logs = [];            // execution log entries
  let _containerEl = null;
  let _styleEl = null;
  let _initialized = false;
  let _dragState = null;     // drag-and-drop tracking
  let _availableScripts = [];

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Chain Builder Overlay & Container */
.sv-chains-panel {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
}
.sv-chains-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.sv-chains-header h3 {
  color: var(--text-primary, #e0e0e0);
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sv-chains-header h3 .icon {
  font-size: 18px;
}
.sv-chains-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333333);
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s, border-color 0.15s;
}
.sv-chains-btn:hover {
  background: var(--bg-row-hover, #333333);
  border-color: var(--accent-green, #4ade80);
}
.sv-chains-btn.primary {
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  border-color: var(--accent-green-dark, #22c55e);
}
.sv-chains-btn.primary:hover {
  background: var(--accent-green, #4ade80);
}
.sv-chains-btn.danger {
  border-color: var(--accent-red, #f87171);
  color: var(--accent-red, #f87171);
}
.sv-chains-btn.danger:hover {
  background: rgba(248, 113, 113, 0.15);
}

/* Chain list */
.sv-chains-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sv-chain-card {
  background: var(--bg-body, #1a1a1a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.15s;
}
.sv-chain-card:hover {
  border-color: var(--accent-blue, #60a5fa);
}
.sv-chain-card .chain-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.sv-chain-card .chain-name {
  color: var(--text-primary, #e0e0e0);
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-chain-card .chain-meta {
  color: var(--text-secondary, #a0a0a0);
  font-size: 12px;
}
.sv-chain-card .chain-trigger-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(96, 165, 250, 0.15);
  color: var(--accent-blue, #60a5fa);
  font-size: 11px;
}
.sv-chain-card .chain-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* Chain editor modal */
.sv-chain-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.sv-chain-editor-overlay.visible { opacity: 1; }

.sv-chain-editor {
  background: var(--bg-header, #252525);
  border: 1px solid var(--border-color, #404040);
  border-radius: 10px;
  width: 680px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  transform: translateY(10px);
  transition: transform 0.2s ease;
}
.sv-chain-editor-overlay.visible .sv-chain-editor {
  transform: translateY(0);
}

.sv-chain-editor-top {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #404040);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sv-chain-editor-top h3 {
  color: var(--text-primary, #e0e0e0);
  font-size: 15px;
}
.sv-chain-editor-close {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0a0);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.sv-chain-editor-close:hover {
  color: var(--text-primary, #e0e0e0);
  background: var(--bg-row-hover, #333333);
}

.sv-chain-editor-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* Form fields */
.sv-chain-field {
  margin-bottom: 14px;
}
.sv-chain-field label {
  display: block;
  color: var(--text-secondary, #a0a0a0);
  font-size: 12px;
  margin-bottom: 5px;
}
.sv-chain-field input,
.sv-chain-field select {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-input, #333333);
  border: 1px solid var(--border-color, #404040);
  border-radius: 5px;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.sv-chain-field input:focus,
.sv-chain-field select:focus {
  border-color: var(--accent-green, #4ade80);
}

/* Pipeline / Steps */
.sv-chain-pipeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 16px 0;
}

.sv-chain-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  position: relative;
  cursor: grab;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.sv-chain-step:active { cursor: grabbing; }
.sv-chain-step.dragging {
  opacity: 0.5;
  border-color: var(--accent-green, #4ade80);
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.2);
}
.sv-chain-step.drag-over {
  border-color: var(--accent-blue, #60a5fa);
  background: var(--bg-row-selected, #2d3a4d);
}
.sv-chain-step .step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.sv-chain-step .step-body {
  flex: 1;
  min-width: 0;
}
.sv-chain-step .step-body select {
  width: 100%;
  padding: 5px 8px;
  background: var(--bg-input, #333333);
  border: 1px solid var(--border-color, #404040);
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
}
.sv-chain-step .step-controls {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}
.sv-chain-step .step-controls select {
  padding: 4px 6px;
  background: var(--bg-input, #333333);
  border: 1px solid var(--border-color, #404040);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0a0);
  font-size: 11px;
}
.sv-chain-step .step-controls input[type="number"] {
  width: 55px;
  padding: 4px 6px;
  background: var(--bg-input, #333333);
  border: 1px solid var(--border-color, #404040);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0a0);
  font-size: 11px;
}
.sv-chain-step .step-remove {
  background: none;
  border: none;
  color: var(--text-muted, #707070);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
}
.sv-chain-step .step-remove:hover {
  color: var(--accent-red, #f87171);
  background: rgba(248, 113, 113, 0.1);
}

/* Arrow connector between steps */
.sv-chain-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0;
  color: var(--text-muted, #707070);
  font-size: 14px;
  user-select: none;
}
.sv-chain-arrow .condition-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 6px;
}
.sv-chain-arrow .condition-badge.success {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent-green, #4ade80);
}
.sv-chain-arrow .condition-badge.failure {
  background: rgba(248, 113, 113, 0.15);
  color: var(--accent-red, #f87171);
}
.sv-chain-arrow .condition-badge.always {
  background: rgba(160, 160, 160, 0.1);
  color: var(--text-secondary, #a0a0a0);
}

/* Editor footer */
.sv-chain-editor-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #404040);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Execution log */
.sv-chain-log {
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  background: var(--bg-body, #1a1a1a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  padding: 8px 12px;
}
.sv-chain-log-entry {
  padding: 2px 0;
  display: flex;
  gap: 8px;
}
.sv-chain-log-entry .log-time {
  color: var(--text-muted, #707070);
  flex-shrink: 0;
}
.sv-chain-log-entry .log-msg { color: var(--text-secondary, #a0a0a0); }
.sv-chain-log-entry.success .log-msg { color: var(--accent-green, #4ade80); }
.sv-chain-log-entry.error .log-msg { color: var(--accent-red, #f87171); }
.sv-chain-log-entry.info .log-msg { color: var(--accent-blue, #60a5fa); }
.sv-chain-log-entry.warn .log-msg { color: var(--accent-yellow, #fbbf24); }

/* Empty state */
.sv-chains-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted, #707070);
  font-size: 13px;
}
.sv-chains-empty .empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Storage helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function _loadState() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, LOG_KEY]);
      _chains = data[STORAGE_KEY] || {};
      _logs = data[LOG_KEY] || [];
    } catch (e) {
      console.error('[ScriptChains] Failed to load state:', e);
      _chains = {};
      _logs = [];
    }
  }

  async function _saveChains() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _chains });
    } catch (e) {
      console.error('[ScriptChains] Failed to save chains:', e);
    }
  }

  async function _saveLog() {
    try {
      if (_logs.length > MAX_LOG_ENTRIES) {
        _logs = _logs.slice(-MAX_LOG_ENTRIES);
      }
      await chrome.storage.local.set({ [LOG_KEY]: _logs });
    } catch (e) {
      console.error('[ScriptChains] Failed to save log:', e);
    }
  }

  function _addLog(chainId, level, message) {
    const entry = {
      chainId,
      level,
      message,
      timestamp: Date.now(),
    };
    _logs.push(entry);
    _saveLog();
    _renderLogEntry(entry);
  }

  /* ------------------------------------------------------------------ */
  /*  Fetch available scripts for dropdowns                              */
  /* ------------------------------------------------------------------ */

  async function _loadAvailableScripts() {
    try {
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      _availableScripts = Object.entries(scripts).map(([id, s]) => ({
        id,
        name: (s.meta && s.meta.name) || s.name || id,
      }));
      _availableScripts.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      _availableScripts = [];
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Chain CRUD                                                         */
  /* ------------------------------------------------------------------ */

  async function createChain(name, steps) {
    if (!_initialized) await _init();

    const id = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const chain = {
      id,
      name: name || 'New Chain',
      trigger: { type: 'manual' },
      errorMode: 'stop',
      steps: (steps || []).map((s, i) => ({
        scriptId: s.scriptId || null,
        label: s.label || `Step ${i + 1}`,
        condition: s.condition || 'always',
        delay: Math.min(Math.max(s.delay || 0, 0), MAX_DELAY),
      })),
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    _chains[id] = chain;
    await _saveChains();
    _renderChainList();
    return id;
  }

  function getChains() {
    return { ..._chains };
  }

  async function deleteChain(chainId) {
    if (!_initialized) await _init();
    if (_chains[chainId]?.builtin) return; // cannot delete builtins

    delete _chains[chainId];
    await _saveChains();
    _renderChainList();
  }

  async function _updateChain(chainId, updates) {
    if (!_chains[chainId]) return;
    Object.assign(_chains[chainId], updates, { updatedAt: Date.now() });
    await _saveChains();
  }

  /* ------------------------------------------------------------------ */
  /*  Chain execution engine                                             */
  /* ------------------------------------------------------------------ */

  async function executeChain(chainId) {
    if (!_initialized) await _init();

    const chain = _chains[chainId];
    if (!chain) {
      console.error('[ScriptChains] Chain not found:', chainId);
      return { success: false, error: 'Chain not found' };
    }

    _addLog(chainId, 'info', `Starting chain: ${chain.name}`);

    let lastResult = { success: true, data: null };

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];

      // Check condition against previous step
      if (i > 0) {
        if (step.condition === 'success' && !lastResult.success) {
          _addLog(chainId, 'warn', `Skipping step ${i + 1} (${step.label}): previous step failed`);
          continue;
        }
        if (step.condition === 'failure' && lastResult.success) {
          _addLog(chainId, 'warn', `Skipping step ${i + 1} (${step.label}): previous step succeeded`);
          continue;
        }
      }

      // Apply delay
      if (step.delay > 0) {
        _addLog(chainId, 'info', `Waiting ${step.delay}ms before step ${i + 1}...`);
        await _delay(step.delay);
      }

      // Execute the step
      _addLog(chainId, 'info', `Executing step ${i + 1}: ${step.label}`);

      let retries = chain.errorMode === 'retry' ? 3 : 1;
      let executed = false;

      while (retries > 0 && !executed) {
        try {
          lastResult = await _executeStep(step);
          executed = true;

          if (lastResult.success) {
            _addLog(chainId, 'success', `Step ${i + 1} completed successfully`);
          } else {
            _addLog(chainId, 'error', `Step ${i + 1} failed: ${lastResult.error || 'unknown error'}`);
          }
        } catch (e) {
          retries--;
          lastResult = { success: false, error: e.message };

          if (retries > 0 && chain.errorMode === 'retry') {
            _addLog(chainId, 'warn', `Step ${i + 1} failed, retrying (${retries} left)...`);
            await _delay(1000);
          } else {
            _addLog(chainId, 'error', `Step ${i + 1} error: ${e.message}`);
            executed = true;
          }
        }
      }

      // Handle error modes
      if (!lastResult.success && chain.errorMode === 'stop') {
        _addLog(chainId, 'error', `Chain stopped due to error at step ${i + 1}`);
        return { success: false, stoppedAt: i, error: lastResult.error };
      }
    }

    _addLog(chainId, 'success', `Chain "${chain.name}" completed`);
    return { success: true };
  }

  async function _executeStep(step) {
    if (!step.scriptId) {
      return { success: false, error: 'No script assigned to step' };
    }

    // Send execution request to background via message passing
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Script execution timed out (30s)' });
      }, 30000);

      chrome.runtime.sendMessage(
        { type: 'SV_EXECUTE_SCRIPT', scriptId: step.scriptId },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: true });
          }
        }
      );
    });
  }

  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ------------------------------------------------------------------ */
  /*  UI — Styles                                                        */
  /* ------------------------------------------------------------------ */

  function _injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function _removeStyles() {
    if (_styleEl) {
      _styleEl.remove();
      _styleEl = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  UI — Main panel                                                    */
  /* ------------------------------------------------------------------ */

  function _renderPanel() {
    if (!_containerEl) return;
    _containerEl.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'sv-chains-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'sv-chains-header';
    header.innerHTML = `
      <h3><span class="icon">&#9918;</span> Script Chains</h3>
    `;
    const addBtn = document.createElement('button');
    addBtn.className = 'sv-chains-btn primary';
    addBtn.textContent = '+ New Chain';
    addBtn.addEventListener('click', () => _openEditor(null));
    header.appendChild(addBtn);
    panel.appendChild(header);

    // Chain list container
    const listEl = document.createElement('div');
    listEl.className = 'sv-chains-list';
    listEl.id = 'sv-chains-list';
    panel.appendChild(listEl);

    _containerEl.appendChild(panel);
    _renderChainList();
  }

  function _renderChainList() {
    const listEl = document.getElementById('sv-chains-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const allChains = Object.values(_chains);
    if (allChains.length === 0) {
      listEl.innerHTML = `
        <div class="sv-chains-empty">
          <div class="empty-icon">&#9918;</div>
          No chains defined yet. Create one to automate script execution.
        </div>
      `;
      return;
    }

    // Sort: builtins first, then by name
    allChains.sort((a, b) => {
      if (a.builtin && !b.builtin) return -1;
      if (!a.builtin && b.builtin) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    for (const chain of allChains) {
      const card = document.createElement('div');
      card.className = 'sv-chain-card';
      card.dataset.chainId = chain.id;

      const triggerInfo = TRIGGER_TYPES[chain.trigger?.type] || TRIGGER_TYPES.manual;

      card.innerHTML = `
        <div class="chain-info">
          <div>
            <div class="chain-name">${_esc(chain.name)}</div>
            <div class="chain-meta">${chain.steps?.length || 0} step(s)${chain.builtin ? ' &middot; Built-in' : ''}</div>
          </div>
          <span class="chain-trigger-badge">${triggerInfo.icon} ${triggerInfo.label}</span>
        </div>
        <div class="chain-actions"></div>
      `;

      const actions = card.querySelector('.chain-actions');

      // Run button
      const runBtn = document.createElement('button');
      runBtn.className = 'sv-chains-btn';
      runBtn.textContent = 'Run';
      runBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        executeChain(chain.id);
      });
      actions.appendChild(runBtn);

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'sv-chains-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _openEditor(chain.id);
      });
      actions.appendChild(editBtn);

      // Delete button (not for builtins)
      if (!chain.builtin) {
        const delBtn = document.createElement('button');
        delBtn.className = 'sv-chains-btn danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete chain "${chain.name}"?`)) {
            deleteChain(chain.id);
          }
        });
        actions.appendChild(delBtn);
      }

      listEl.appendChild(card);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  UI — Chain editor modal                                            */
  /* ------------------------------------------------------------------ */

  function _openEditor(chainId) {
    const chain = chainId ? { ..._chains[chainId], steps: [...(_chains[chainId]?.steps || [])] } : {
      id: null,
      name: '',
      trigger: { type: 'manual', value: '' },
      errorMode: 'stop',
      steps: [],
    };

    const overlay = document.createElement('div');
    overlay.className = 'sv-chain-editor-overlay';
    overlay.innerHTML = `
      <div class="sv-chain-editor">
        <div class="sv-chain-editor-top">
          <h3>${chainId ? 'Edit Chain' : 'New Chain'}</h3>
          <button class="sv-chain-editor-close">&times;</button>
        </div>
        <div class="sv-chain-editor-body">
          <div class="sv-chain-field">
            <label>Chain Name</label>
            <input type="text" id="sv-chain-name" value="${_esc(chain.name)}" placeholder="My Automation Chain" />
          </div>
          <div class="sv-chain-field" style="display:flex;gap:12px;">
            <div style="flex:1;">
              <label>Trigger Type</label>
              <select id="sv-chain-trigger-type">
                ${Object.entries(TRIGGER_TYPES).map(([k, v]) =>
                  `<option value="${k}" ${chain.trigger?.type === k ? 'selected' : ''}>${v.label}</option>`
                ).join('')}
              </select>
            </div>
            <div style="flex:1;">
              <label>Trigger Value</label>
              <input type="text" id="sv-chain-trigger-value" value="${_esc(chain.trigger?.value || '')}" placeholder="URL pattern, cron, event name..." />
            </div>
          </div>
          <div class="sv-chain-field">
            <label>Error Handling</label>
            <select id="sv-chain-error-mode">
              ${Object.entries(ERROR_MODES).map(([k, v]) =>
                `<option value="${k}" ${chain.errorMode === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label style="color:var(--text-secondary,#a0a0a0);font-size:12px;">Pipeline Steps</label>
            <button class="sv-chains-btn" id="sv-chain-add-step">+ Add Step</button>
          </div>
          <div class="sv-chain-pipeline" id="sv-chain-pipeline"></div>
          <div>
            <label style="color:var(--text-secondary,#a0a0a0);font-size:12px;">Execution Log</label>
            <div class="sv-chain-log" id="sv-chain-log"></div>
          </div>
        </div>
        <div class="sv-chain-editor-footer">
          <button class="sv-chains-btn" id="sv-chain-cancel">Cancel</button>
          <button class="sv-chains-btn primary" id="sv-chain-save">Save Chain</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Populate pipeline
    const pipelineEl = overlay.querySelector('#sv-chain-pipeline');
    _renderPipeline(pipelineEl, chain.steps);

    // Populate log for this chain
    const logEl = overlay.querySelector('#sv-chain-log');
    if (chainId) {
      const chainLogs = _logs.filter(l => l.chainId === chainId).slice(-50);
      for (const entry of chainLogs) {
        _renderLogEntryTo(logEl, entry);
      }
    }

    // Events
    overlay.querySelector('.sv-chain-editor-close').addEventListener('click', () => _closeEditor(overlay));
    overlay.querySelector('#sv-chain-cancel').addEventListener('click', () => _closeEditor(overlay));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeEditor(overlay);
    });

    overlay.querySelector('#sv-chain-add-step').addEventListener('click', () => {
      chain.steps.push({ scriptId: null, label: `Step ${chain.steps.length + 1}`, condition: 'always', delay: 0 });
      _renderPipeline(pipelineEl, chain.steps);
    });

    overlay.querySelector('#sv-chain-save').addEventListener('click', async () => {
      const name = overlay.querySelector('#sv-chain-name').value.trim() || 'Unnamed Chain';
      const triggerType = overlay.querySelector('#sv-chain-trigger-type').value;
      const triggerValue = overlay.querySelector('#sv-chain-trigger-value').value.trim();
      const errorMode = overlay.querySelector('#sv-chain-error-mode').value;

      // Read steps from pipeline DOM
      const stepEls = pipelineEl.querySelectorAll('.sv-chain-step');
      const steps = [];
      stepEls.forEach((el, i) => {
        const scriptSelect = el.querySelector('.step-script-select');
        const condSelect = el.querySelector('.step-condition-select');
        const delayInput = el.querySelector('.step-delay-input');
        steps.push({
          scriptId: scriptSelect?.value || null,
          label: scriptSelect?.selectedOptions?.[0]?.textContent || `Step ${i + 1}`,
          condition: condSelect?.value || 'always',
          delay: Math.min(Math.max(parseInt(delayInput?.value, 10) || 0, 0), MAX_DELAY),
        });
      });

      if (chainId) {
        await _updateChain(chainId, { name, trigger: { type: triggerType, value: triggerValue }, errorMode, steps });
      } else {
        const newId = await createChain(name, steps);
        await _updateChain(newId, { trigger: { type: triggerType, value: triggerValue }, errorMode });
      }

      _closeEditor(overlay);
      _renderChainList();
    });
  }

  function _closeEditor(overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }

  /* ------------------------------------------------------------------ */
  /*  UI — Pipeline renderer with drag-and-drop                          */
  /* ------------------------------------------------------------------ */

  function _renderPipeline(containerEl, steps) {
    containerEl.innerHTML = '';

    if (steps.length === 0) {
      containerEl.innerHTML = '<div style="color:var(--text-muted,#707070);font-size:12px;text-align:center;padding:16px;">No steps. Click "+ Add Step" to begin.</div>';
      return;
    }

    steps.forEach((step, idx) => {
      // Arrow connector (before each step except the first)
      if (idx > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'sv-chain-arrow';
        const condClass = step.condition || 'always';
        arrow.innerHTML = `&#8595; <span class="condition-badge ${condClass}">${CONDITION_TYPES[condClass] || 'Always'}</span>`;
        containerEl.appendChild(arrow);
      }

      const stepEl = document.createElement('div');
      stepEl.className = 'sv-chain-step';
      stepEl.draggable = true;
      stepEl.dataset.index = idx;

      // Step number
      const numEl = document.createElement('div');
      numEl.className = 'step-num';
      numEl.textContent = idx + 1;
      stepEl.appendChild(numEl);

      // Script selector
      const bodyEl = document.createElement('div');
      bodyEl.className = 'step-body';
      const scriptSelect = document.createElement('select');
      scriptSelect.className = 'step-script-select';
      scriptSelect.innerHTML = `<option value="">-- Select Script --</option>`;
      for (const s of _availableScripts) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (s.id === step.scriptId) opt.selected = true;
        scriptSelect.appendChild(opt);
      }
      bodyEl.appendChild(scriptSelect);
      stepEl.appendChild(bodyEl);

      // Controls: condition, delay, remove
      const ctrlEl = document.createElement('div');
      ctrlEl.className = 'step-controls';

      if (idx > 0) {
        const condSelect = document.createElement('select');
        condSelect.className = 'step-condition-select';
        for (const [k, v] of Object.entries(CONDITION_TYPES)) {
          const opt = document.createElement('option');
          opt.value = k;
          opt.textContent = v;
          if (k === step.condition) opt.selected = true;
          condSelect.appendChild(opt);
        }
        condSelect.addEventListener('change', () => {
          step.condition = condSelect.value;
          // Update arrow badge
          const arrows = containerEl.querySelectorAll('.sv-chain-arrow');
          if (arrows[idx - 1]) {
            const badge = arrows[idx - 1].querySelector('.condition-badge');
            if (badge) {
              badge.className = `condition-badge ${condSelect.value}`;
              badge.textContent = CONDITION_TYPES[condSelect.value] || 'Always';
            }
          }
        });
        ctrlEl.appendChild(condSelect);
      }

      const delayInput = document.createElement('input');
      delayInput.type = 'number';
      delayInput.className = 'step-delay-input';
      delayInput.min = 0;
      delayInput.max = MAX_DELAY;
      delayInput.value = step.delay || 0;
      delayInput.title = 'Delay (ms)';
      delayInput.placeholder = 'ms';
      ctrlEl.appendChild(delayInput);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'step-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove step';
      removeBtn.addEventListener('click', () => {
        steps.splice(idx, 1);
        _renderPipeline(containerEl, steps);
      });
      ctrlEl.appendChild(removeBtn);

      stepEl.appendChild(ctrlEl);

      // Drag events
      stepEl.addEventListener('dragstart', (e) => {
        _dragState = { index: idx, steps, containerEl };
        stepEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });

      stepEl.addEventListener('dragend', () => {
        stepEl.classList.remove('dragging');
        _dragState = null;
        containerEl.querySelectorAll('.sv-chain-step').forEach(el => el.classList.remove('drag-over'));
      });

      stepEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        stepEl.classList.add('drag-over');
      });

      stepEl.addEventListener('dragleave', () => {
        stepEl.classList.remove('drag-over');
      });

      stepEl.addEventListener('drop', (e) => {
        e.preventDefault();
        stepEl.classList.remove('drag-over');

        if (!_dragState) return;
        const fromIdx = _dragState.index;
        const toIdx = idx;
        if (fromIdx === toIdx) return;

        // Reorder
        const [moved] = steps.splice(fromIdx, 1);
        steps.splice(toIdx, 0, moved);
        _renderPipeline(containerEl, steps);
      });

      containerEl.appendChild(stepEl);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  UI — Log rendering                                                 */
  /* ------------------------------------------------------------------ */

  function _renderLogEntry(entry) {
    const logEl = document.querySelector('#sv-chain-log');
    if (!logEl) return;
    _renderLogEntryTo(logEl, entry);
  }

  function _renderLogEntryTo(logEl, entry) {
    const el = document.createElement('div');
    el.className = `sv-chain-log-entry ${entry.level}`;
    const time = new Date(entry.timestamp).toLocaleTimeString();
    el.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${_esc(entry.message)}</span>`;
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /*  Initialization & teardown                                          */
  /* ------------------------------------------------------------------ */

  async function _init() {
    if (_initialized) return;
    await _loadState();

    // Ensure builtins exist
    for (const builtin of BUILTIN_CHAINS) {
      if (!_chains[builtin.id]) {
        _chains[builtin.id] = { ...builtin };
      }
    }
    await _saveChains();

    await _loadAvailableScripts();
    _initialized = true;
  }

  async function init(containerEl) {
    _containerEl = containerEl;
    _injectStyles();
    await _init();
    _renderPanel();
  }

  function destroy() {
    _removeStyles();
    if (_containerEl) {
      _containerEl.innerHTML = '';
      _containerEl = null;
    }
    _chains = {};
    _logs = [];
    _dragState = null;
    _availableScripts = [];
    _initialized = false;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    init,
    createChain,
    executeChain,
    getChains,
    deleteChain,
    destroy,
  };
})();
