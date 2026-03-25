// ScriptVault — AI Assistant Module
// Provides AI-powered features: script generation, code explanation,
// security review, and fix suggestions via configurable API endpoints.
// Users supply their own API key; no bundled AI SDK required.

const AIAssistant = (() => {
  'use strict';

  // ── Internal State ──────────────────────────────────────────────────────────
  const _state = {
    config: null,
    containerEl: null,
    styleEl: null,
    panelEl: null,
    abortController: null,
    requestQueue: [],
    processing: false,
    rateLimitDelay: 500,
    lastRequestTime: 0,
    conversationHistory: [],
  };

  // Default configuration
  const DEFAULT_CONFIG = {
    provider: 'openai',
    apiKey: '',
    encryptedApiKey: null,
    model: '',
    endpoint: '',
    maxTokens: 2048,
    temperature: 0.7,
    ollamaUrl: 'http://localhost:11434',
  };

  // Provider presets
  const PROVIDERS = {
    openai: {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4o-mini',
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    },
    anthropic: {
      name: 'Anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-3-5-sonnet-20241022'],
      defaultModel: 'claude-sonnet-4-20250514',
      authHeader: (key) => ({
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      }),
    },
    ollama: {
      name: 'Ollama (Local)',
      endpoint: 'http://localhost:11434/api/chat',
      models: [],
      defaultModel: 'llama3',
      authHeader: () => ({}),
    },
    custom: {
      name: 'Custom Endpoint',
      endpoint: '',
      models: [],
      defaultModel: '',
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    },
  };

  // ── Encryption Helpers (AES-GCM with user passphrase) ────────────────────
  async function _deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function _encryptApiKey(apiKey, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await _deriveKey(passphrase, salt);
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(apiKey)
    );
    return {
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext)),
    };
  }

  async function _decryptApiKey(encrypted, passphrase) {
    try {
      const salt = new Uint8Array(encrypted.salt);
      const iv = new Uint8Array(encrypted.iv);
      const data = new Uint8Array(encrypted.data);
      const key = await _deriveKey(passphrase, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, key, data
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      throw new Error('Failed to decrypt API key — incorrect passphrase');
    }
  }

  // ── API Abstraction Layer ────────────────────────────────────────────────
  function _getEndpoint() {
    const cfg = _state.config;
    if (cfg.provider === 'custom' && cfg.endpoint) return cfg.endpoint;
    if (cfg.provider === 'ollama') return (cfg.ollamaUrl || 'http://localhost:11434') + '/api/chat';
    return PROVIDERS[cfg.provider]?.endpoint || '';
  }

  function _getHeaders() {
    const cfg = _state.config;
    const provider = PROVIDERS[cfg.provider];
    const headers = { 'Content-Type': 'application/json' };
    if (provider?.authHeader && cfg.apiKey) {
      Object.assign(headers, provider.authHeader(cfg.apiKey));
    }
    return headers;
  }

  function _buildRequestBody(messages, stream = false) {
    const cfg = _state.config;
    const model = cfg.model || PROVIDERS[cfg.provider]?.defaultModel || '';

    if (cfg.provider === 'anthropic') {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const filtered = messages.filter((m) => m.role !== 'system');
      return {
        model,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        system,
        messages: filtered,
        stream,
      };
    }

    if (cfg.provider === 'ollama') {
      return {
        model,
        messages,
        stream,
        options: { temperature: cfg.temperature, num_predict: cfg.maxTokens },
      };
    }

    // OpenAI-compatible (default)
    return {
      model,
      messages,
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      stream,
    };
  }

  function _parseResponse(data) {
    const cfg = _state.config;
    if (cfg.provider === 'anthropic') {
      return data.content?.[0]?.text || '';
    }
    if (cfg.provider === 'ollama') {
      return data.message?.content || '';
    }
    return data.choices?.[0]?.message?.content || '';
  }

  // Rate-limited request queue
  async function _processQueue() {
    if (_state.processing || _state.requestQueue.length === 0) return;
    _state.processing = true;

    while (_state.requestQueue.length > 0) {
      const elapsed = Date.now() - _state.lastRequestTime;
      if (elapsed < _state.rateLimitDelay) {
        await new Promise((r) => setTimeout(r, _state.rateLimitDelay - elapsed));
      }

      const { messages, resolve, reject, stream, onChunk } = _state.requestQueue.shift();
      _state.lastRequestTime = Date.now();

      try {
        const result = await _makeRequest(messages, stream, onChunk);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }

    _state.processing = false;
  }

  function _enqueueRequest(messages, stream = false, onChunk = null) {
    return new Promise((resolve, reject) => {
      _state.requestQueue.push({ messages, resolve, reject, stream, onChunk });
      _processQueue();
    });
  }

  async function _makeRequest(messages, stream = false, onChunk = null) {
    const endpoint = _getEndpoint();
    if (!endpoint) throw new Error('No API endpoint configured');

    _state.abortController = new AbortController();
    const body = _buildRequestBody(messages, stream);
    const headers = _getHeaders();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: _state.abortController.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let errorMsg = `API error ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.error?.message || parsed.error?.type || errorMsg;
      } catch { /* use default */ }
      throw new Error(errorMsg);
    }

    if (stream && response.body) {
      return _handleStream(response, onChunk);
    }

    const data = await response.json();
    return _parseResponse(data);
  }

  async function _handleStream(response, onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
          try {
            const parsed = JSON.parse(jsonStr);
            let chunk = '';

            if (_state.config.provider === 'anthropic') {
              if (parsed.type === 'content_block_delta') {
                chunk = parsed.delta?.text || '';
              }
            } else if (_state.config.provider === 'ollama') {
              chunk = parsed.message?.content || '';
            } else {
              chunk = parsed.choices?.[0]?.delta?.content || '';
            }

            if (chunk) {
              fullText += chunk;
              if (onChunk) onChunk(chunk, fullText);
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  // ── System Prompts ──────────────────────────────────────────────────────
  const PROMPTS = {
    generateScript: (description) => [
      {
        role: 'system',
        content: `You are a userscript developer. Generate valid Tampermonkey/Greasemonkey-compatible userscripts.
Always include a complete ==UserScript== metadata block with @name, @namespace, @version, @description, @author, @match, @grant, and @run-at.
Use modern JavaScript. Include error handling. Add helpful comments.
Return ONLY the complete script code, no explanation before or after.
Wrap the main logic in an IIFE or use 'use strict'.`,
      },
      { role: 'user', content: `Create a userscript that does the following:\n\n${description}` },
    ],

    explainCode: (code, selection) => [
      {
        role: 'system',
        content: `You are a JavaScript expert. Explain code clearly and concisely for developers of varying skill levels.
Break down complex logic. Note any potential issues or anti-patterns.
Format your response with clear sections using markdown-style headers.`,
      },
      {
        role: 'user',
        content: selection
          ? `Explain this selected code:\n\n\`\`\`javascript\n${selection}\n\`\`\`\n\nFull script context:\n\`\`\`javascript\n${code}\n\`\`\``
          : `Explain this entire script:\n\n\`\`\`javascript\n${code}\n\`\`\``,
      },
    ],

    securityReview: (code) => [
      {
        role: 'system',
        content: `You are a security auditor specializing in browser extensions and userscripts.
Analyze the provided code for security issues. Look for:
- Data exfiltration (sending user data to external servers)
- Privacy violations (tracking, fingerprinting, cookie theft)
- Obfuscated payloads (encoded strings hiding malicious intent)
- Suspicious network calls (unexpected fetch/XHR/WebSocket usage)
- DOM manipulation risks (XSS, clickjacking)
- Credential harvesting
- Cryptomining indicators

Return your analysis as valid JSON with this exact structure:
{
  "overallRisk": "low|medium|high|critical",
  "score": <0-100 where 100 is safest>,
  "findings": [
    {
      "severity": "info|low|medium|high|critical",
      "category": "string",
      "title": "string",
      "description": "string",
      "line": <number or null>,
      "recommendation": "string"
    }
  ],
  "summary": "string"
}

Return ONLY the JSON, no markdown fences or extra text.`,
      },
      { role: 'user', content: `Analyze this userscript for security issues:\n\n${code}` },
    ],

    suggestFix: (code, error) => [
      {
        role: 'system',
        content: `You are a JavaScript debugging expert. Given a script and an error, provide a targeted fix.
Return your response as valid JSON with this exact structure:
{
  "diagnosis": "string explaining the root cause",
  "fix": "the complete corrected code",
  "explanation": "string explaining what was changed and why",
  "confidence": "low|medium|high"
}

Return ONLY the JSON, no markdown fences or extra text.`,
      },
      {
        role: 'user',
        content: `This userscript has an error. Please diagnose and fix it.\n\nError: ${error}\n\nScript:\n\`\`\`javascript\n${code}\n\`\`\``,
      },
    ],
  };

  // ── CSS Injection ──────────────────────────────────────────────────────
  function _injectStyles() {
    if (_state.styleEl) return;
    _state.styleEl = document.createElement('style');
    _state.styleEl.id = 'sv-ai-styles';
    _state.styleEl.textContent = `
/* ScriptVault AI Assistant Styles */
.sv-ai-panel {
  position: fixed;
  top: 0;
  right: -480px;
  width: 480px;
  height: 100vh;
  background: var(--bg-content, #242424);
  border-left: 1px solid var(--border-color, #444);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -4px 0 24px rgba(0,0,0,0.4);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
}
.sv-ai-panel.sv-ai-open {
  right: 0;
}
.sv-ai-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3);
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}
.sv-ai-backdrop.sv-ai-visible {
  opacity: 1;
  pointer-events: auto;
}

/* Header */
.sv-ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color, #444);
  background: var(--bg-section-header, #2a2a2a);
  flex-shrink: 0;
}
.sv-ai-header h3 {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sv-ai-header h3 svg {
  width: 18px;
  height: 18px;
  color: var(--accent-primary, #22c55e);
}
.sv-ai-header-actions {
  display: flex;
  gap: 6px;
}
.sv-ai-icon-btn {
  background: none;
  border: 1px solid var(--border-color, #444);
  color: var(--text-secondary, #a0a0a0);
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.sv-ai-icon-btn:hover {
  background: var(--bg-button-hover, #444);
  color: var(--text-primary, #e0e0e0);
}
.sv-ai-icon-btn.sv-ai-active {
  border-color: var(--accent-primary, #22c55e);
  color: var(--accent-primary, #22c55e);
}

/* Tab Navigation */
.sv-ai-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color, #444);
  background: var(--bg-section-header, #2a2a2a);
  flex-shrink: 0;
  overflow-x: auto;
}
.sv-ai-tab {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: all 0.15s;
}
.sv-ai-tab:hover {
  color: var(--text-primary, #e0e0e0);
  background: var(--bg-button, #333);
}
.sv-ai-tab.sv-ai-tab-active {
  color: var(--accent-primary, #22c55e);
  border-bottom-color: var(--accent-primary, #22c55e);
}

/* Content area */
.sv-ai-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.sv-ai-content::-webkit-scrollbar { width: 6px; }
.sv-ai-content::-webkit-scrollbar-track { background: transparent; }
.sv-ai-content::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, rgba(255,255,255,0.15));
  border-radius: 3px;
}
.sv-ai-content::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, rgba(255,255,255,0.25));
}

/* View containers */
.sv-ai-view { display: none; }
.sv-ai-view.sv-ai-view-active { display: block; }

/* Settings Form */
.sv-ai-field {
  margin-bottom: 14px;
}
.sv-ai-field label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 5px;
}
.sv-ai-field input,
.sv-ai-field select,
.sv-ai-field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  background: var(--bg-input, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.15s;
}
.sv-ai-field input:focus,
.sv-ai-field select:focus,
.sv-ai-field textarea:focus {
  outline: none;
  border-color: var(--accent-primary, #22c55e);
}
.sv-ai-field input[type="password"] {
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
}
.sv-ai-field .sv-ai-hint {
  font-size: 11px;
  color: var(--text-muted, #666);
  margin-top: 4px;
}
.sv-ai-field-row {
  display: flex;
  gap: 10px;
}
.sv-ai-field-row .sv-ai-field { flex: 1; }
.sv-ai-field input[type="range"] {
  padding: 0;
  margin-top: 4px;
  accent-color: var(--accent-primary, #22c55e);
}
.sv-ai-range-value {
  display: inline-block;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  min-width: 40px;
  text-align: right;
}

/* Buttons */
.sv-ai-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  background: var(--bg-button, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.sv-ai-btn:hover {
  background: var(--bg-button-hover, #444);
}
.sv-ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sv-ai-btn-primary {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
  border-color: var(--accent-primary, #22c55e);
}
.sv-ai-btn-primary:hover {
  filter: brightness(1.1);
  background: var(--accent-primary, #22c55e);
}
.sv-ai-btn-danger {
  border-color: var(--accent-error, #ef4444);
  color: var(--accent-error, #ef4444);
}
.sv-ai-btn-danger:hover {
  background: var(--accent-error, #ef4444);
  color: var(--text-on-accent, #fff);
}
.sv-ai-btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}
.sv-ai-btn-block {
  width: 100%;
}
.sv-ai-btn-group {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Chat Interface */
.sv-ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sv-ai-messages {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}
.sv-ai-messages::-webkit-scrollbar { width: 6px; }
.sv-ai-messages::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, rgba(255,255,255,0.15));
  border-radius: 3px;
}
.sv-ai-msg {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  line-height: 1.5;
  animation: svAiFadeIn 0.2s ease;
}
@keyframes svAiFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.sv-ai-msg-user {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
  margin-left: 40px;
  border-bottom-right-radius: 2px;
}
.sv-ai-msg-ai {
  background: var(--bg-button, #333);
  margin-right: 40px;
  border-bottom-left-radius: 2px;
}
.sv-ai-msg-ai pre {
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  padding: 10px;
  overflow-x: auto;
  margin: 8px 0;
  font-size: 12px;
  line-height: 1.4;
}
.sv-ai-msg-ai code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}
.sv-ai-msg-ai p { margin: 6px 0; }
.sv-ai-msg-ai p:first-child { margin-top: 0; }
.sv-ai-msg-ai p:last-child { margin-bottom: 0; }
.sv-ai-msg-error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--accent-error, #ef4444);
  color: var(--accent-error, #ef4444);
}
.sv-ai-msg-system {
  background: transparent;
  color: var(--text-muted, #666);
  font-size: 12px;
  text-align: center;
  padding: 6px;
}

/* Chat Input */
.sv-ai-chat-input {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #444);
  flex-shrink: 0;
}
.sv-ai-chat-input textarea {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  background: var(--bg-input, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  font-family: inherit;
  resize: none;
  min-height: 42px;
  max-height: 120px;
  line-height: 1.4;
}
.sv-ai-chat-input textarea:focus {
  outline: none;
  border-color: var(--accent-primary, #22c55e);
}
.sv-ai-chat-input .sv-ai-btn {
  flex-shrink: 0;
  align-self: flex-end;
}

/* Script Preview */
.sv-ai-preview {
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 10px;
}
.sv-ai-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-section-header, #2a2a2a);
  border-bottom: 1px solid var(--border-color, #444);
  font-size: 12px;
  font-weight: 600;
}
.sv-ai-preview-code {
  padding: 12px;
  background: var(--bg-input, #1a1a1a);
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
  tab-size: 2;
}

/* Explanation Panel */
.sv-ai-explanation {
  line-height: 1.6;
}
.sv-ai-explanation h4 {
  color: var(--accent-primary, #22c55e);
  font-size: 14px;
  margin: 16px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #444);
}
.sv-ai-explanation h4:first-child { margin-top: 0; }
.sv-ai-explanation ul, .sv-ai-explanation ol {
  padding-left: 20px;
  margin: 6px 0;
}
.sv-ai-explanation li { margin: 4px 0; }
.sv-ai-explanation code {
  background: var(--bg-input, #1a1a1a);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

/* Security Report Card */
.sv-ai-report {
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  overflow: hidden;
}
.sv-ai-report-header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid var(--border-color, #444);
}
.sv-ai-score-ring {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  position: relative;
}
.sv-ai-score-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.sv-ai-score-ring .ring-bg {
  fill: none;
  stroke: var(--border-color, #444);
  stroke-width: 5;
}
.sv-ai-score-ring .ring-fill {
  fill: none;
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}
.sv-ai-score-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: 700;
}
.sv-ai-report-meta h4 {
  font-size: 16px;
  margin-bottom: 4px;
}
.sv-ai-report-meta p {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  line-height: 1.4;
}
.sv-ai-risk-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.sv-ai-risk-low { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.sv-ai-risk-medium { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
.sv-ai-risk-high { background: rgba(251, 146, 60, 0.2); color: #fb923c; }
.sv-ai-risk-critical { background: rgba(248, 113, 113, 0.2); color: #f87171; }
.sv-ai-risk-info { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }

.sv-ai-findings {
  padding: 0;
}
.sv-ai-finding {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #444);
  transition: background 0.1s;
}
.sv-ai-finding:last-child { border-bottom: none; }
.sv-ai-finding:hover { background: var(--bg-row-hover, #333); }
.sv-ai-finding-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.sv-ai-finding-title {
  font-weight: 600;
  font-size: 13px;
}
.sv-ai-finding-category {
  font-size: 11px;
  color: var(--text-muted, #666);
  margin-left: auto;
}
.sv-ai-finding-desc {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  line-height: 1.4;
  margin-bottom: 4px;
}
.sv-ai-finding-rec {
  font-size: 11px;
  color: var(--accent-secondary, #60a5fa);
  padding: 6px 8px;
  background: rgba(96, 165, 250, 0.08);
  border-radius: 4px;
  margin-top: 6px;
}

/* Fix Suggestions */
.sv-ai-fix {
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  overflow: hidden;
}
.sv-ai-fix-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #444);
}
.sv-ai-fix-section:last-child { border-bottom: none; }
.sv-ai-fix-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 6px;
}
.sv-ai-fix-confidence {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.sv-ai-fix-confidence-high { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.sv-ai-fix-confidence-medium { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
.sv-ai-fix-confidence-low { background: rgba(248, 113, 113, 0.2); color: #f87171; }

/* Loading States */
.sv-ai-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  color: var(--text-secondary, #a0a0a0);
  font-size: 13px;
}
.sv-ai-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color, #444);
  border-top-color: var(--accent-primary, #22c55e);
  border-radius: 50%;
  animation: svAiSpin 0.7s linear infinite;
}
@keyframes svAiSpin {
  to { transform: rotate(360deg); }
}

/* Empty / Placeholder States */
.sv-ai-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted, #666);
}
.sv-ai-empty svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}
.sv-ai-empty h4 {
  font-size: 15px;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 6px;
}
.sv-ai-empty p {
  font-size: 12px;
  line-height: 1.5;
}

/* Not-configured banner */
.sv-ai-not-configured {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #fbbf24;
}
.sv-ai-not-configured svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Toast notifications */
.sv-ai-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 10001;
  animation: svAiToastIn 0.3s ease, svAiToastOut 0.3s ease 2.7s forwards;
  max-width: 350px;
}
.sv-ai-toast-success { background: var(--accent-primary, #22c55e); color: var(--text-on-accent, #fff); }
.sv-ai-toast-error { background: var(--accent-error, #ef4444); color: #fff; }
@keyframes svAiToastIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes svAiToastOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
`;
    document.head.appendChild(_state.styleEl);
  }

  // ── SVG Icons ──────────────────────────────────────────────────────────
  const ICONS = {
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><line x1="9" y1="22" x2="15" y2="22"/><line x1="10" y1="19" x2="14" y2="19"/></svg>',
  };

  // ── UI Builder ──────────────────────────────────────────────────────────
  function _buildUI(container) {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sv-ai-backdrop';
    backdrop.addEventListener('click', () => _closePanel());
    document.body.appendChild(backdrop);
    _state.backdropEl = backdrop;

    // Main panel
    const panel = document.createElement('div');
    panel.className = 'sv-ai-panel';
    panel.innerHTML = `
      <div class="sv-ai-header">
        <h3>${ICONS.sparkles} AI Assistant</h3>
        <div class="sv-ai-header-actions">
          <button class="sv-ai-icon-btn" data-action="settings" title="Settings">${ICONS.settings}</button>
          <button class="sv-ai-icon-btn" data-action="close" title="Close">${ICONS.close}</button>
        </div>
      </div>
      <div class="sv-ai-tabs">
        <button class="sv-ai-tab sv-ai-tab-active" data-tab="generate">Generate</button>
        <button class="sv-ai-tab" data-tab="explain">Explain</button>
        <button class="sv-ai-tab" data-tab="security">Security</button>
        <button class="sv-ai-tab" data-tab="fix">Fix</button>
        <button class="sv-ai-tab" data-tab="settings">Settings</button>
      </div>
      <div class="sv-ai-content">
        <!-- Generate View -->
        <div class="sv-ai-view sv-ai-view-active" data-view="generate">
          <div class="sv-ai-chat">
            <div class="sv-ai-messages" id="svAiMessages"></div>
            <div class="sv-ai-chat-input">
              <textarea id="svAiPrompt" placeholder="Describe the script you want... e.g. 'Block YouTube ads' or 'Dark mode for GitHub'" rows="2"></textarea>
              <button class="sv-ai-btn sv-ai-btn-primary" id="svAiSend">${ICONS.send}</button>
            </div>
          </div>
        </div>

        <!-- Explain View -->
        <div class="sv-ai-view" data-view="explain">
          <div class="sv-ai-empty" id="svAiExplainEmpty">
            ${ICONS.code}
            <h4>Code Explanation</h4>
            <p>Select code in the editor and click "Explain" to get a human-readable explanation, or explain the entire active script.</p>
            <div class="sv-ai-btn-group" style="justify-content:center">
              <button class="sv-ai-btn" id="svAiExplainSelection">Explain Selection</button>
              <button class="sv-ai-btn" id="svAiExplainFull">Explain Full Script</button>
            </div>
          </div>
          <div id="svAiExplainResult" class="sv-ai-explanation" style="display:none"></div>
        </div>

        <!-- Security View -->
        <div class="sv-ai-view" data-view="security">
          <div class="sv-ai-empty" id="svAiSecurityEmpty">
            ${ICONS.shield}
            <h4>AI Security Review</h4>
            <p>Deep analysis of your script beyond regex patterns. Detects data exfiltration, obfuscation, privacy violations, and more.</p>
            <div class="sv-ai-btn-group" style="justify-content:center">
              <button class="sv-ai-btn sv-ai-btn-primary" id="svAiRunSecurity">Analyze Current Script</button>
            </div>
          </div>
          <div id="svAiSecurityResult" style="display:none"></div>
        </div>

        <!-- Fix View -->
        <div class="sv-ai-view" data-view="fix">
          <div class="sv-ai-empty" id="svAiFixEmpty">
            ${ICONS.wrench}
            <h4>AI Fix Suggestions</h4>
            <p>Paste or auto-capture an error from your script. The AI will diagnose the problem and suggest a fix.</p>
            <div class="sv-ai-field" style="margin-top:16px;text-align:left">
              <label>Error Message</label>
              <textarea id="svAiErrorInput" rows="3" placeholder="Paste the error message here..."></textarea>
            </div>
            <button class="sv-ai-btn sv-ai-btn-primary sv-ai-btn-block" id="svAiRunFix">Suggest Fix</button>
          </div>
          <div id="svAiFixResult" style="display:none"></div>
        </div>

        <!-- Settings View -->
        <div class="sv-ai-view" data-view="settings">
          ${_buildSettingsHTML()}
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    _state.panelEl = panel;

    _bindEvents(panel);
  }

  function _buildSettingsHTML() {
    const providerOptions = Object.entries(PROVIDERS)
      .map(([k, v]) => `<option value="${k}">${v.name}</option>`)
      .join('');

    return `
      <div class="sv-ai-field">
        <label>API Provider</label>
        <select id="svAiProvider">${providerOptions}</select>
      </div>
      <div class="sv-ai-field" id="svAiEndpointField" style="display:none">
        <label>Custom Endpoint URL</label>
        <input type="url" id="svAiEndpoint" placeholder="https://your-api.example.com/v1/chat/completions">
      </div>
      <div class="sv-ai-field" id="svAiOllamaField" style="display:none">
        <label>Ollama URL</label>
        <input type="url" id="svAiOllamaUrl" value="http://localhost:11434" placeholder="http://localhost:11434">
        <div class="sv-ai-hint">Ollama must be running locally with CORS enabled.</div>
      </div>
      <div class="sv-ai-field" id="svAiKeyField">
        <label>API Key</label>
        <input type="password" id="svAiApiKey" placeholder="sk-...">
        <div class="sv-ai-hint">Your key is encrypted with your passphrase before storage.</div>
      </div>
      <div class="sv-ai-field" id="svAiPassphraseField">
        <label>Encryption Passphrase</label>
        <input type="password" id="svAiPassphrase" placeholder="Passphrase to encrypt/decrypt your API key">
        <div class="sv-ai-hint">Required to save or load your API key. Choose something memorable.</div>
      </div>
      <div class="sv-ai-field">
        <label>Model</label>
        <select id="svAiModel"><option value="">Select provider first</option></select>
        <div class="sv-ai-hint" id="svAiModelHint">Or type a custom model name below.</div>
        <input type="text" id="svAiModelCustom" placeholder="Custom model name (optional)" style="margin-top:6px">
      </div>
      <div class="sv-ai-field-row">
        <div class="sv-ai-field">
          <label>Max Tokens <span class="sv-ai-range-value" id="svAiMaxTokensVal">2048</span></label>
          <input type="range" id="svAiMaxTokens" min="256" max="8192" step="256" value="2048">
        </div>
        <div class="sv-ai-field">
          <label>Temperature <span class="sv-ai-range-value" id="svAiTempVal">0.7</span></label>
          <input type="range" id="svAiTemp" min="0" max="2" step="0.1" value="0.7">
        </div>
      </div>
      <div class="sv-ai-btn-group">
        <button class="sv-ai-btn sv-ai-btn-primary" id="svAiSaveSettings">Save Settings</button>
        <button class="sv-ai-btn" id="svAiTestConnection">Test Connection</button>
        <button class="sv-ai-btn sv-ai-btn-danger" id="svAiClearSettings">Clear All</button>
      </div>
    `;
  }

  // ── Event Binding ─────────────────────────────────────────────────────
  function _bindEvents(panel) {
    // Tab switching
    panel.querySelectorAll('.sv-ai-tab').forEach((tab) => {
      tab.addEventListener('click', () => _switchTab(tab.dataset.tab));
    });

    // Header actions
    panel.querySelector('[data-action="settings"]').addEventListener('click', () => _switchTab('settings'));
    panel.querySelector('[data-action="close"]').addEventListener('click', () => _closePanel());

    // Generate: send prompt
    const sendBtn = panel.querySelector('#svAiSend');
    const promptEl = panel.querySelector('#svAiPrompt');
    sendBtn.addEventListener('click', () => _handleGenerate());
    promptEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleGenerate();
      }
    });

    // Auto-resize textarea
    promptEl.addEventListener('input', () => {
      promptEl.style.height = 'auto';
      promptEl.style.height = Math.min(promptEl.scrollHeight, 120) + 'px';
    });

    // Explain buttons
    panel.querySelector('#svAiExplainSelection')?.addEventListener('click', () => _handleExplain(true));
    panel.querySelector('#svAiExplainFull')?.addEventListener('click', () => _handleExplain(false));

    // Security
    panel.querySelector('#svAiRunSecurity')?.addEventListener('click', () => _handleSecurityReview());

    // Fix
    panel.querySelector('#svAiRunFix')?.addEventListener('click', () => _handleFixSuggest());

    // Settings
    _bindSettingsEvents(panel);
  }

  function _bindSettingsEvents(panel) {
    const providerEl = panel.querySelector('#svAiProvider');
    const endpointField = panel.querySelector('#svAiEndpointField');
    const ollamaField = panel.querySelector('#svAiOllamaField');
    const keyField = panel.querySelector('#svAiKeyField');
    const modelSelect = panel.querySelector('#svAiModel');
    const maxTokensEl = panel.querySelector('#svAiMaxTokens');
    const maxTokensVal = panel.querySelector('#svAiMaxTokensVal');
    const tempEl = panel.querySelector('#svAiTemp');
    const tempVal = panel.querySelector('#svAiTempVal');

    providerEl.addEventListener('change', () => {
      const p = providerEl.value;
      endpointField.style.display = p === 'custom' ? '' : 'none';
      ollamaField.style.display = p === 'ollama' ? '' : 'none';
      keyField.style.display = p === 'ollama' ? 'none' : '';

      // Populate model dropdown
      const models = PROVIDERS[p]?.models || [];
      modelSelect.innerHTML = models.length
        ? models.map((m) => `<option value="${m}">${m}</option>`).join('')
        : '<option value="">Enter custom model below</option>';
    });

    maxTokensEl.addEventListener('input', () => {
      maxTokensVal.textContent = maxTokensEl.value;
    });
    tempEl.addEventListener('input', () => {
      tempVal.textContent = parseFloat(tempEl.value).toFixed(1);
    });

    panel.querySelector('#svAiSaveSettings').addEventListener('click', () => _saveSettings());
    panel.querySelector('#svAiTestConnection').addEventListener('click', () => _testConnection());
    panel.querySelector('#svAiClearSettings').addEventListener('click', () => _clearSettings());
  }

  // ── Tab Switch ────────────────────────────────────────────────────────
  function _switchTab(tabName) {
    const panel = _state.panelEl;
    if (!panel) return;

    panel.querySelectorAll('.sv-ai-tab').forEach((t) =>
      t.classList.toggle('sv-ai-tab-active', t.dataset.tab === tabName)
    );
    panel.querySelectorAll('.sv-ai-view').forEach((v) =>
      v.classList.toggle('sv-ai-view-active', v.dataset.view === tabName)
    );
  }

  // ── Panel Open / Close ────────────────────────────────────────────────
  function _openPanel() {
    _state.panelEl?.classList.add('sv-ai-open');
    _state.backdropEl?.classList.add('sv-ai-visible');
  }

  function _closePanel() {
    _state.panelEl?.classList.remove('sv-ai-open');
    _state.backdropEl?.classList.remove('sv-ai-visible');
    _cancelRequest();
  }

  function _cancelRequest() {
    if (_state.abortController) {
      _state.abortController.abort();
      _state.abortController = null;
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────
  function _toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `sv-ai-toast sv-ai-toast-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ── Config Check ──────────────────────────────────────────────────────
  function _requireConfig() {
    if (!_state.config?.apiKey && _state.config?.provider !== 'ollama') {
      _toast('Please configure your AI API settings first.', 'error');
      _switchTab('settings');
      return false;
    }
    return true;
  }

  // ── Markdown-light Renderer ───────────────────────────────────────────
  function _renderMarkdown(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre><code>${code.trim()}</code></pre>`)
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Headers (## and ###)
      .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Lists
      .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      // Paragraphs (lines with content separated by blank lines)
      .replace(/^(?!<[huplo])((?!<).+)$/gm, '<p>$1</p>');
  }

  // ── Script Generation Handler ─────────────────────────────────────────
  async function _handleGenerate() {
    const promptEl = _state.panelEl.querySelector('#svAiPrompt');
    const description = promptEl.value.trim();
    if (!description) return;
    if (!_requireConfig()) return;

    const messagesEl = _state.panelEl.querySelector('#svAiMessages');
    promptEl.value = '';
    promptEl.style.height = 'auto';

    // Add user message
    _appendMessage(messagesEl, description, 'user');

    // Add loading
    const loadingEl = _appendLoading(messagesEl);

    try {
      const messages = PROMPTS.generateScript(description);
      const responseText = await _enqueueRequest(messages, true, (chunk, full) => {
        loadingEl.remove();
        const existingAi = messagesEl.querySelector('.sv-ai-msg-streaming');
        if (existingAi) {
          existingAi.querySelector('.sv-ai-preview-code').textContent = full;
        } else {
          _appendScriptPreview(messagesEl, full, true);
        }
      });

      // Finalize: remove streaming flag, ensure final content
      loadingEl.remove();
      const streamingEl = messagesEl.querySelector('.sv-ai-msg-streaming');
      if (streamingEl) {
        streamingEl.classList.remove('sv-ai-msg-streaming');
        streamingEl.querySelector('.sv-ai-preview-code').textContent = responseText;
      } else {
        _appendScriptPreview(messagesEl, responseText, false);
      }

      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (err) {
      loadingEl.remove();
      _state.panelEl.querySelector('.sv-ai-msg-streaming')?.remove();
      if (err.name !== 'AbortError') {
        _appendMessage(messagesEl, `Error: ${err.message}`, 'error');
      }
    }
  }

  function _appendMessage(container, text, type) {
    const el = document.createElement('div');
    el.className = `sv-ai-msg sv-ai-msg-${type}`;
    if (type === 'ai') {
      el.innerHTML = _renderMarkdown(text);
    } else {
      el.textContent = text;
    }
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function _appendScriptPreview(container, code, streaming) {
    const wrapper = document.createElement('div');
    wrapper.className = `sv-ai-msg sv-ai-msg-ai${streaming ? ' sv-ai-msg-streaming' : ''}`;
    wrapper.innerHTML = `
      <div class="sv-ai-preview">
        <div class="sv-ai-preview-header">
          <span>Generated Script</span>
          <div style="display:flex;gap:6px">
            <button class="sv-ai-btn sv-ai-btn-sm sv-ai-copy-btn" title="Copy">${ICONS.copy} Copy</button>
            <button class="sv-ai-btn sv-ai-btn-sm sv-ai-btn-primary sv-ai-install-btn" title="Install">${ICONS.download} Install</button>
          </div>
        </div>
        <div class="sv-ai-preview-code"></div>
      </div>
    `;
    wrapper.querySelector('.sv-ai-preview-code').textContent = code;

    wrapper.querySelector('.sv-ai-copy-btn').addEventListener('click', () => {
      const scriptCode = wrapper.querySelector('.sv-ai-preview-code').textContent;
      navigator.clipboard.writeText(scriptCode).then(() => _toast('Copied to clipboard'));
    });

    wrapper.querySelector('.sv-ai-install-btn').addEventListener('click', () => {
      const scriptCode = wrapper.querySelector('.sv-ai-preview-code').textContent;
      _installGeneratedScript(scriptCode);
    });

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return wrapper;
  }

  function _appendLoading(container) {
    const el = document.createElement('div');
    el.className = 'sv-ai-loading';
    el.innerHTML = `<div class="sv-ai-spinner"></div> Thinking...`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function _installGeneratedScript(code) {
    // Ensure the code has a proper userscript header
    let finalCode = code.trim();
    if (!finalCode.includes('==UserScript==')) {
      finalCode = `// ==UserScript==
// @name        AI Generated Script
// @namespace   scriptvault-ai
// @version     1.0.0
// @description Generated by ScriptVault AI Assistant
// @author      ScriptVault User
// @match       *://*/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

${finalCode}`;
    }

    // Send to background for installation
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'installScript', code: finalCode, source: 'ai-assistant' },
        (response) => {
          if (response?.success) {
            _toast('Script installed successfully!');
          } else {
            _toast(response?.error || 'Failed to install script', 'error');
          }
        }
      );
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(finalCode).then(() => {
        _toast('Script copied — paste into a new script in the editor.');
      });
    }
  }

  // ── Explain Handler ───────────────────────────────────────────────────
  async function _handleExplain(selectionOnly) {
    if (!_requireConfig()) return;

    const code = _getEditorCode();
    const selection = selectionOnly ? _getEditorSelection() : null;

    if (!code && !selection) {
      _toast('No code available. Open a script in the editor first.', 'error');
      return;
    }

    if (selectionOnly && !selection) {
      _toast('No text selected in the editor.', 'error');
      return;
    }

    const emptyEl = _state.panelEl.querySelector('#svAiExplainEmpty');
    const resultEl = _state.panelEl.querySelector('#svAiExplainResult');
    emptyEl.style.display = 'none';
    resultEl.style.display = '';
    resultEl.innerHTML = '<div class="sv-ai-loading"><div class="sv-ai-spinner"></div> Analyzing code...</div>';

    try {
      const messages = PROMPTS.explainCode(code, selection);
      const response = await _enqueueRequest(messages, true, (chunk, full) => {
        resultEl.innerHTML = _renderMarkdown(full);
      });
      resultEl.innerHTML = _renderMarkdown(response);
    } catch (err) {
      if (err.name !== 'AbortError') {
        resultEl.innerHTML = `<div class="sv-ai-msg sv-ai-msg-error">Error: ${_escapeHtml(err.message)}</div>`;
      }
    }
  }

  // ── Security Review Handler ───────────────────────────────────────────
  async function _handleSecurityReview() {
    if (!_requireConfig()) return;

    const code = _getEditorCode();
    if (!code) {
      _toast('No code available. Open a script in the editor first.', 'error');
      return;
    }

    const emptyEl = _state.panelEl.querySelector('#svAiSecurityEmpty');
    const resultEl = _state.panelEl.querySelector('#svAiSecurityResult');
    emptyEl.style.display = 'none';
    resultEl.style.display = '';
    resultEl.innerHTML = '<div class="sv-ai-loading"><div class="sv-ai-spinner"></div> Running security analysis...</div>';

    try {
      const messages = PROMPTS.securityReview(code);
      const response = await _enqueueRequest(messages);
      const report = _parseJSON(response);
      if (!report || !report.findings) {
        throw new Error('Invalid response format from AI');
      }
      resultEl.innerHTML = _renderSecurityReport(report);
    } catch (err) {
      if (err.name !== 'AbortError') {
        resultEl.innerHTML = `<div class="sv-ai-msg sv-ai-msg-error">Error: ${_escapeHtml(err.message)}</div>`;
      }
    }
  }

  function _renderSecurityReport(report) {
    const circumference = 2 * Math.PI * 28;
    const offset = circumference - (report.score / 100) * circumference;
    const riskColor = {
      low: '#4ade80',
      medium: '#fbbf24',
      high: '#fb923c',
      critical: '#f87171',
    }[report.overallRisk] || '#a0a0a0';

    let findingsHTML = '';
    if (report.findings.length === 0) {
      findingsHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No issues found.</div>';
    } else {
      findingsHTML = report.findings
        .map((f) => `
          <div class="sv-ai-finding">
            <div class="sv-ai-finding-header">
              <span class="sv-ai-risk-badge sv-ai-risk-${f.severity}">${f.severity}</span>
              <span class="sv-ai-finding-title">${_escapeHtml(f.title)}</span>
              <span class="sv-ai-finding-category">${_escapeHtml(f.category)}${f.line ? ` (line ${f.line})` : ''}</span>
            </div>
            <div class="sv-ai-finding-desc">${_escapeHtml(f.description)}</div>
            ${f.recommendation ? `<div class="sv-ai-finding-rec">${_escapeHtml(f.recommendation)}</div>` : ''}
          </div>
        `)
        .join('');
    }

    return `
      <div class="sv-ai-report">
        <div class="sv-ai-report-header">
          <div class="sv-ai-score-ring">
            <svg viewBox="0 0 64 64">
              <circle class="ring-bg" cx="32" cy="32" r="28"/>
              <circle class="ring-fill" cx="32" cy="32" r="28"
                stroke="${riskColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"/>
            </svg>
            <span class="sv-ai-score-text" style="color:${riskColor}">${report.score}</span>
          </div>
          <div class="sv-ai-report-meta">
            <h4>Security Score <span class="sv-ai-risk-badge sv-ai-risk-${report.overallRisk}">${report.overallRisk}</span></h4>
            <p>${_escapeHtml(report.summary)}</p>
          </div>
        </div>
        <div class="sv-ai-findings">
          ${findingsHTML}
        </div>
      </div>
    `;
  }

  // ── Fix Suggestions Handler ───────────────────────────────────────────
  async function _handleFixSuggest() {
    if (!_requireConfig()) return;

    const code = _getEditorCode();
    const errorInput = _state.panelEl.querySelector('#svAiErrorInput');
    const errorMsg = errorInput?.value.trim();

    if (!code) {
      _toast('No code available. Open a script in the editor first.', 'error');
      return;
    }
    if (!errorMsg) {
      _toast('Please enter the error message.', 'error');
      return;
    }

    const emptyEl = _state.panelEl.querySelector('#svAiFixEmpty');
    const resultEl = _state.panelEl.querySelector('#svAiFixResult');
    emptyEl.style.display = 'none';
    resultEl.style.display = '';
    resultEl.innerHTML = '<div class="sv-ai-loading"><div class="sv-ai-spinner"></div> Diagnosing error...</div>';

    try {
      const messages = PROMPTS.suggestFix(code, errorMsg);
      const response = await _enqueueRequest(messages);
      const fix = _parseJSON(response);
      if (!fix || !fix.diagnosis) {
        throw new Error('Invalid response format from AI');
      }
      resultEl.innerHTML = _renderFixResult(fix);

      // Bind apply-fix button
      resultEl.querySelector('.sv-ai-apply-fix')?.addEventListener('click', () => {
        _applyFix(fix.fix);
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        resultEl.innerHTML = `<div class="sv-ai-msg sv-ai-msg-error">Error: ${_escapeHtml(err.message)}</div>`;
      }
    }
  }

  function _renderFixResult(fix) {
    return `
      <div class="sv-ai-fix">
        <div class="sv-ai-fix-section">
          <div class="sv-ai-fix-label">Diagnosis
            <span class="sv-ai-fix-confidence sv-ai-fix-confidence-${fix.confidence || 'medium'}">${fix.confidence || 'medium'} confidence</span>
          </div>
          <p style="line-height:1.5">${_escapeHtml(fix.diagnosis)}</p>
        </div>
        <div class="sv-ai-fix-section">
          <div class="sv-ai-fix-label">Explanation</div>
          <p style="line-height:1.5">${_escapeHtml(fix.explanation)}</p>
        </div>
        <div class="sv-ai-fix-section">
          <div class="sv-ai-fix-label">Fixed Code</div>
          <div class="sv-ai-preview">
            <div class="sv-ai-preview-code">${_escapeHtml(fix.fix)}</div>
          </div>
        </div>
        <div class="sv-ai-fix-section" style="display:flex;gap:8px">
          <button class="sv-ai-btn sv-ai-btn-primary sv-ai-apply-fix">${ICONS.wrench} Apply Fix to Editor</button>
          <button class="sv-ai-btn sv-ai-copy-fix">${ICONS.copy} Copy Code</button>
        </div>
      </div>
    `;
  }

  function _applyFix(fixedCode) {
    if (!fixedCode) return;

    // Try to set the editor content via Monaco adapter or textarea
    const event = new CustomEvent('sv-ai-apply-code', { detail: { code: fixedCode } });
    document.dispatchEvent(event);

    // Fallback: try direct editor access
    const editorTextarea = document.getElementById('editorTextarea');
    if (editorTextarea) {
      editorTextarea.value = fixedCode;
      editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _toast('Fix applied to editor');
  }

  // ── Editor Integration Helpers ────────────────────────────────────────
  function _getEditorCode() {
    // Try Monaco adapter custom event
    let code = null;

    // Try direct textarea
    const textarea = document.getElementById('editorTextarea');
    if (textarea?.value) {
      code = textarea.value;
    }

    // Try Monaco iframe
    if (!code) {
      const iframe = document.querySelector('#codePanel iframe, .editor-sandbox');
      if (iframe?.contentWindow) {
        try {
          code = iframe.contentWindow.postMessage({ type: 'getCode' }, '*');
        } catch { /* cross-origin */ }
      }
    }

    return code || '';
  }

  function _getEditorSelection() {
    // Check for text selection in the textarea
    const textarea = document.getElementById('editorTextarea');
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    }

    // Check window selection (for Monaco or other editors)
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      return sel.toString();
    }

    return null;
  }

  // ── Settings Persistence ──────────────────────────────────────────────
  async function _saveSettings() {
    const panel = _state.panelEl;
    const provider = panel.querySelector('#svAiProvider').value;
    const apiKey = panel.querySelector('#svAiApiKey').value.trim();
    const passphrase = panel.querySelector('#svAiPassphrase').value;
    const endpoint = panel.querySelector('#svAiEndpoint').value.trim();
    const ollamaUrl = panel.querySelector('#svAiOllamaUrl').value.trim();
    const model = panel.querySelector('#svAiModelCustom').value.trim()
      || panel.querySelector('#svAiModel').value;
    const maxTokens = parseInt(panel.querySelector('#svAiMaxTokens').value, 10);
    const temperature = parseFloat(panel.querySelector('#svAiTemp').value);

    if (apiKey && !passphrase && provider !== 'ollama') {
      _toast('Passphrase is required to encrypt your API key.', 'error');
      return;
    }

    let encryptedApiKey = null;
    if (apiKey && passphrase) {
      try {
        encryptedApiKey = await _encryptApiKey(apiKey, passphrase);
      } catch (err) {
        _toast(`Encryption failed: ${err.message}`, 'error');
        return;
      }
    }

    const settings = {
      provider,
      endpoint,
      ollamaUrl,
      model,
      maxTokens,
      temperature,
      encryptedApiKey,
    };

    // Store in chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ svAiSettings: settings });
    }

    // Update live config (keep the raw key in memory for this session)
    _state.config = {
      ...settings,
      apiKey: apiKey || _state.config?.apiKey || '',
    };

    _toast('AI settings saved.');
  }

  async function _loadSettings() {
    let settings = null;

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const data = await chrome.storage.local.get('svAiSettings');
      settings = data.svAiSettings;
    }

    if (!settings) {
      _state.config = { ...DEFAULT_CONFIG };
      return;
    }

    _state.config = {
      ...DEFAULT_CONFIG,
      ...settings,
      apiKey: '', // Key must be decrypted with passphrase
    };

    // Populate form fields if panel exists
    _populateSettingsForm(settings);
  }

  function _populateSettingsForm(settings) {
    const panel = _state.panelEl;
    if (!panel) return;

    const providerEl = panel.querySelector('#svAiProvider');
    if (providerEl) {
      providerEl.value = settings.provider || 'openai';
      providerEl.dispatchEvent(new Event('change'));
    }

    _setVal('#svAiEndpoint', settings.endpoint);
    _setVal('#svAiOllamaUrl', settings.ollamaUrl || 'http://localhost:11434');
    _setVal('#svAiModelCustom', settings.model);
    _setVal('#svAiMaxTokens', settings.maxTokens || 2048);
    _setVal('#svAiTemp', settings.temperature ?? 0.7);

    const maxTokensVal = panel.querySelector('#svAiMaxTokensVal');
    if (maxTokensVal) maxTokensVal.textContent = settings.maxTokens || 2048;
    const tempVal = panel.querySelector('#svAiTempVal');
    if (tempVal) tempVal.textContent = (settings.temperature ?? 0.7).toFixed(1);

    // Select model in dropdown if it matches
    const modelSelect = panel.querySelector('#svAiModel');
    if (modelSelect) {
      for (const opt of modelSelect.options) {
        if (opt.value === settings.model) {
          modelSelect.value = settings.model;
          _setVal('#svAiModelCustom', '');
          break;
        }
      }
    }

    // Show encrypted key indicator
    if (settings.encryptedApiKey) {
      _setVal('#svAiApiKey', '');
      const hint = panel.querySelector('#svAiKeyField .sv-ai-hint');
      if (hint) hint.textContent = 'Encrypted key saved. Enter passphrase to unlock, or enter a new key.';
    }
  }

  function _setVal(selector, value) {
    const el = _state.panelEl?.querySelector(selector);
    if (el) el.value = value ?? '';
  }

  async function _unlockApiKey(passphrase) {
    if (!_state.config?.encryptedApiKey) return false;
    try {
      _state.config.apiKey = await _decryptApiKey(_state.config.encryptedApiKey, passphrase);
      return true;
    } catch {
      return false;
    }
  }

  async function _testConnection() {
    const panel = _state.panelEl;
    const passphrase = panel.querySelector('#svAiPassphrase')?.value;
    const rawKey = panel.querySelector('#svAiApiKey')?.value.trim();

    // Temporarily apply settings for testing
    const provider = panel.querySelector('#svAiProvider').value;
    const model = panel.querySelector('#svAiModelCustom').value.trim()
      || panel.querySelector('#svAiModel').value;
    const endpoint = panel.querySelector('#svAiEndpoint').value.trim();
    const ollamaUrl = panel.querySelector('#svAiOllamaUrl').value.trim();

    const tempConfig = {
      ..._state.config,
      provider,
      model: model || PROVIDERS[provider]?.defaultModel || '',
      endpoint,
      ollamaUrl,
      apiKey: rawKey || _state.config?.apiKey || '',
    };

    // If no raw key, try to decrypt stored key
    if (!tempConfig.apiKey && _state.config?.encryptedApiKey && passphrase) {
      try {
        tempConfig.apiKey = await _decryptApiKey(_state.config.encryptedApiKey, passphrase);
      } catch {
        _toast('Failed to decrypt API key — check your passphrase.', 'error');
        return;
      }
    }

    if (!tempConfig.apiKey && provider !== 'ollama') {
      _toast('Enter an API key or passphrase to decrypt the stored key.', 'error');
      return;
    }

    const savedConfig = _state.config;
    _state.config = tempConfig;

    try {
      const messages = [
        { role: 'system', content: 'Respond with exactly: OK' },
        { role: 'user', content: 'Test' },
      ];
      await _makeRequest(messages);
      _toast('Connection successful!');

      // Keep decrypted key in memory
      savedConfig.apiKey = tempConfig.apiKey;
      _state.config = savedConfig;
      _state.config.apiKey = tempConfig.apiKey;
    } catch (err) {
      _state.config = savedConfig;
      _toast(`Connection failed: ${err.message}`, 'error');
    }
  }

  async function _clearSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove('svAiSettings');
    }
    _state.config = { ...DEFAULT_CONFIG };
    _populateSettingsForm(DEFAULT_CONFIG);
    _toast('AI settings cleared.');
  }

  // ── Utility ───────────────────────────────────────────────────────────
  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _parseJSON(text) {
    // Try direct parse
    try { return JSON.parse(text); } catch { /* continue */ }

    // Try extracting JSON from markdown code block
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { /* continue */ }
    }

    // Try finding JSON object/array in the text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); } catch { /* continue */ }
    }

    return null;
  }

  // ── Public API ────────────────────────────────────────────────────────
  return {
    /**
     * Initialize the AI Assistant module.
     * @param {HTMLElement} containerEl - Parent container for the toggle button.
     */
    async init(containerEl) {
      _state.containerEl = containerEl;
      _injectStyles();
      _buildUI(containerEl);
      await _loadSettings();

      // Add toggle button to the container if provided
      if (containerEl) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sv-ai-icon-btn sv-ai-active';
        toggleBtn.title = 'AI Assistant';
        toggleBtn.innerHTML = ICONS.sparkles;
        toggleBtn.style.cssText = 'width:34px;height:34px;';
        toggleBtn.addEventListener('click', () => {
          if (_state.panelEl?.classList.contains('sv-ai-open')) {
            _closePanel();
          } else {
            _openPanel();
          }
        });
        containerEl.appendChild(toggleBtn);
      }

      // Listen for passphrase unlock via settings tab
      const passphraseEl = _state.panelEl?.querySelector('#svAiPassphrase');
      if (passphraseEl) {
        passphraseEl.addEventListener('change', async () => {
          const passphrase = passphraseEl.value;
          if (passphrase && _state.config?.encryptedApiKey) {
            const ok = await _unlockApiKey(passphrase);
            if (ok) {
              _toast('API key decrypted successfully.');
            }
          }
        });
      }

      // Listen for errors from content scripts for auto-capture
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === 'scriptError' && msg.error) {
            const errorInput = _state.panelEl?.querySelector('#svAiErrorInput');
            if (errorInput) {
              errorInput.value = `${msg.error.message || msg.error}\n\nScript: ${msg.scriptName || 'Unknown'}\nLine: ${msg.error.line || '?'}`;
            }
          }
        });
      }

      // Listen for apply-code events from fix suggestions
      document.addEventListener('sv-ai-apply-code', (e) => {
        const { code } = e.detail || {};
        if (!code) return;
        // Try Monaco postMessage
        const iframe = document.querySelector('#codePanel iframe, .editor-sandbox');
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'setCode', code }, '*');
        }
      });
    },

    /**
     * Update configuration programmatically.
     * @param {object} settings - Configuration overrides.
     */
    async configure(settings) {
      _state.config = { ..._state.config, ...settings };

      if (settings.encryptedApiKey === undefined && settings.apiKey) {
        // Store raw key in memory only — encryption happens on save
        _state.config.apiKey = settings.apiKey;
      }

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const { apiKey, ...storable } = _state.config;
        await chrome.storage.local.set({ svAiSettings: storable });
      }
    },

    /**
     * Generate a userscript from a natural language description.
     * @param {string} description - What the script should do.
     * @returns {Promise<string>} The generated script code.
     */
    async generateScript(description) {
      if (!_requireConfig()) throw new Error('AI not configured');
      const messages = PROMPTS.generateScript(description);
      return _enqueueRequest(messages);
    },

    /**
     * Get an explanation of code.
     * @param {string} code - Full script code.
     * @param {string|null} selection - Selected portion to explain (or null for full).
     * @returns {Promise<string>} Human-readable explanation.
     */
    async explainCode(code, selection = null) {
      if (!_requireConfig()) throw new Error('AI not configured');
      const messages = PROMPTS.explainCode(code, selection);
      return _enqueueRequest(messages);
    },

    /**
     * Run an AI-powered security review on a script.
     * @param {string} code - The script code to analyze.
     * @returns {Promise<object>} Structured security report.
     */
    async securityReview(code) {
      if (!_requireConfig()) throw new Error('AI not configured');
      const messages = PROMPTS.securityReview(code);
      const response = await _enqueueRequest(messages);
      const report = _parseJSON(response);
      if (!report) throw new Error('Failed to parse security report');
      return report;
    },

    /**
     * Get fix suggestions for a script error.
     * @param {string} code - The script code.
     * @param {string} error - The error message/stack trace.
     * @returns {Promise<object>} Fix suggestion object.
     */
    async suggestFix(code, error) {
      if (!_requireConfig()) throw new Error('AI not configured');
      const messages = PROMPTS.suggestFix(code, error);
      const response = await _enqueueRequest(messages);
      const fix = _parseJSON(response);
      if (!fix) throw new Error('Failed to parse fix suggestion');
      return fix;
    },

    /**
     * Check if the assistant is configured with an API key/endpoint.
     * @returns {boolean}
     */
    isConfigured() {
      if (!_state.config) return false;
      if (_state.config.provider === 'ollama') return true;
      return !!(
        _state.config.apiKey ||
        _state.config.encryptedApiKey
      );
    },

    /**
     * Get the current configuration (without the raw API key).
     * @returns {object}
     */
    getConfig() {
      if (!_state.config) return null;
      const { apiKey, ...safe } = _state.config;
      return {
        ...safe,
        hasApiKey: !!apiKey,
        hasEncryptedKey: !!safe.encryptedApiKey,
      };
    },

    /**
     * Open the AI panel.
     * @param {string} [tab] - Optional tab to open: 'generate', 'explain', 'security', 'fix', 'settings'.
     */
    open(tab) {
      _openPanel();
      if (tab) _switchTab(tab);
    },

    /**
     * Close the AI panel and cancel any pending requests.
     */
    close() {
      _closePanel();
    },

    /**
     * Tear down the AI Assistant, removing all DOM elements and listeners.
     */
    destroy() {
      _cancelRequest();
      _state.requestQueue.length = 0;
      _state.panelEl?.remove();
      _state.backdropEl?.remove();
      _state.styleEl?.remove();
      _state.panelEl = null;
      _state.backdropEl = null;
      _state.styleEl = null;
      _state.config = null;
      _state.containerEl = null;
    },
  };
})();
