/**
 * ScriptVault Onboarding Welcome Wizard
 * Self-contained module that shows a multi-step wizard overlay on first use.
 */

const OnboardingWizard = (() => {
  const STORAGE_KEY = 'onboardingCompleted';
  const TOTAL_STEPS = 5;
  let currentStep = 1;
  let overlay = null;
  let styleEl = null;
  let keyHandler = null;

  // ── Starter Scripts Catalog ──────────────────────────────────────────
  const STARTER_SCRIPTS = [
    {
      name: 'Dark Reader',
      description: 'Dark mode for every website — protects your eyes with a beautiful dark theme.',
      icon: '🌙',
      url: 'https://greasyfork.org/scripts/472257-dark-reader',
      tags: ['utility'],
    },
    {
      name: 'Return YouTube Dislike',
      description: 'Brings back the dislike count on YouTube videos.',
      icon: '👎',
      url: 'https://greasyfork.org/scripts/436115-return-youtube-dislike',
      tags: ['youtube'],
    },
    {
      name: 'Bypass Paywalls Clean',
      description: 'Read articles from news sites that lock content behind paywalls.',
      icon: '📰',
      url: 'https://greasyfork.org/scripts/444885-bypass-paywalls-clean',
      tags: ['utility'],
    },
    {
      name: 'AdsBypasser',
      description: 'Automatically skip countdown ads and link shorteners.',
      icon: '⏭️',
      url: 'https://greasyfork.org/scripts/4881-adsbypasser',
      tags: ['ads'],
    },
    {
      name: 'Linkify Plus Plus',
      description: 'Turns plain-text URLs into clickable links on any page.',
      icon: '🔗',
      url: 'https://greasyfork.org/scripts/4255-linkify-plus-plus',
      tags: ['utility'],
    },
    {
      name: 'Google Search Direct URLs',
      description: 'Removes Google\'s tracking redirects so links go straight to the source.',
      icon: '🔍',
      url: 'https://greasyfork.org/scripts/5765-google-search-direct-urls',
      tags: ['google'],
    },
  ];

  // ── CSS (injected once) ──────────────────────────────────────────────
  function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'sv-onboarding-styles';
    styleEl.textContent = `
      /* Overlay */
      .sv-onboarding-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(6px);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .sv-onboarding-overlay.sv-visible {
        opacity: 1;
      }

      /* Card */
      .sv-onboarding-card {
        position: relative;
        width: 560px;
        max-width: 94vw;
        max-height: 88vh;
        background: var(--bg-header, #252525);
        border: 1px solid var(--border-color, #404040);
        border-radius: 14px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      /* Step content wrapper */
      .sv-onboarding-body {
        padding: 36px 40px 24px;
        overflow-y: auto;
        flex: 1;
        position: relative;
      }

      /* Step transition */
      .sv-onboarding-step {
        opacity: 0;
        transform: translateX(24px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .sv-onboarding-step.sv-step-active {
        opacity: 1;
        transform: translateX(0);
      }
      .sv-onboarding-step.sv-step-exit {
        opacity: 0;
        transform: translateX(-24px);
      }

      /* Footer */
      .sv-onboarding-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 40px 24px;
        flex-shrink: 0;
      }

      /* Dots */
      .sv-onboarding-dots {
        display: flex;
        gap: 8px;
      }
      .sv-onboarding-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted, #707070);
        transition: background 0.25s ease, transform 0.25s ease;
      }
      .sv-onboarding-dot.sv-dot-active {
        background: var(--accent-green, #4ade80);
        transform: scale(1.3);
      }
      .sv-onboarding-dot.sv-dot-done {
        background: var(--accent-green-dark, #22c55e);
      }

      /* Buttons */
      .sv-onboarding-btn {
        padding: 9px 22px;
        border-radius: 8px;
        border: none;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
        font-family: inherit;
        outline: none;
      }
      .sv-onboarding-btn:active {
        transform: scale(0.97);
      }
      .sv-onboarding-btn:focus-visible {
        box-shadow: 0 0 0 2px var(--accent-green, #4ade80);
      }
      .sv-onboarding-btn-primary {
        background: var(--accent-green-dark, #22c55e);
        color: #fff;
      }
      .sv-onboarding-btn-primary:hover {
        background: var(--accent-green, #4ade80);
        color: #000;
      }
      .sv-onboarding-btn-ghost {
        background: transparent;
        color: var(--text-secondary, #a0a0a0);
      }
      .sv-onboarding-btn-ghost:hover {
        color: var(--text-primary, #e0e0e0);
        background: rgba(255,255,255,0.06);
      }

      /* Skip (top-right) */
      .sv-onboarding-skip {
        position: absolute;
        top: 14px;
        right: 16px;
        background: transparent;
        border: none;
        color: var(--text-muted, #707070);
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        padding: 4px 10px;
        border-radius: 6px;
        transition: color 0.2s, background 0.2s;
        z-index: 2;
      }
      .sv-onboarding-skip:hover {
        color: var(--text-secondary, #a0a0a0);
        background: rgba(255,255,255,0.06);
      }

      /* Typography */
      .sv-onboarding-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--text-primary, #e0e0e0);
        margin-bottom: 8px;
      }
      .sv-onboarding-subtitle {
        font-size: 14px;
        color: var(--text-secondary, #a0a0a0);
        line-height: 1.6;
        margin-bottom: 20px;
      }

      /* Step 1 — Welcome */
      .sv-welcome-logo {
        width: 72px;
        height: 72px;
        margin: 0 auto 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--accent-green-dark, #22c55e), var(--accent-blue, #60a5fa));
        border-radius: 18px;
        font-size: 36px;
        box-shadow: 0 8px 24px rgba(34,197,94,0.25);
      }
      .sv-welcome-center {
        text-align: center;
      }
      .sv-welcome-features {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 18px;
      }
      .sv-welcome-feature {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bg-row, #2a2a2a);
        border-radius: 8px;
        font-size: 12px;
        color: var(--text-secondary, #a0a0a0);
      }
      .sv-welcome-feature-icon {
        color: var(--accent-green, #4ade80);
        font-size: 14px;
        flex-shrink: 0;
      }

      /* Step 2 — Import */
      .sv-import-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
      }
      .sv-import-option {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
        background: var(--bg-row, #2a2a2a);
        border: 1px solid var(--border-color, #404040);
        border-radius: 10px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
      }
      .sv-import-option:hover {
        border-color: var(--accent-green-dark, #22c55e);
        background: var(--bg-row-hover, #333333);
      }
      .sv-import-option-icon {
        font-size: 28px;
        flex-shrink: 0;
      }
      .sv-import-option-text h4 {
        font-size: 14px;
        color: var(--text-primary, #e0e0e0);
        margin-bottom: 3px;
        font-weight: 600;
      }
      .sv-import-option-text p {
        font-size: 12px;
        color: var(--text-secondary, #a0a0a0);
        margin: 0;
      }
      .sv-import-status {
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 12px;
        display: none;
      }
      .sv-import-status.sv-status-success {
        display: block;
        background: rgba(34,197,94,0.12);
        color: var(--accent-green, #4ade80);
        border: 1px solid rgba(34,197,94,0.25);
      }
      .sv-import-status.sv-status-error {
        display: block;
        background: rgba(248,113,113,0.12);
        color: var(--accent-red, #f87171);
        border: 1px solid rgba(248,113,113,0.25);
      }

      /* Step 3 — Discover */
      .sv-discover-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 8px;
      }
      .sv-discover-card {
        padding: 14px;
        background: var(--bg-row, #2a2a2a);
        border: 1px solid var(--border-color, #404040);
        border-radius: 10px;
        transition: border-color 0.2s, background 0.2s;
      }
      .sv-discover-card:hover {
        border-color: var(--accent-green-dark, #22c55e);
        background: var(--bg-row-hover, #333333);
      }
      .sv-discover-card-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .sv-discover-card-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .sv-discover-card-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #e0e0e0);
      }
      .sv-discover-card-desc {
        font-size: 11px;
        color: var(--text-secondary, #a0a0a0);
        line-height: 1.5;
        margin-bottom: 10px;
      }
      .sv-discover-install-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        font-size: 11px;
        font-weight: 600;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: var(--accent-green-dark, #22c55e);
        color: #fff;
        transition: background 0.2s, transform 0.15s;
        font-family: inherit;
      }
      .sv-discover-install-btn:hover {
        background: var(--accent-green, #4ade80);
        color: #000;
      }
      .sv-discover-install-btn:active {
        transform: scale(0.96);
      }
      .sv-discover-install-btn.sv-installed {
        background: var(--bg-input, #333333);
        color: var(--accent-green, #4ade80);
        cursor: default;
        pointer-events: none;
      }

      /* Step 4 — Tour */
      .sv-tour-items {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 8px;
      }
      .sv-tour-item {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px 16px;
        background: var(--bg-row, #2a2a2a);
        border-radius: 10px;
        border: 1px solid var(--border-color, #404040);
        transition: border-color 0.25s, background 0.25s;
        cursor: default;
      }
      .sv-tour-item:hover {
        border-color: var(--accent-blue, #60a5fa);
        background: var(--bg-row-hover, #333333);
      }
      .sv-tour-item-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .sv-tour-item-icon.sv-tour-green { background: rgba(34,197,94,0.15); }
      .sv-tour-item-icon.sv-tour-blue { background: rgba(96,165,250,0.15); }
      .sv-tour-item-icon.sv-tour-purple { background: rgba(192,132,252,0.15); }
      .sv-tour-item-icon.sv-tour-orange { background: rgba(251,146,60,0.15); }
      .sv-tour-item-text h4 {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #e0e0e0);
        margin-bottom: 2px;
      }
      .sv-tour-item-text p {
        font-size: 12px;
        color: var(--text-secondary, #a0a0a0);
        margin: 0;
        line-height: 1.5;
      }
      .sv-tour-kbd {
        display: inline-block;
        padding: 1px 6px;
        font-size: 11px;
        font-family: 'SFMono-Regular', Consolas, monospace;
        background: var(--bg-input, #333333);
        border: 1px solid var(--border-color, #404040);
        border-radius: 4px;
        color: var(--accent-yellow, #fbbf24);
      }

      /* Step 5 — Complete */
      .sv-complete-center {
        text-align: center;
      }
      .sv-complete-check {
        width: 64px;
        height: 64px;
        margin: 0 auto 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(34,197,94,0.14);
        border-radius: 50%;
        font-size: 32px;
      }
      .sv-complete-links {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
      }
      .sv-complete-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: var(--bg-row, #2a2a2a);
        border: 1px solid var(--border-color, #404040);
        border-radius: 10px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        text-decoration: none;
        color: inherit;
      }
      .sv-complete-link:hover {
        border-color: var(--accent-green-dark, #22c55e);
        background: var(--bg-row-hover, #333333);
        text-decoration: none;
      }
      .sv-complete-link-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .sv-complete-link-text {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #e0e0e0);
      }
      .sv-complete-link-sub {
        font-size: 11px;
        color: var(--text-secondary, #a0a0a0);
      }

      /* Responsive */
      @media (max-width: 520px) {
        .sv-onboarding-body { padding: 28px 20px 16px; }
        .sv-onboarding-footer { padding: 12px 20px 18px; }
        .sv-welcome-features { grid-template-columns: 1fr; }
        .sv-discover-grid { grid-template-columns: 1fr; }
        .sv-onboarding-card { border-radius: 10px; }
        .sv-onboarding-title { font-size: 19px; }
      }

      /* Highlight ring for tour */
      .sv-tour-highlight {
        position: fixed;
        z-index: 99999;
        border: 2px solid var(--accent-green, #4ade80);
        border-radius: 8px;
        box-shadow: 0 0 0 4000px rgba(0,0,0,0.55), 0 0 20px rgba(74,222,128,0.4);
        pointer-events: none;
        transition: all 0.4s ease;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // ── Step Renderers ───────────────────────────────────────────────────

  function renderStep1() {
    return `
      <div class="sv-welcome-center">
        <div class="sv-welcome-logo">
          <span>SV</span>
        </div>
        <div class="sv-onboarding-title">Welcome to ScriptVault</div>
        <div class="sv-onboarding-subtitle">
          Your powerful userscript manager for Chrome. Install, manage, and write
          scripts that customize the web — all from one elegant dashboard.
        </div>
        <div class="sv-welcome-features">
          <div class="sv-welcome-feature">
            <span class="sv-welcome-feature-icon">&#10003;</span> One-click script installs
          </div>
          <div class="sv-welcome-feature">
            <span class="sv-welcome-feature-icon">&#10003;</span> Built-in code editor
          </div>
          <div class="sv-welcome-feature">
            <span class="sv-welcome-feature-icon">&#10003;</span> Tampermonkey compatible
          </div>
          <div class="sv-welcome-feature">
            <span class="sv-welcome-feature-icon">&#10003;</span> Auto-update support
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2() {
    return `
      <div class="sv-onboarding-title">Import Your Scripts</div>
      <div class="sv-onboarding-subtitle">
        Already using Tampermonkey? Import your scripts in seconds, or skip this step and start fresh.
      </div>
      <div class="sv-import-options">
        <div class="sv-import-option" id="sv-import-tampermonkey">
          <span class="sv-import-option-icon">&#128230;</span>
          <div class="sv-import-option-text">
            <h4>Import from Tampermonkey</h4>
            <p>Select your Tampermonkey .txt backup file to import all scripts at once.</p>
          </div>
        </div>
        <div class="sv-import-option" id="sv-import-file">
          <span class="sv-import-option-icon">&#128196;</span>
          <div class="sv-import-option-text">
            <h4>Import .user.js Files</h4>
            <p>Pick individual userscript files from your computer.</p>
          </div>
        </div>
      </div>
      <input type="file" id="sv-import-file-input" accept=".txt,.user.js,.js" multiple style="display:none;">
      <div class="sv-import-status" id="sv-import-status"></div>
    `;
  }

  function renderStep3() {
    let cards = STARTER_SCRIPTS.map((s, i) => `
      <div class="sv-discover-card">
        <div class="sv-discover-card-head">
          <span class="sv-discover-card-icon">${s.icon}</span>
          <span class="sv-discover-card-name">${s.name}</span>
        </div>
        <div class="sv-discover-card-desc">${s.description}</div>
        <button class="sv-discover-install-btn" data-script-idx="${i}">
          <span>+</span> Install
        </button>
      </div>
    `).join('');

    return `
      <div class="sv-onboarding-title">Discover Popular Scripts</div>
      <div class="sv-onboarding-subtitle">
        Get started with these community favorites — install any with one click.
      </div>
      <div class="sv-discover-grid">${cards}</div>
    `;
  }

  function renderStep4() {
    return `
      <div class="sv-onboarding-title">Know Your Dashboard</div>
      <div class="sv-onboarding-subtitle">
        Here's a quick tour of the key areas you'll use most.
      </div>
      <div class="sv-tour-items">
        <div class="sv-tour-item" data-tour-target=".script-list, .tab-content, .main-content">
          <div class="sv-tour-item-icon sv-tour-green">&#128220;</div>
          <div class="sv-tour-item-text">
            <h4>Script List</h4>
            <p>All your installed scripts appear here. Toggle them on/off, reorder, or click to edit.</p>
          </div>
        </div>
        <div class="sv-tour-item" data-tour-target=".editor-container, .CodeMirror, .monaco-editor">
          <div class="sv-tour-item-icon sv-tour-blue">&#9998;</div>
          <div class="sv-tour-item-text">
            <h4>Code Editor</h4>
            <p>A full-featured editor with syntax highlighting, autocomplete, and live error checking.</p>
          </div>
        </div>
        <div class="sv-tour-item" data-tour-target=".settings, .tab-settings, [data-tab='settings']">
          <div class="sv-tour-item-icon sv-tour-purple">&#9881;</div>
          <div class="sv-tour-item-text">
            <h4>Settings</h4>
            <p>Configure update intervals, editor preferences, backup options, and more.</p>
          </div>
        </div>
        <div class="sv-tour-item" data-tour-target=".command-palette, .cmd-palette">
          <div class="sv-tour-item-icon sv-tour-orange">&#9889;</div>
          <div class="sv-tour-item-text">
            <h4>Command Palette</h4>
            <p>Press <span class="sv-tour-kbd">Ctrl+K</span> anywhere to quickly search scripts, run actions, and navigate.</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep5() {
    return `
      <div class="sv-complete-center">
        <div class="sv-complete-check">&#10003;</div>
        <div class="sv-onboarding-title">You're All Set!</div>
        <div class="sv-onboarding-subtitle">
          ScriptVault is ready to go. Here are some things you can do next.
        </div>
        <div class="sv-complete-links">
          <a class="sv-complete-link" href="#" id="sv-link-create">
            <span class="sv-complete-link-icon">&#128221;</span>
            <div>
              <div class="sv-complete-link-text">Create a Script</div>
              <div class="sv-complete-link-sub">Start from scratch with the built-in editor</div>
            </div>
          </a>
          <a class="sv-complete-link" href="https://greasyfork.org/" target="_blank" rel="noopener">
            <span class="sv-complete-link-icon">&#127758;</span>
            <div>
              <div class="sv-complete-link-text">Browse GreasyFork</div>
              <div class="sv-complete-link-sub">Discover thousands of community userscripts</div>
            </div>
          </a>
          <a class="sv-complete-link" href="#" id="sv-link-help">
            <span class="sv-complete-link-icon">&#128218;</span>
            <div>
              <div class="sv-complete-link-text">View Help</div>
              <div class="sv-complete-link-sub">Read the documentation and keyboard shortcuts</div>
            </div>
          </a>
        </div>
      </div>
    `;
  }

  const STEP_RENDERERS = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  function getNextLabel(step) {
    if (step === 1) return 'Get Started';
    if (step === TOTAL_STEPS) return 'Finish';
    return 'Next';
  }

  // ── DOM Construction ─────────────────────────────────────────────────

  function buildOverlay() {
    const el = document.createElement('div');
    el.className = 'sv-onboarding-overlay';
    el.innerHTML = `
      <div class="sv-onboarding-card">
        <button class="sv-onboarding-skip" id="sv-skip-btn">Skip</button>
        <div class="sv-onboarding-body">
          <div class="sv-onboarding-step sv-step-active" id="sv-step-content">
            ${renderStep1()}
          </div>
        </div>
        <div class="sv-onboarding-footer">
          <div class="sv-onboarding-dots" id="sv-dots">
            ${Array.from({ length: TOTAL_STEPS }, (_, i) =>
              `<div class="sv-onboarding-dot${i === 0 ? ' sv-dot-active' : ''}" data-dot="${i + 1}"></div>`
            ).join('')}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="sv-onboarding-btn sv-onboarding-btn-ghost" id="sv-back-btn" style="display:none;">Back</button>
            <button class="sv-onboarding-btn sv-onboarding-btn-primary" id="sv-next-btn">Get Started</button>
          </div>
        </div>
      </div>
    `;
    return el;
  }

  // ── Navigation ───────────────────────────────────────────────────────

  function updateDots() {
    const dots = overlay.querySelectorAll('.sv-onboarding-dot');
    dots.forEach((dot, i) => {
      const step = i + 1;
      dot.classList.remove('sv-dot-active', 'sv-dot-done');
      if (step === currentStep) dot.classList.add('sv-dot-active');
      else if (step < currentStep) dot.classList.add('sv-dot-done');
    });
  }

  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    const contentEl = overlay.querySelector('#sv-step-content');
    const backBtn = overlay.querySelector('#sv-back-btn');
    const nextBtn = overlay.querySelector('#sv-next-btn');

    // Exit animation
    contentEl.classList.remove('sv-step-active');
    contentEl.classList.add('sv-step-exit');

    setTimeout(() => {
      currentStep = step;
      contentEl.innerHTML = STEP_RENDERERS[currentStep]();

      // Reset animation classes
      contentEl.classList.remove('sv-step-exit');
      // Force reflow so the browser restarts the transition
      void contentEl.offsetWidth;
      contentEl.classList.add('sv-step-active');

      backBtn.style.display = currentStep > 1 ? '' : 'none';
      nextBtn.textContent = getNextLabel(currentStep);
      updateDots();
      attachStepListeners();
    }, 200);
  }

  function nextStep() {
    if (currentStep >= TOTAL_STEPS) {
      completeOnboarding();
    } else {
      goToStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 1) goToStep(currentStep - 1);
  }

  // ── Step-specific Event Wiring ───────────────────────────────────────

  function attachStepListeners() {
    if (currentStep === 2) attachImportListeners();
    if (currentStep === 3) attachDiscoverListeners();
    if (currentStep === 4) attachTourListeners();
    if (currentStep === 5) attachCompleteListeners();
  }

  function attachImportListeners() {
    const tmOption = overlay.querySelector('#sv-import-tampermonkey');
    const fileOption = overlay.querySelector('#sv-import-file');
    const fileInput = overlay.querySelector('#sv-import-file-input');
    const statusEl = overlay.querySelector('#sv-import-status');

    if (tmOption) {
      tmOption.addEventListener('click', () => {
        fileInput.accept = '.txt';
        fileInput.multiple = false;
        fileInput.dataset.mode = 'tampermonkey';
        fileInput.click();
      });
    }
    if (fileOption) {
      fileOption.addEventListener('click', () => {
        fileInput.accept = '.user.js,.js';
        fileInput.multiple = true;
        fileInput.dataset.mode = 'userjs';
        fileInput.click();
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        try {
          const mode = fileInput.dataset.mode;
          let scriptCount = 0;

          for (const file of files) {
            const text = await file.text();

            if (mode === 'tampermonkey') {
              // Tampermonkey backup: scripts separated by a line of "=" characters
              const scripts = text.split(/^={10,}$/m).filter(s => s.trim());
              for (const raw of scripts) {
                const scriptText = raw.trim();
                if (scriptText.includes('==UserScript==')) {
                  await storeImportedScript(scriptText);
                  scriptCount++;
                }
              }
            } else {
              if (text.includes('==UserScript==')) {
                await storeImportedScript(text);
                scriptCount++;
              }
            }
          }

          statusEl.className = 'sv-import-status sv-status-success';
          statusEl.textContent = `Successfully imported ${scriptCount} script${scriptCount !== 1 ? 's' : ''}.`;
        } catch (err) {
          statusEl.className = 'sv-import-status sv-status-error';
          statusEl.textContent = `Import failed: ${err.message}`;
        }
      });
    }
  }

  async function storeImportedScript(code) {
    const meta = parseScriptMeta(code);
    const id = 'imported_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const script = {
      id,
      name: meta.name || 'Imported Script',
      namespace: meta.namespace || '',
      description: meta.description || '',
      version: meta.version || '1.0',
      author: meta.author || '',
      matches: meta.match || [],
      includes: meta.include || [],
      excludes: meta.exclude || [],
      grants: meta.grant || [],
      runAt: meta['run-at'] || 'document-idle',
      code,
      enabled: true,
      installed: Date.now(),
      updated: Date.now(),
      source: 'import',
    };

    return new Promise((resolve, reject) => {
      chrome.storage.local.get({ scripts: [] }, (data) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        data.scripts.push(script);
        chrome.storage.local.set({ scripts: data.scripts }, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
    });
  }

  function parseScriptMeta(code) {
    const meta = {};
    const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!headerMatch) return meta;

    const lines = headerMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (['match', 'include', 'exclude', 'grant', 'require', 'resource'].includes(key)) {
        if (!meta[key]) meta[key] = [];
        meta[key].push(val);
      } else {
        meta[key] = val;
      }
    }
    return meta;
  }

  function attachDiscoverListeners() {
    const buttons = overlay.querySelectorAll('.sv-discover-install-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.scriptIdx, 10);
        const script = STARTER_SCRIPTS[idx];
        if (!script) return;

        btn.classList.add('sv-installed');
        btn.innerHTML = '&#10003; Installed';

        // Open the script's GreasyFork page so the user can install it properly
        window.open(script.url, '_blank', 'noopener');
      });
    });
  }

  function attachTourListeners() {
    const items = overlay.querySelectorAll('.sv-tour-item[data-tour-target]');
    items.forEach((item) => {
      item.addEventListener('mouseenter', () => {
        const selectors = item.dataset.tourTarget.split(',').map(s => s.trim());
        for (const sel of selectors) {
          const target = document.querySelector(sel);
          if (target) {
            highlightElement(target);
            return;
          }
        }
      });
      item.addEventListener('mouseleave', removeHighlight);
    });
  }

  function highlightElement(el) {
    removeHighlight();
    const rect = el.getBoundingClientRect();
    const pad = 6;
    const ring = document.createElement('div');
    ring.className = 'sv-tour-highlight';
    ring.id = 'sv-tour-highlight';
    ring.style.top = `${rect.top - pad}px`;
    ring.style.left = `${rect.left - pad}px`;
    ring.style.width = `${rect.width + pad * 2}px`;
    ring.style.height = `${rect.height + pad * 2}px`;
    document.body.appendChild(ring);
  }

  function removeHighlight() {
    const existing = document.getElementById('sv-tour-highlight');
    if (existing) existing.remove();
  }

  function attachCompleteListeners() {
    const createLink = overlay.querySelector('#sv-link-create');
    const helpLink = overlay.querySelector('#sv-link-help');

    if (createLink) {
      createLink.addEventListener('click', (e) => {
        e.preventDefault();
        completeOnboarding();
        // Attempt to trigger the "new script" action in the dashboard
        const newBtn = document.querySelector('[data-action="new-script"], .new-script-btn, #new-script');
        if (newBtn) newBtn.click();
      });
    }
    if (helpLink) {
      helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        completeOnboarding();
        const helpTab = document.querySelector('[data-tab="help"], .tab-help');
        if (helpTab) helpTab.click();
      });
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  async function completeOnboarding() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: true }, () => {
        dismissUI();
        resolve();
      });
    });
  }

  function dismissUI() {
    removeHighlight();
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    if (overlay) {
      overlay.classList.remove('sv-visible');
      setTimeout(() => {
        overlay.remove();
        overlay = null;
      }, 300);
    }
    if (styleEl) {
      styleEl.remove();
      styleEl = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    /**
     * Returns true if onboarding has not yet been completed.
     */
    async shouldShow() {
      return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEY, (data) => {
          resolve(!data[STORAGE_KEY]);
        });
      });
    },

    /**
     * Show the onboarding wizard overlay.
     */
    show() {
      if (overlay) return; // already visible
      currentStep = 1;

      injectStyles();
      overlay = buildOverlay();
      document.body.appendChild(overlay);

      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        overlay.classList.add('sv-visible');
      });

      // Wire up persistent controls
      overlay.querySelector('#sv-next-btn').addEventListener('click', nextStep);
      overlay.querySelector('#sv-back-btn').addEventListener('click', prevStep);
      overlay.querySelector('#sv-skip-btn').addEventListener('click', () => completeOnboarding());

      // Keyboard navigation
      keyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nextStep();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          completeOnboarding();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevStep();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextStep();
        }
      };
      document.addEventListener('keydown', keyHandler);
    },

    /**
     * Dismiss the wizard without completing (does NOT set the completed flag).
     */
    dismiss() {
      removeHighlight();
      if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
      }
      if (overlay) {
        overlay.classList.remove('sv-visible');
        setTimeout(() => {
          overlay.remove();
          overlay = null;
        }, 300);
      }
      if (styleEl) {
        styleEl.remove();
        styleEl = null;
      }
    },
  };
})();
