// ScriptVault — Accessibility Module (WCAG 2.1 AA)
// Provides ARIA labels, focus management, high contrast mode, screen reader
// announcements, reduced motion support, and semantic HTML fixes.

const A11y = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _active = false;
  let _styleEl = null;
  let _liveRegion = null;
  let _liveRegionAssertive = null;
  let _skipLink = null;
  let _trapStack = [];        // stack of { element, previousFocus, handler }
  let _highContrast = false;
  let _reducedMotion = false;
  let _contrastMql = null;
  let _motionMql = null;
  let _mutationObserver = null;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Skip to main content link */
.a11y-skip-link {
  position: fixed;
  top: -100px;
  left: 8px;
  z-index: 100000;
  background: var(--bg-header);
  color: var(--accent-blue);
  padding: 8px 16px;
  border: 2px solid var(--accent-blue);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: top 150ms ease;
}
.a11y-skip-link:focus {
  top: 8px;
  outline: none;
}

/* Focus visible styles — outline, not box-shadow */
.a11y-active *:focus-visible {
  outline: 2px solid var(--accent-blue) !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}
/* Override for toggles/checkboxes which may be hidden */
.a11y-active input[type="checkbox"]:focus-visible + span,
.a11y-active input[type="checkbox"]:focus-visible + label {
  outline: 2px solid var(--accent-blue) !important;
  outline-offset: 2px !important;
}

