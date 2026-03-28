// ScriptVault — Custom Theme Editor Module
// Provides a visual theme customizer with live preview, color pickers, font
// controls, preset themes (including Nord, Dracula, Solarized, Monokai, Gruvbox),
// and JSON import/export of custom themes.

const ThemeEditor = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_custom_themes';
  const ACTIVE_THEME_KEY = 'sv_active_custom_theme';

  /** All CSS variables that can be themed, grouped by category. */
  const VARIABLE_GROUPS = [
    {
      label: 'Backgrounds',
      vars: [
        { key: '--bg-body',           label: 'Body' },
        { key: '--bg-content',        label: 'Content' },
        { key: '--bg-section-header', label: 'Section Header' },
        { key: '--bg-input',          label: 'Input' },
        { key: '--bg-button',         label: 'Button' },
        { key: '--bg-button-hover',   label: 'Button Hover' },
        { key: '--bg-row-hover',      label: 'Row Hover' },
        { key: '--bg-row-alt',        label: 'Row Alt' },
        { key: '--bg-header',         label: 'Header' },
      ],
    },
    {
      label: 'Text',
      vars: [
        { key: '--text-primary',   label: 'Primary' },
        { key: '--text-secondary', label: 'Secondary' },
        { key: '--text-muted',     label: 'Muted' },
        { key: '--text-on-accent', label: 'On Accent' },
      ],
    },
    {
      label: 'Accents',
      vars: [
        { key: '--accent-primary',   label: 'Primary' },
        { key: '--accent-secondary', label: 'Secondary' },
        { key: '--accent-error',     label: 'Error' },
        { key: '--border-section',   label: 'Section Border' },
      ],
    },
    {
      label: 'Borders & Toggles',
      vars: [
        { key: '--border-color',          label: 'Border' },
        { key: '--toggle-dot',            label: 'Toggle Dot' },
        { key: '--scrollbar-thumb',       label: 'Scrollbar' },
        { key: '--scrollbar-thumb-hover', label: 'Scrollbar Hover' },
      ],
    },
  ];

  /* ------------------------------------------------------------------ */
  /*  Preset Themes                                                      */
  /* ------------------------------------------------------------------ */

  const PRESETS = {
    dark: {
      name: 'Dark',
      vars: {
        '--bg-body': '#1a1a1a', '--bg-content': '#242424', '--bg-section-header': '#2a2a2a',
        '--bg-input': '#1a1a1a', '--bg-button': '#333', '--bg-button-hover': '#444',
        '--bg-row-hover': '#333', '--bg-row-alt': '#222', '--bg-header': '#0d0d0d',
        '--text-primary': '#e0e0e0', '--text-secondary': '#a0a0a0', '--text-muted': '#666',
        '--border-color': '#444', '--border-section': '#22c55e',
        '--accent-primary': '#22c55e', '--accent-secondary': '#60a5fa', '--accent-error': '#ef4444',
        '--text-on-accent': '#fff', '--toggle-dot': '#fff',
        '--scrollbar-thumb': 'rgba(255,255,255,0.15)', '--scrollbar-thumb-hover': 'rgba(255,255,255,0.25)',
      },
    },
    light: {
      name: 'Light',
      vars: {
        '--bg-body': '#f0f0f0', '--bg-content': '#fff', '--bg-section-header': '#f5f5f5',
        '--bg-input': '#fff', '--bg-button': '#e8e8e8', '--bg-button-hover': '#ddd',
        '--bg-row-hover': '#f5f5f5', '--bg-row-alt': '#fafafa', '--bg-header': '#e4e4e4',
        '--text-primary': '#333', '--text-secondary': '#666', '--text-muted': '#999',
        '--border-color': '#ccc', '--border-section': '#16a34a',
        '--accent-primary': '#16a34a', '--accent-secondary': '#2563eb', '--accent-error': '#dc2626',
        '--text-on-accent': '#fff', '--toggle-dot': '#fff',
        '--scrollbar-thumb': 'rgba(0,0,0,0.2)', '--scrollbar-thumb-hover': 'rgba(0,0,0,0.35)',
      },
    },
    catppuccin: {
      name: 'Catppuccin',
      vars: {
        '--bg-body': '#1e1e2e', '--bg-content': '#252536', '--bg-section-header': '#2a2a3c',
        '--bg-input': '#1e1e2e', '--bg-button': '#313244', '--bg-button-hover': '#3b3b52',
        '--bg-row-hover': '#313244', '--bg-row-alt': '#232334', '--bg-header': '#11111b',
        '--text-primary': '#cdd6f4', '--text-secondary': '#a6adc8', '--text-muted': '#585b70',
        '--border-color': '#45475a', '--border-section': '#a6e3a1',
        '--accent-primary': '#a6e3a1', '--accent-secondary': '#89b4fa', '--accent-error': '#f38ba8',
        '--text-on-accent': '#1e1e2e', '--toggle-dot': '#1e1e2e',
        '--scrollbar-thumb': 'rgba(205,214,244,0.15)', '--scrollbar-thumb-hover': 'rgba(205,214,244,0.25)',
      },
    },
    oled: {
      name: 'OLED',
      vars: {
        '--bg-body': '#000000', '--bg-content': '#0a0a0a', '--bg-section-header': '#111111',
        '--bg-input': '#0a0a0a', '--bg-button': '#1a1a1a', '--bg-button-hover': '#252525',
        '--bg-row-hover': '#1a1a1a', '--bg-row-alt': '#0d0d0d', '--bg-header': '#000000',
        '--text-primary': '#e0e0e0', '--text-secondary': '#999', '--text-muted': '#555',
        '--border-color': '#222', '--border-section': '#22c55e',
        '--accent-primary': '#22c55e', '--accent-secondary': '#60a5fa', '--accent-error': '#ef4444',
        '--text-on-accent': '#fff', '--toggle-dot': '#fff',
        '--scrollbar-thumb': 'rgba(255,255,255,0.1)', '--scrollbar-thumb-hover': 'rgba(255,255,255,0.2)',
      },
    },
    nord: {
      name: 'Nord',
      vars: {
        '--bg-body': '#2e3440', '--bg-content': '#3b4252', '--bg-section-header': '#434c5e',
        '--bg-input': '#2e3440', '--bg-button': '#434c5e', '--bg-button-hover': '#4c566a',
        '--bg-row-hover': '#434c5e', '--bg-row-alt': '#353b49', '--bg-header': '#242933',
        '--text-primary': '#eceff4', '--text-secondary': '#d8dee9', '--text-muted': '#7b88a1',
        '--border-color': '#4c566a', '--border-section': '#a3be8c',
        '--accent-primary': '#a3be8c', '--accent-secondary': '#88c0d0', '--accent-error': '#bf616a',
        '--text-on-accent': '#2e3440', '--toggle-dot': '#2e3440',
        '--scrollbar-thumb': 'rgba(236,239,244,0.15)', '--scrollbar-thumb-hover': 'rgba(236,239,244,0.25)',
      },
    },
    dracula: {
      name: 'Dracula',
      vars: {
        '--bg-body': '#282a36', '--bg-content': '#2d303e', '--bg-section-header': '#343746',
        '--bg-input': '#282a36', '--bg-button': '#3a3d4e', '--bg-button-hover': '#44475a',
        '--bg-row-hover': '#3a3d4e', '--bg-row-alt': '#2f3241', '--bg-header': '#21222c',
        '--text-primary': '#f8f8f2', '--text-secondary': '#c0c0c0', '--text-muted': '#6272a4',
        '--border-color': '#44475a', '--border-section': '#50fa7b',
        '--accent-primary': '#50fa7b', '--accent-secondary': '#bd93f9', '--accent-error': '#ff5555',
        '--text-on-accent': '#282a36', '--toggle-dot': '#282a36',
        '--scrollbar-thumb': 'rgba(248,248,242,0.15)', '--scrollbar-thumb-hover': 'rgba(248,248,242,0.25)',
      },
    },
    solarized_dark: {
      name: 'Solarized Dark',
      vars: {
        '--bg-body': '#002b36', '--bg-content': '#073642', '--bg-section-header': '#0a3f4c',
        '--bg-input': '#002b36', '--bg-button': '#0a3f4c', '--bg-button-hover': '#114e5e',
        '--bg-row-hover': '#0a3f4c', '--bg-row-alt': '#05313c', '--bg-header': '#001f27',
        '--text-primary': '#fdf6e3', '--text-secondary': '#93a1a1', '--text-muted': '#586e75',
        '--border-color': '#2d5561', '--border-section': '#859900',
        '--accent-primary': '#859900', '--accent-secondary': '#268bd2', '--accent-error': '#dc322f',
        '--text-on-accent': '#fdf6e3', '--toggle-dot': '#fdf6e3',
        '--scrollbar-thumb': 'rgba(253,246,227,0.15)', '--scrollbar-thumb-hover': 'rgba(253,246,227,0.25)',
      },
    },
    solarized_light: {
      name: 'Solarized Light',
      vars: {
        '--bg-body': '#fdf6e3', '--bg-content': '#eee8d5', '--bg-section-header': '#e8e1cc',
        '--bg-input': '#fdf6e3', '--bg-button': '#e8e1cc', '--bg-button-hover': '#ddd6c1',
        '--bg-row-hover': '#eee8d5', '--bg-row-alt': '#f5efd9', '--bg-header': '#eee8d5',
        '--text-primary': '#073642', '--text-secondary': '#586e75', '--text-muted': '#93a1a1',
        '--border-color': '#d3cbb7', '--border-section': '#859900',
        '--accent-primary': '#859900', '--accent-secondary': '#268bd2', '--accent-error': '#dc322f',
        '--text-on-accent': '#fdf6e3', '--toggle-dot': '#fdf6e3',
        '--scrollbar-thumb': 'rgba(7,54,66,0.2)', '--scrollbar-thumb-hover': 'rgba(7,54,66,0.35)',
      },
    },
    monokai: {
      name: 'Monokai',
      vars: {
        '--bg-body': '#272822', '--bg-content': '#2d2e27', '--bg-section-header': '#353630',
        '--bg-input': '#272822', '--bg-button': '#3e3f38', '--bg-button-hover': '#49483e',
        '--bg-row-hover': '#3e3f38', '--bg-row-alt': '#2f302a', '--bg-header': '#1e1f1a',
        '--text-primary': '#f8f8f2', '--text-secondary': '#c0c0b0', '--text-muted': '#75715e',
        '--border-color': '#49483e', '--border-section': '#a6e22e',
        '--accent-primary': '#a6e22e', '--accent-secondary': '#66d9ef', '--accent-error': '#f92672',
        '--text-on-accent': '#272822', '--toggle-dot': '#272822',
        '--scrollbar-thumb': 'rgba(248,248,242,0.15)', '--scrollbar-thumb-hover': 'rgba(248,248,242,0.25)',
      },
    },
    gruvbox: {
      name: 'Gruvbox',
      vars: {
        '--bg-body': '#282828', '--bg-content': '#3c3836', '--bg-section-header': '#504945',
        '--bg-input': '#282828', '--bg-button': '#504945', '--bg-button-hover': '#665c54',
        '--bg-row-hover': '#504945', '--bg-row-alt': '#32302f', '--bg-header': '#1d2021',
        '--text-primary': '#ebdbb2', '--text-secondary': '#d5c4a1', '--text-muted': '#928374',
        '--border-color': '#504945', '--border-section': '#b8bb26',
        '--accent-primary': '#b8bb26', '--accent-secondary': '#83a598', '--accent-error': '#fb4934',
        '--text-on-accent': '#282828', '--toggle-dot': '#282828',
        '--scrollbar-thumb': 'rgba(235,219,178,0.15)', '--scrollbar-thumb-hover': 'rgba(235,219,178,0.25)',
      },
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _containerEl = null;
  let _panelEl = null;
  let _styleEl = null;
  let _liveStyleEl = null;      // For live-preview overrides
  let _customThemes = {};       // { name: { vars, fonts } }
  let _activePreset = null;     // Currently selected preset key
  let _workingVars = {};        // Current working set of CSS variables
  let _workingFonts = { family: '', size: '', lineHeight: '' };
  let _advancedMode = false;
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Theme Editor Panel */
.sv-te-panel {
  background: var(--bg-content, #242424);
  border: 1px solid var(--border-color, #444);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

/* Header */
.sv-te-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, #444);
  background: var(--bg-section-header, #2a2a2a);
}
.sv-te-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sv-te-header h3 svg { width: 16px; height: 16px; stroke: var(--accent-primary, #22c55e); }

/* Toolbar */
.sv-te-toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-color, #444);
}
.sv-te-toolbar-btn {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-button, #333);
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.sv-te-toolbar-btn:hover { background: var(--bg-button-hover, #444); color: var(--text-primary, #e0e0e0); }
.sv-te-toolbar-btn.active {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
  border-color: var(--accent-primary, #22c55e);
}

/* Body */
.sv-te-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Preset grid */
.sv-te-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}
.sv-te-preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  border: 2px solid var(--border-color, #444);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
}
.sv-te-preset:hover { border-color: var(--text-muted, #666); }
.sv-te-preset.active { border-color: var(--accent-primary, #22c55e); }
.sv-te-preset-swatch {
  width: 100%;
  height: 28px;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
}
.sv-te-preset-swatch span { flex: 1; }
.sv-te-preset-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #a0a0a0);
}

/* Section */
.sv-te-section {
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  overflow: hidden;
}
.sv-te-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-section-header, #2a2a2a);
  cursor: pointer;
  user-select: none;
}
.sv-te-section-header h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin: 0;
}
.sv-te-section-header .sv-te-chevron {
  color: var(--text-muted, #666);
  transition: transform 0.2s;
  font-size: 10px;
}
.sv-te-section.collapsed .sv-te-section-content { display: none; }
.sv-te-section.collapsed .sv-te-chevron { transform: rotate(-90deg); }
.sv-te-section-content {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Color row */
.sv-te-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sv-te-color-row label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  min-width: 110px;
}
.sv-te-color-input {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.sv-te-color-input input[type="color"] {
  width: 32px;
  height: 28px;
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  background: transparent;
}
.sv-te-color-input input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
.sv-te-color-input input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2px; }
.sv-te-color-input input[type="text"] {
  flex: 1;
  padding: 5px 8px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  font-family: 'Consolas', 'Courier New', monospace;
}
.sv-te-color-input input[type="text"]:focus {
  outline: none;
  border-color: var(--accent-primary, #22c55e);
}

/* Font controls */
.sv-te-font-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sv-te-font-row label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  min-width: 90px;
}
.sv-te-font-row input,
.sv-te-font-row select {
  flex: 1;
  padding: 5px 8px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
}
.sv-te-font-row input:focus,
.sv-te-font-row select:focus {
  outline: none;
  border-color: var(--accent-primary, #22c55e);
}

/* Advanced raw editor */
.sv-te-raw-editor {
  width: 100%;
  min-height: 200px;
  padding: 10px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  font-family: 'Consolas', 'Courier New', monospace;
  line-height: 1.6;
  resize: vertical;
}
.sv-te-raw-editor:focus { outline: none; border-color: var(--accent-primary, #22c55e); }

/* Preview card */
.sv-te-preview-card {
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  overflow: hidden;
  font-size: 12px;
}
.sv-te-preview-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sv-te-preview-header span:first-child { font-weight: 600; }
.sv-te-preview-body {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sv-te-preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 4px;
}
.sv-te-preview-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}
.sv-te-preview-toggle {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  position: relative;
}
.sv-te-preview-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 16px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

/* Footer */
.sv-te-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color, #444);
  flex-wrap: wrap;
}
.sv-te-footer-left { display: flex; gap: 6px; }
.sv-te-footer-right { display: flex; gap: 6px; }
.sv-te-btn {
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-button, #333);
  color: var(--text-primary, #e0e0e0);
  transition: all 0.15s;
  white-space: nowrap;
}
.sv-te-btn:hover { background: var(--bg-button-hover, #444); }
.sv-te-btn-primary {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
  border-color: var(--accent-primary, #22c55e);
}
.sv-te-btn-primary:hover { opacity: 0.9; }

/* Save-as dialog */
.sv-te-save-dialog {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-section-header, #2a2a2a);
  border-top: 1px solid var(--border-color, #444);
}
.sv-te-save-dialog input {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
}
.sv-te-save-dialog input:focus { outline: none; border-color: var(--accent-primary, #22c55e); }

/* Custom theme list in presets */
.sv-te-custom-tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--accent-secondary, #60a5fa);
  color: var(--text-on-accent, #fff);
  margin-left: 4px;
}
.sv-te-delete-custom {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border: none;
  background: var(--accent-error, #ef4444);
  color: #fff;
  border-radius: 50%;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}
.sv-te-preset:hover .sv-te-delete-custom { display: flex; }

/* Hidden file input */
.sv-te-file-input { display: none; }
`;

  /* ------------------------------------------------------------------ */
  /*  SVG Icons                                                          */
  /* ------------------------------------------------------------------ */

  const ICON_PALETTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.68 1.5-1.5 0-.38-.14-.73-.38-1A1.49 1.49 0 0 1 13.5 18H14c3.31 0 6-2.69 6-6 0-5.5-4.5-10-8-10z"/></svg>';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  /**
   * Normalize a CSS color value to hex (#rrggbb). Handles rgb(), rgba(), named
   * colors, and hex shorthand via a temporary canvas context.
   */
  function colorToHex(color) {
    if (!color) return '#000000';
    // Already a 6-digit hex
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    // Use canvas for reliable parsing
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    const parsed = ctx.fillStyle; // Always returns #rrggbb or rgba()
    if (parsed.startsWith('#')) return parsed;
    // Parse rgba() output
    const m = parsed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
    }
    return '#000000';
  }

  function toast(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, type);
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function loadCustomThemes() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, ACTIVE_THEME_KEY]);
      _customThemes = data[STORAGE_KEY] || {};
      _activePreset = data[ACTIVE_THEME_KEY] || null;
    } catch {
      _customThemes = {};
      _activePreset = null;
    }
  }

  async function persistCustomThemes() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: _customThemes,
        [ACTIVE_THEME_KEY]: _activePreset,
      });
    } catch (e) {
      console.error('[ThemeEditor] Failed to persist themes:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Live Preview                                                       */
  /* ------------------------------------------------------------------ */

  function applyLivePreview() {
    if (!_liveStyleEl) {
      _liveStyleEl = document.createElement('style');
      _liveStyleEl.id = 'sv-theme-editor-live';
      document.head.appendChild(_liveStyleEl);
    }

    let css = ':root {\n';
    for (const [key, val] of Object.entries(_workingVars)) {
      if (val) css += `  ${key}: ${val} !important;\n`;
    }
    css += '}\n';

    // Font overrides
    if (_workingFonts.family) {
      css += `body { font-family: ${_workingFonts.family} !important; }\n`;
    }
    if (_workingFonts.size) {
      css += `body { font-size: ${_workingFonts.size} !important; }\n`;
    }
    if (_workingFonts.lineHeight) {
      css += `body { line-height: ${_workingFonts.lineHeight} !important; }\n`;
    }

    _liveStyleEl.textContent = css;

    // Update preview card
    renderPreviewCard();
  }

  function removeLivePreview() {
    if (_liveStyleEl) {
      _liveStyleEl.remove();
      _liveStyleEl = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Read current CSS variables from :root                              */
  /* ------------------------------------------------------------------ */

  function readCurrentVars() {
    const computed = getComputedStyle(document.documentElement);
    const vars = {};
    for (const group of VARIABLE_GROUPS) {
      for (const v of group.vars) {
        vars[v.key] = computed.getPropertyValue(v.key).trim();
      }
    }
    return vars;
  }

  /* ------------------------------------------------------------------ */
  /*  Build Panel UI                                                     */
  /* ------------------------------------------------------------------ */

  function buildPanel() {
    if (_panelEl) _panelEl.remove();

    const panel = el('div', { className: 'sv-te-panel' });

    // Header
    const header = el('div', { className: 'sv-te-header' }, [
      el('h3', { innerHTML: `${ICON_PALETTE} Theme Editor` }),
    ]);
    panel.appendChild(header);

    // Toolbar
    const toolbar = el('div', { className: 'sv-te-toolbar' });
    const btnAdvanced = el('button', {
      className: `sv-te-toolbar-btn${_advancedMode ? ' active' : ''}`,
      textContent: 'Raw CSS Variables',
      onClick: () => toggleAdvancedMode(btnAdvanced),
    });
    toolbar.appendChild(btnAdvanced);
    panel.appendChild(toolbar);

    // Body
    const body = el('div', { className: 'sv-te-body', id: 'sv-te-body' });

    // Presets
    body.appendChild(buildPresetsSection());

    // Visual editor sections OR raw editor
    const editorContainer = el('div', { id: 'sv-te-editor-container' });
    if (_advancedMode) {
      editorContainer.appendChild(buildRawEditor());
    } else {
      for (const group of VARIABLE_GROUPS) {
        editorContainer.appendChild(buildColorSection(group));
      }
      editorContainer.appendChild(buildFontSection());
    }
    body.appendChild(editorContainer);

    // Preview card
    body.appendChild(buildPreviewCardEl());

    panel.appendChild(body);

    // Save-as dialog (hidden initially)
    const saveDialog = el('div', { className: 'sv-te-save-dialog', id: 'sv-te-save-dialog', style: 'display:none' });
    saveDialog.innerHTML = `
      <input type="text" id="sv-te-save-name" placeholder="Custom theme name...">
      <button class="sv-te-btn sv-te-btn-primary" id="sv-te-save-confirm">Save</button>
      <button class="sv-te-btn" id="sv-te-save-cancel">Cancel</button>
    `;
    panel.appendChild(saveDialog);

    // Footer
    const footer = el('div', { className: 'sv-te-footer' });

    const footerLeft = el('div', { className: 'sv-te-footer-left' });
    footerLeft.appendChild(el('button', { className: 'sv-te-btn', textContent: 'Export JSON', onClick: exportToClipboard }));
    footerLeft.appendChild(el('button', { className: 'sv-te-btn', textContent: 'Import JSON', onClick: startImport }));

    const footerRight = el('div', { className: 'sv-te-footer-right' });
    footerRight.appendChild(el('button', { className: 'sv-te-btn', textContent: 'Save as Custom', onClick: showSaveDialog }));
    footerRight.appendChild(el('button', { className: 'sv-te-btn sv-te-btn-primary', textContent: 'Apply Theme', onClick: applyAndPersist }));

    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);
    panel.appendChild(footer);

    // Hidden file input for import
    const fileInput = el('input', { type: 'file', accept: '.json', className: 'sv-te-file-input', id: 'sv-te-file-input' });
    fileInput.addEventListener('change', handleFileImport);
    panel.appendChild(fileInput);

    _panelEl = panel;

    // Bind save-dialog buttons
    setTimeout(() => {
      _panelEl.querySelector('#sv-te-save-confirm')?.addEventListener('click', confirmSave);
      _panelEl.querySelector('#sv-te-save-cancel')?.addEventListener('click', hideSaveDialog);
    }, 0);

    return panel;
  }

  /* ------------------------------------------------------------------ */
  /*  Presets Section                                                     */
  /* ------------------------------------------------------------------ */

  function buildPresetsSection() {
    const section = el('div', { className: 'sv-te-section' });

    const header = el('div', { className: 'sv-te-section-header' });
    header.innerHTML = '<h4>Presets</h4><span class="sv-te-chevron">&#9660;</span>';
    header.addEventListener('click', () => section.classList.toggle('collapsed'));
    section.appendChild(header);

    const content = el('div', { className: 'sv-te-section-content' });
    const grid = el('div', { className: 'sv-te-presets', id: 'sv-te-presets-grid' });

    // Built-in presets
    for (const [key, preset] of Object.entries(PRESETS)) {
      grid.appendChild(buildPresetCard(key, preset, false));
    }

    // Custom presets
    for (const [name, theme] of Object.entries(_customThemes)) {
      grid.appendChild(buildPresetCard(`custom:${name}`, { name, vars: theme.vars }, true));
    }

    content.appendChild(grid);
    section.appendChild(content);
    return section;
  }

  function buildPresetCard(key, preset, isCustom) {
    const card = el('div', {
      className: `sv-te-preset${_activePreset === key ? ' active' : ''}`,
      'data-preset': key,
      style: 'position:relative',
    });

    // Color swatch (show 5 key colors)
    const swatch = el('div', { className: 'sv-te-preset-swatch' });
    const swatchColors = [
      preset.vars['--bg-body'],
      preset.vars['--bg-header'],
      preset.vars['--accent-primary'],
      preset.vars['--accent-secondary'],
      preset.vars['--text-primary'],
    ];
    for (const c of swatchColors) {
      swatch.appendChild(el('span', { style: `background:${c}` }));
    }
    card.appendChild(swatch);

    const labelEl = el('span', { className: 'sv-te-preset-label' });
    labelEl.textContent = preset.name;
    if (isCustom) {
      labelEl.innerHTML += ' <span class="sv-te-custom-tag">custom</span>';
    }
    card.appendChild(labelEl);

    if (isCustom) {
      const delBtn = el('button', { className: 'sv-te-delete-custom', textContent: 'x' });
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomTheme(key.replace('custom:', ''));
      });
      card.appendChild(delBtn);
    }

    card.addEventListener('click', () => selectPreset(key));
    return card;
  }

  function selectPreset(key) {
    _activePreset = key;

    let vars;
    if (key.startsWith('custom:')) {
      const name = key.slice(7);
      const theme = _customThemes[name];
      if (!theme) return;
      vars = { ...theme.vars };
      _workingFonts = { ...(theme.fonts || { family: '', size: '', lineHeight: '' }) };
    } else {
      const preset = PRESETS[key];
      if (!preset) return;
      vars = { ...preset.vars };
      _workingFonts = { family: '', size: '', lineHeight: '' };
    }

    _workingVars = vars;
    applyLivePreview();
    refreshEditorInputs();

    // Update active state on cards
    _panelEl?.querySelectorAll('.sv-te-preset').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === key);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Color Sections                                                     */
  /* ------------------------------------------------------------------ */

  function buildColorSection(group) {
    const section = el('div', { className: 'sv-te-section' });

    const header = el('div', { className: 'sv-te-section-header' });
    header.innerHTML = `<h4>${group.label}</h4><span class="sv-te-chevron">&#9660;</span>`;
    header.addEventListener('click', () => section.classList.toggle('collapsed'));
    section.appendChild(header);

    const content = el('div', { className: 'sv-te-section-content' });

    for (const v of group.vars) {
      const row = el('div', { className: 'sv-te-color-row' });
      const label = el('label', { textContent: v.label });
      const inputWrap = el('div', { className: 'sv-te-color-input' });

      const currentVal = _workingVars[v.key] || '';
      const hexVal = colorToHex(currentVal);

      const colorPicker = el('input', {
        type: 'color',
        value: hexVal,
        'data-var': v.key,
      });
      const textInput = el('input', {
        type: 'text',
        value: currentVal,
        'data-var': v.key,
        placeholder: v.key,
      });

      colorPicker.addEventListener('input', () => {
        textInput.value = colorPicker.value;
        _workingVars[v.key] = colorPicker.value;
        applyLivePreview();
      });

      textInput.addEventListener('input', () => {
        _workingVars[v.key] = textInput.value;
        // Try to update color picker
        const hex = colorToHex(textInput.value);
        if (hex !== '#000000' || textInput.value.toLowerCase().includes('000')) {
          colorPicker.value = hex;
        }
        applyLivePreview();
      });

      inputWrap.appendChild(colorPicker);
      inputWrap.appendChild(textInput);
      row.appendChild(label);
      row.appendChild(inputWrap);
      content.appendChild(row);
    }

    section.appendChild(content);
    return section;
  }

  /* ------------------------------------------------------------------ */
  /*  Font Section                                                       */
  /* ------------------------------------------------------------------ */

  function buildFontSection() {
    const section = el('div', { className: 'sv-te-section' });

    const header = el('div', { className: 'sv-te-section-header' });
    header.innerHTML = '<h4>Fonts</h4><span class="sv-te-chevron">&#9660;</span>';
    header.addEventListener('click', () => section.classList.toggle('collapsed'));
    section.appendChild(header);

    const content = el('div', { className: 'sv-te-section-content' });

    // Font family
    const familyRow = el('div', { className: 'sv-te-font-row' });
    familyRow.innerHTML = `<label>Family</label>`;
    const familySelect = el('select', { id: 'sv-te-font-family' });
    const families = [
      { value: '', label: 'Default (Inter)' },
      { value: "'Inter', sans-serif", label: 'Inter' },
      { value: "'Roboto', sans-serif", label: 'Roboto' },
      { value: "'Source Sans Pro', sans-serif", label: 'Source Sans Pro' },
      { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
      { value: "'Fira Code', monospace", label: 'Fira Code' },
      { value: "'SF Mono', monospace", label: 'SF Mono' },
      { value: "system-ui, sans-serif", label: 'System UI' },
      { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
    ];
    for (const f of families) {
      const opt = el('option', { value: f.value, textContent: f.label });
      if (_workingFonts.family === f.value) opt.selected = true;
      familySelect.appendChild(opt);
    }
    familySelect.addEventListener('change', () => {
      _workingFonts.family = familySelect.value;
      applyLivePreview();
    });
    familyRow.appendChild(familySelect);
    content.appendChild(familyRow);

    // Font size
    const sizeRow = el('div', { className: 'sv-te-font-row' });
    sizeRow.innerHTML = '<label>Size</label>';
    const sizeInput = el('input', {
      type: 'text',
      id: 'sv-te-font-size',
      value: _workingFonts.size,
      placeholder: 'e.g. 14px, 0.875rem',
    });
    sizeInput.addEventListener('input', () => {
      _workingFonts.size = sizeInput.value;
      applyLivePreview();
    });
    sizeRow.appendChild(sizeInput);
    content.appendChild(sizeRow);

    // Line height
    const lhRow = el('div', { className: 'sv-te-font-row' });
    lhRow.innerHTML = '<label>Line Height</label>';
    const lhInput = el('input', {
      type: 'text',
      id: 'sv-te-line-height',
      value: _workingFonts.lineHeight,
      placeholder: 'e.g. 1.5, 1.6',
    });
    lhInput.addEventListener('input', () => {
      _workingFonts.lineHeight = lhInput.value;
      applyLivePreview();
    });
    lhRow.appendChild(lhInput);
    content.appendChild(lhRow);

    section.appendChild(content);
    return section;
  }

  /* ------------------------------------------------------------------ */
  /*  Raw CSS Variable Editor                                            */
  /* ------------------------------------------------------------------ */

  function buildRawEditor() {
    const container = el('div');
    const label = el('p', {
      textContent: 'Edit raw CSS variable overrides (one per line: --var-name: value;)',
      style: 'font-size:12px;color:var(--text-muted);margin-bottom:8px',
    });
    container.appendChild(label);

    let rawText = '';
    for (const [key, val] of Object.entries(_workingVars)) {
      if (val) rawText += `${key}: ${val};\n`;
    }
    if (_workingFonts.family) rawText += `/* font-family: ${_workingFonts.family} */\n`;
    if (_workingFonts.size) rawText += `/* font-size: ${_workingFonts.size} */\n`;
    if (_workingFonts.lineHeight) rawText += `/* line-height: ${_workingFonts.lineHeight} */\n`;

    const textarea = el('textarea', {
      className: 'sv-te-raw-editor',
      id: 'sv-te-raw-textarea',
      value: rawText,
    });
    textarea.textContent = rawText;
    textarea.addEventListener('input', () => parseRawEditor(textarea.value));
    container.appendChild(textarea);

    return container;
  }

  function parseRawEditor(text) {
    const newVars = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('/*')) continue;
      const match = trimmed.match(/^(--[\w-]+)\s*:\s*(.+?);?\s*$/);
      if (match) {
        newVars[match[1]] = match[2];
      }
    }
    _workingVars = { ..._workingVars, ...newVars };
    applyLivePreview();
  }

  function toggleAdvancedMode(btnEl) {
    _advancedMode = !_advancedMode;
    btnEl.classList.toggle('active', _advancedMode);

    const container = _panelEl?.querySelector('#sv-te-editor-container');
    if (!container) return;
    container.innerHTML = '';

    if (_advancedMode) {
      container.appendChild(buildRawEditor());
    } else {
      for (const group of VARIABLE_GROUPS) {
        container.appendChild(buildColorSection(group));
      }
      container.appendChild(buildFontSection());
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Preview Card                                                       */
  /* ------------------------------------------------------------------ */

  function buildPreviewCardEl() {
    const wrapper = el('div', { className: 'sv-te-section' });

    const header = el('div', { className: 'sv-te-section-header' });
    header.innerHTML = '<h4>Preview</h4><span class="sv-te-chevron">&#9660;</span>';
    header.addEventListener('click', () => wrapper.classList.toggle('collapsed'));
    wrapper.appendChild(header);

    const content = el('div', { className: 'sv-te-section-content' });
    content.appendChild(el('div', { id: 'sv-te-preview-card' }));
    wrapper.appendChild(content);

    return wrapper;
  }

  function renderPreviewCard() {
    const container = _panelEl?.querySelector('#sv-te-preview-card');
    if (!container) return;

    const v = _workingVars;
    const bg = v['--bg-body'] || '#1a1a1a';
    const bgHeader = v['--bg-header'] || '#0d0d0d';
    const bgRow = v['--bg-row-hover'] || '#333';
    const textPrimary = v['--text-primary'] || '#e0e0e0';
    const textSecondary = v['--text-secondary'] || '#a0a0a0';
    const textMuted = v['--text-muted'] || '#666';
    const accent = v['--accent-primary'] || '#22c55e';
    const accentSecondary = v['--accent-secondary'] || '#60a5fa';
    const accentError = v['--accent-error'] || '#ef4444';
    const border = v['--border-color'] || '#444';
    const toggleDot = v['--toggle-dot'] || '#fff';

    container.innerHTML = `
      <div class="sv-te-preview-card" style="border-color:${border}">
        <div class="sv-te-preview-header" style="background:${bgHeader};color:${textPrimary}">
          <span>ScriptVault Preview</span>
          <span style="color:${accent};font-size:11px;font-weight:600">v2.0</span>
        </div>
        <div class="sv-te-preview-body" style="background:${bg}">
          <div class="sv-te-preview-row" style="background:${bgRow};border-radius:4px">
            <span style="color:${textPrimary};font-size:12px">My Userscript</span>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="sv-te-preview-badge" style="background:${accent};color:${toggleDot}">Active</span>
              <div class="sv-te-preview-toggle" style="background:${accent}">
                <div style="position:absolute;top:2px;left:16px;width:14px;height:14px;border-radius:50%;background:${toggleDot}"></div>
              </div>
            </div>
          </div>
          <div class="sv-te-preview-row" style="border-bottom:1px solid ${border}">
            <span style="color:${textSecondary};font-size:11px">Last updated: Today</span>
            <span style="color:${accentSecondary};font-size:11px">example.com</span>
          </div>
          <div style="display:flex;gap:6px;padding:4px 0">
            <span class="sv-te-preview-badge" style="background:${accent};color:${toggleDot}">GM_API</span>
            <span class="sv-te-preview-badge" style="background:${accentSecondary};color:${toggleDot}">CSS</span>
            <span class="sv-te-preview-badge" style="background:${accentError};color:#fff">Error</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span style="color:${textMuted};font-size:10px">3 scripts installed</span>
            <span style="color:${textMuted};font-size:10px">12.4 KB</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Refresh editor inputs from _workingVars                            */
  /* ------------------------------------------------------------------ */

  function refreshEditorInputs() {
    if (_advancedMode) {
      const textarea = _panelEl?.querySelector('#sv-te-raw-textarea');
      if (textarea) {
        let rawText = '';
        for (const [key, val] of Object.entries(_workingVars)) {
          if (val) rawText += `${key}: ${val};\n`;
        }
        textarea.value = rawText;
      }
    } else {
      // Update color pickers and text inputs
      _panelEl?.querySelectorAll('.sv-te-color-input input[data-var]').forEach(input => {
        const key = input.dataset.var;
        const val = _workingVars[key] || '';
        if (input.type === 'color') {
          input.value = colorToHex(val);
        } else {
          input.value = val;
        }
      });

      // Update font controls
      const familySelect = _panelEl?.querySelector('#sv-te-font-family');
      if (familySelect) familySelect.value = _workingFonts.family || '';
      const sizeInput = _panelEl?.querySelector('#sv-te-font-size');
      if (sizeInput) sizeInput.value = _workingFonts.size || '';
      const lhInput = _panelEl?.querySelector('#sv-te-line-height');
      if (lhInput) lhInput.value = _workingFonts.lineHeight || '';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Save / Import / Export                                             */
  /* ------------------------------------------------------------------ */

  function showSaveDialog() {
    const dialog = _panelEl?.querySelector('#sv-te-save-dialog');
    if (dialog) dialog.style.display = 'flex';
    const input = _panelEl?.querySelector('#sv-te-save-name');
    if (input) { input.value = ''; input.focus(); }
  }

  function hideSaveDialog() {
    const dialog = _panelEl?.querySelector('#sv-te-save-dialog');
    if (dialog) dialog.style.display = 'none';
  }

  async function confirmSave() {
    const input = _panelEl?.querySelector('#sv-te-save-name');
    const name = input?.value?.trim();
    if (!name) { toast('Please enter a theme name', 'error'); return; }

    _customThemes[name] = {
      vars: { ..._workingVars },
      fonts: { ..._workingFonts },
    };
    _activePreset = `custom:${name}`;
    await persistCustomThemes();
    hideSaveDialog();
    rebuildPresets();
    toast(`Theme "${name}" saved`);
  }

  async function deleteCustomTheme(name) {
    delete _customThemes[name];
    if (_activePreset === `custom:${name}`) _activePreset = null;
    await persistCustomThemes();
    rebuildPresets();
    toast(`Theme "${name}" deleted`);
  }

  function rebuildPresets() {
    const grid = _panelEl?.querySelector('#sv-te-presets-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const [key, preset] of Object.entries(PRESETS)) {
      grid.appendChild(buildPresetCard(key, preset, false));
    }
    for (const [name, theme] of Object.entries(_customThemes)) {
      grid.appendChild(buildPresetCard(`custom:${name}`, { name, vars: theme.vars }, true));
    }
  }

  function exportToClipboard() {
    const theme = {
      name: 'ScriptVault Custom Theme',
      vars: { ..._workingVars },
      fonts: { ..._workingFonts },
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(theme, null, 2);

    navigator.clipboard.writeText(json).then(() => {
      toast('Theme JSON copied to clipboard');
    }).catch(() => {
      // Fallback: download as file
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scriptvault-theme.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Theme exported as file');
    });
  }

  function startImport() {
    const fileInput = _panelEl?.querySelector('#sv-te-file-input');
    if (fileInput) fileInput.click();
  }

  function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const theme = JSON.parse(reader.result);
        importThemeData(theme);
      } catch {
        toast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for re-import
  }

  function importThemeData(theme) {
    if (!theme || typeof theme !== 'object') {
      toast('Invalid theme data', 'error');
      return false;
    }

    if (theme.vars && typeof theme.vars === 'object') {
      _workingVars = { ..._workingVars, ...theme.vars };
    }
    if (theme.fonts && typeof theme.fonts === 'object') {
      _workingFonts = { ...theme.fonts };
    }

    applyLivePreview();
    refreshEditorInputs();
    toast('Theme imported');
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Apply Theme Permanently                                            */
  /* ------------------------------------------------------------------ */

  async function applyAndPersist() {
    // Apply variables directly to :root (they're already applied via live preview)
    for (const [key, val] of Object.entries(_workingVars)) {
      if (val) document.documentElement.style.setProperty(key, val);
    }

    await persistCustomThemes();

    // Also store as a setting if a built-in theme key was selected
    if (_activePreset && !_activePreset.startsWith('custom:') && PRESETS[_activePreset]) {
      try {
        // Use the dashboard's saveSetting if available
        if (typeof saveSetting === 'function') {
          await saveSetting('layout', _activePreset);
        } else {
          await chrome.runtime.sendMessage({
            action: 'setSettings',
            settings: { layout: _activePreset },
          });
          document.documentElement.setAttribute('data-theme', _activePreset);
        }
      } catch { /* ignore */ }
    }

    toast('Theme applied');
  }

  /* ------------------------------------------------------------------ */
  /*  Inject / Remove Styles                                             */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-theme-editor-styles';
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function removeStyles() {
    _styleEl?.remove();
    _styleEl = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialize the Theme Editor.
     * @param {HTMLElement} containerEl - Element to render the editor panel inside.
     */
    async init(containerEl) {
      if (_initialized) return;
      _initialized = true;
      _containerEl = containerEl;

      injectStyles();
      await loadCustomThemes();

      // Read current variables as the working set
      _workingVars = readCurrentVars();

      const panel = buildPanel();
      if (_containerEl) {
        _containerEl.appendChild(panel);
      }

      // Render initial preview
      renderPreviewCard();
    },

    /**
     * Apply a theme by preset key or theme object.
     * @param {string|object} theme - Preset key ('dark','nord', etc.) or theme object { vars, fonts }
     */
    applyTheme(theme) {
      if (typeof theme === 'string') {
        if (PRESETS[theme]) {
          _workingVars = { ...PRESETS[theme].vars };
          _workingFonts = { family: '', size: '', lineHeight: '' };
          _activePreset = theme;
        } else if (_customThemes[theme]) {
          _workingVars = { ..._customThemes[theme].vars };
          _workingFonts = { ...(_customThemes[theme].fonts || { family: '', size: '', lineHeight: '' }) };
          _activePreset = `custom:${theme}`;
        }
      } else if (theme && typeof theme === 'object') {
        if (theme.vars) _workingVars = { ..._workingVars, ...theme.vars };
        if (theme.fonts) _workingFonts = { ...theme.fonts };
      }

      applyLivePreview();
      refreshEditorInputs();
    },

    /**
     * Export the current working theme as a JSON string.
     * @returns {string}
     */
    exportTheme() {
      return JSON.stringify({
        name: 'ScriptVault Custom Theme',
        vars: { ..._workingVars },
        fonts: { ..._workingFonts },
        exportedAt: new Date().toISOString(),
      }, null, 2);
    },

    /**
     * Import a theme from a JSON string or object.
     * @param {string|object} json
     * @returns {boolean} success
     */
    importTheme(json) {
      let theme = json;
      if (typeof json === 'string') {
        try { theme = JSON.parse(json); } catch { return false; }
      }
      return importThemeData(theme);
    },

    /**
     * Get all saved custom themes.
     * @returns {object}
     */
    getCustomThemes() {
      return JSON.parse(JSON.stringify(_customThemes));
    },

    /**
     * Get the list of built-in preset keys.
     * @returns {string[]}
     */
    getPresetKeys() {
      return Object.keys(PRESETS);
    },

    /**
     * Get a specific preset by key.
     * @param {string} key
     * @returns {object|null}
     */
    getPreset(key) {
      return PRESETS[key] ? JSON.parse(JSON.stringify(PRESETS[key])) : null;
    },

    /**
     * Tear down the editor: remove panel, styles, live preview.
     */
    destroy() {
      removeLivePreview();
      removeStyles();
      _panelEl?.remove();
      _panelEl = null;
      _containerEl = null;
      _customThemes = {};
      _workingVars = {};
      _workingFonts = { family: '', size: '', lineHeight: '' };
      _activePreset = null;
      _advancedMode = false;
      _initialized = false;
    },
  };
})();