/* Screen reader only */
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0,0,0,0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* Live regions */
.a11y-live {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

/* High contrast overrides */
.a11y-high-contrast {
  --border-color: #888888;
  --text-primary: #f5f5f5;
  --text-secondary: #cccccc;
  --text-muted: #999999;
  --bg-row-hover: #3a3a3a;
}
.a11y-high-contrast .toggle-slider,
.a11y-high-contrast .cv-toggle-slider {
  border: 1px solid #888;
}
.a11y-high-contrast button,
.a11y-high-contrast a {
  text-decoration-thickness: 2px;
}
.a11y-high-contrast .badge,
.a11y-high-contrast .cv-perf,
.a11y-high-contrast .script-tag {
  border: 1px solid currentColor;
}
.a11y-high-contrast *:focus-visible {
  outline-width: 3px !important;
}

/* Reduced motion */
.a11y-reduced-motion,
.a11y-reduced-motion * {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
  scroll-behavior: auto !important;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return [...document.querySelectorAll(sel)]; }

  /* ------------------------------------------------------------------ */
  /*  Live regions                                                       */
  /* ------------------------------------------------------------------ */

  function createLiveRegions() {
    if (!_liveRegion) {
      _liveRegion = document.createElement('div');
      _liveRegion.className = 'a11y-live';
      _liveRegion.setAttribute('role', 'status');
      _liveRegion.setAttribute('aria-live', 'polite');
      _liveRegion.setAttribute('aria-atomic', 'true');
      _liveRegion.id = 'a11y-live-polite';
      document.body.appendChild(_liveRegion);
    }
    if (!_liveRegionAssertive) {
      _liveRegionAssertive = document.createElement('div');
      _liveRegionAssertive.className = 'a11y-live';
      _liveRegionAssertive.setAttribute('role', 'alert');
      _liveRegionAssertive.setAttribute('aria-live', 'assertive');
      _liveRegionAssertive.setAttribute('aria-atomic', 'true');
      _liveRegionAssertive.id = 'a11y-live-assertive';
      document.body.appendChild(_liveRegionAssertive);
    }
  }

  function removeLiveRegions() {
    _liveRegion?.remove();
    _liveRegion = null;
    _liveRegionAssertive?.remove();
    _liveRegionAssertive = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Skip link                                                          */
  /* ------------------------------------------------------------------ */

  function createSkipLink() {
    if (_skipLink) return;
    _skipLink = document.createElement('a');
    _skipLink.className = 'a11y-skip-link';
    _skipLink.href = '#scriptsPanel';
    _skipLink.textContent = 'Skip to main content';
    _skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('scriptsPanel') || document.querySelector('main, [role="main"]');
      if (target) {
        target.tabIndex = -1;
        target.focus();
        target.removeAttribute('tabindex');
      }
    });
    document.body.prepend(_skipLink);
  }

  function removeSkipLink() {
    _skipLink?.remove();
    _skipLink = null;
  }

  /* ------------------------------------------------------------------ */
  /*  ARIA labeling                                                      */
  /* ------------------------------------------------------------------ */

  function applyAriaLabels() {
    // Script table
    const table = qs('#scriptTableBody')?.closest('table');
    if (table) {
      table.setAttribute('role', 'grid');
      table.setAttribute('aria-label', 'Installed scripts');
      qsa('#scriptTableBody tr[data-script-id]').forEach(tr => {
        tr.setAttribute('role', 'row');
        tr.querySelectorAll('td').forEach(td => td.setAttribute('role', 'gridcell'));
      });
      // Header row
      const thead = table.querySelector('thead tr, tr:first-child');
      if (thead) {
        thead.setAttribute('role', 'row');
        thead.querySelectorAll('th, td').forEach(th => th.setAttribute('role', 'columnheader'));
      }
    }

    // Tabs
    const tabContainer = qs('.tm-tabs, [class*="tab-bar"]');
    if (tabContainer) {
      tabContainer.setAttribute('role', 'tablist');
      tabContainer.setAttribute('aria-label', 'Dashboard tabs');
    }
    qsa('.tm-tab').forEach(tab => {
      tab.setAttribute('role', 'tab');
      const tabName = tab.dataset.tab || tab.textContent.trim();
      tab.setAttribute('aria-label', tabName);
      const panel = document.getElementById(`${tabName}Panel`);
      if (panel) {
        const panelId = panel.id;
        const tabId = `tab-${tabName}`;
        tab.id = tabId;
        tab.setAttribute('aria-controls', panelId);
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabId);
      }
    });

    // Toggle switches
    qsa('.toggle-switch, .cv-toggle').forEach(toggle => {
      const input = toggle.querySelector('input[type="checkbox"]');
      if (input) {
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-checked', String(input.checked));
        // Listen for changes to keep aria-checked in sync
        if (!toggle.dataset.a11yBound) {
          toggle.dataset.a11yBound = 'true';
          input.addEventListener('change', () => {
            toggle.setAttribute('aria-checked', String(input.checked));
          });
        }
      }
    });

    // Modals / overlays
    qsa('#editorOverlay, .modal, .overlay, [class*="modal"]').forEach(el => {
      if (!el.getAttribute('role')) {
        el.setAttribute('role', 'dialog');
      }
      el.setAttribute('aria-modal', 'true');
    });

    // Search
    const search = qs('#scriptSearch');
    if (search) {
      const wrapper = search.closest('.search-wrap, .search-container') || search.parentElement;
      if (wrapper && !wrapper.getAttribute('role')) {
        wrapper.setAttribute('role', 'search');
      }
      if (!search.getAttribute('aria-label')) {
        search.setAttribute('aria-label', 'Search scripts');
      }
    }

    // Script counter as status
    const counter = qs('#scriptCounter');
    if (counter) {
      counter.setAttribute('role', 'status');
      counter.setAttribute('aria-live', 'polite');
    }

    // Buttons with icon-only (need labels)
    qsa('.action-icon, .cv-menu-btn').forEach(btn => {
      if (!btn.getAttribute('aria-label') && btn.title) {
        btn.setAttribute('aria-label', btn.title);
      }
    });

    // Card view grid
    const grid = qs('.cv-grid');
    if (grid) {
      grid.setAttribute('role', 'list');
      grid.setAttribute('aria-label', 'Script cards');
      qsa('.cv-card').forEach(card => {
        card.setAttribute('role', 'listitem');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Semantic HTML fixes                                                */
  /* ------------------------------------------------------------------ */

  function fixSemanticHtml() {
    // Ensure images have alt text
    qsa('img:not([alt])').forEach(img => {
      img.setAttribute('alt', '');
    });

    // Ensure form controls have labels
    qsa('input:not([aria-label]):not([id]), select:not([aria-label]):not([id])').forEach(input => {
      const placeholder = input.getAttribute('placeholder');
      if (placeholder) {
        input.setAttribute('aria-label', placeholder);
      }
    });

    // Ensure labeled inputs via id have proper for association
    qsa('input[id], select[id], textarea[id]').forEach(input => {
      const id = input.id;
      if (!qs(`label[for="${id}"]`) && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
        // Try to find a nearby label text
        const prev = input.previousElementSibling;
        const parent = input.parentElement;
        const labelText = prev?.textContent?.trim() || parent?.querySelector('label, .label')?.textContent?.trim();
        if (labelText) {
          input.setAttribute('aria-label', labelText);
        }
      }
    });

    // Check heading hierarchy — just warn in dev, don't fix automatically
    // as that could break layout
  }

  /* ------------------------------------------------------------------ */
  /*  Focus trap                                                         */
  /* ------------------------------------------------------------------ */

  function trapFocusIn(element) {
    if (!element) return;

    const previousFocus = document.activeElement;

    const focusable = getFocusableElements(element);
    if (focusable.length === 0) {
      element.tabIndex = -1;
      element.focus();
    } else {
      focusable[0].focus();
    }

    const handler = (e) => {
      if (e.key !== 'Tab') return;

      const focusableNow = getFocusableElements(element);
      if (focusableNow.length === 0) return;

      const first = focusableNow[0];
      const last = focusableNow[focusableNow.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    _trapStack.push({ element, previousFocus, handler });
  }

  function releaseFocusFromTop() {
    if (_trapStack.length === 0) return;
    const { previousFocus, handler } = _trapStack.pop();
    document.removeEventListener('keydown', handler, true);
    if (previousFocus && previousFocus.focus) {
      try { previousFocus.focus(); } catch { /* element may be gone */ }
    }
  }

  function releaseAllTraps() {
    while (_trapStack.length > 0) {
      releaseFocusFromTop();
    }
  }

  function getFocusableElements(container) {
    const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [...container.querySelectorAll(sel)].filter(el => el.offsetParent !== null);
  }

  /* ------------------------------------------------------------------ */
  /*  High contrast                                                      */
  /* ------------------------------------------------------------------ */

  function applyHighContrast(enabled) {
    _highContrast = enabled;
    document.documentElement.classList.toggle('a11y-high-contrast', enabled);
  }

  function onContrastChange(mql) {
    applyHighContrast(mql.matches);
  }

  /* ------------------------------------------------------------------ */
  /*  Reduced motion                                                     */
  /* ------------------------------------------------------------------ */

  function applyReducedMotion(enabled) {
    _reducedMotion = enabled;
    document.documentElement.classList.toggle('a11y-reduced-motion', enabled);
  }

  function onMotionChange(mql) {
    applyReducedMotion(mql.matches);
  }

  /* ------------------------------------------------------------------ */
  /*  Mutation observer — re-apply ARIA on DOM changes                   */
  /* ------------------------------------------------------------------ */

  let _ariaDebounceTimer = null;

  function startObserving() {
    if (_mutationObserver) return;

    _mutationObserver = new MutationObserver(() => {
      // Debounce to avoid excessive re-application
      clearTimeout(_ariaDebounceTimer);
      _ariaDebounceTimer = setTimeout(() => {
        applyAriaLabels();
        fixSemanticHtml();
        syncToggleStates();
      }, 200);
    });

    _mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  function stopObserving() {
    if (_mutationObserver) {
      _mutationObserver.disconnect();
      _mutationObserver = null;
    }
    clearTimeout(_ariaDebounceTimer);
  }

  /* ------------------------------------------------------------------ */
  /*  Toggle state sync (aria-checked)                                   */
  /* ------------------------------------------------------------------ */

  function syncToggleStates() {
    qsa('.toggle-switch, .cv-toggle').forEach(toggle => {
      const input = toggle.querySelector('input[type="checkbox"]');
      if (input) {
        toggle.setAttribute('aria-checked', String(input.checked));
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Style injection                                                    */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-a11y-styles';
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function removeStyles() {
    if (_styleEl) {
      _styleEl.remove();
      _styleEl = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    /**
     * Initialize the accessibility layer.
     * Applies ARIA labels, sets up focus styles, live regions,
     * and listens for system preferences (contrast, motion).
     */
    init() {
      if (_active) return;
      _active = true;

      injectStyles();
      createLiveRegions();
      createSkipLink();

      // Mark body so focus-visible styles apply
      document.documentElement.classList.add('a11y-active');

      // Apply ARIA + semantic fixes
      applyAriaLabels();
      fixSemanticHtml();

      // System preference: high contrast
      if (window.matchMedia) {
        _contrastMql = window.matchMedia('(prefers-contrast: more)');
        if (_contrastMql.matches) applyHighContrast(true);
        try { _contrastMql.addEventListener('change', onContrastChange); }
        catch { _contrastMql.addListener(onContrastChange); }

        // System preference: reduced motion
        _motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (_motionMql.matches) applyReducedMotion(true);
        try { _motionMql.addEventListener('change', onMotionChange); }
        catch { _motionMql.addListener(onMotionChange); }
      }

      // Observe DOM changes
      startObserving();
    },

    /**
     * Announce a message to screen readers via live region.
     * @param {string} message - The message to announce.
     * @param {'polite'|'assertive'} [priority='polite'] - Announcement priority.
     */
    announce(message, priority = 'polite') {
      const region = priority === 'assertive' ? _liveRegionAssertive : _liveRegion;
      if (!region) return;
      // Clear first to ensure re-announcement of identical messages
      region.textContent = '';
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    },

    /**
     * Trap focus within an element (e.g., a modal).
     * Supports stacking — multiple traps can be nested.
     * @param {HTMLElement} element - The container to trap focus in.
     */
    trapFocus(element) {
      trapFocusIn(element);
    },

    /**
     * Release the most recent focus trap and restore previous focus.
     */
    releaseFocus() {
      releaseFocusFromTop();
    },

    /**
     * Manually toggle high contrast mode.
     * @param {boolean} enabled
     */
    setHighContrast(enabled) {
      applyHighContrast(enabled);
    },

    /**
     * Get current high contrast state.
     * @returns {boolean}
     */
    getHighContrast() {
      return _highContrast;
    },

    /**
     * Manually toggle reduced motion mode.
     * @param {boolean} enabled
     */
    setReducedMotion(enabled) {
      applyReducedMotion(enabled);
    },

    /**
     * Get current reduced motion state.
     * @returns {boolean}
     */
    getReducedMotion() {
      return _reducedMotion;
    },

    /**
     * Re-apply ARIA labels after dynamic content changes.
     * Normally handled automatically via MutationObserver,
     * but can be called manually for immediate effect.
     */
    refresh() {
      applyAriaLabels();
      fixSemanticHtml();
      syncToggleStates();
    },

    /**
     * Tear down: remove all injected elements, listeners, and styles.
     */
    destroy() {
      if (!_active) return;
      _active = false;

      stopObserving();
      releaseAllTraps();
      removeLiveRegions();
      removeSkipLink();
      removeStyles();

      document.documentElement.classList.remove('a11y-active', 'a11y-high-contrast', 'a11y-reduced-motion');

      if (_contrastMql) {
        try { _contrastMql.removeEventListener('change', onContrastChange); }
        catch { _contrastMql.removeListener(onContrastChange); }
        _contrastMql = null;
      }
      if (_motionMql) {
        try { _motionMql.removeEventListener('change', onMotionChange); }
        catch { _motionMql.removeListener(onMotionChange); }
        _motionMql = null;
      }

      _highContrast = false;
      _reducedMotion = false;
    }
  };

  return api;
})();
