// ScriptVault — Gamification System
// Achievements, streaks, badges, and profile cards to encourage engagement.

const Gamification = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'gamification';
  const STYLE_ID = 'sv-gamification-styles';
  const TOAST_DURATION = 4500;
  const DAY_MS = 86400000;

  /* ------------------------------------------------------------------ */
  /*  Level Definitions                                                  */
  /* ------------------------------------------------------------------ */

  const LEVELS = [
    { name: 'Novice',     icon: '\u2726', minPts: 0 },
    { name: 'Scripter',   icon: '\u270E', minPts: 50 },
    { name: 'Power User', icon: '\u26A1', minPts: 150 },
    { name: 'Expert',     icon: '\u2605', minPts: 350 },
    { name: 'Master',     icon: '\u2666', minPts: 600 },
    { name: 'Legend',     icon: '\u265B', minPts: 1000 }
  ];

  /* ------------------------------------------------------------------ */
  /*  Achievement Definitions                                            */
  /* ------------------------------------------------------------------ */

  const ACHIEVEMENTS = [
    // Getting Started
    { id: 'gs_install_first',   cat: 'Getting Started', name: 'First Steps',          desc: 'Install your first script',                   pts: 5,  icon: '\uD83D\uDCE5', check: d => (d.scriptsInstalled || 0) >= 1 },
    { id: 'gs_create_first',    cat: 'Getting Started', name: 'Hello World',           desc: 'Create your first script',                    pts: 5,  icon: '\u270D\uFE0F',  check: d => (d.scriptsCreated || 0) >= 1 },
    { id: 'gs_enable_5',        cat: 'Getting Started', name: 'Five Alive',            desc: 'Enable 5 scripts at once',                    pts: 10, icon: '\u2705',        check: d => (d.scriptsEnabled || 0) >= 5 },

    // Power User
    { id: 'pu_install_10',      cat: 'Power User', name: 'Collector',                  desc: 'Install 10 scripts',                          pts: 15, icon: '\uD83D\uDCDA', target: 10, progress: d => Math.min(d.scriptsInstalled || 0, 10), check: d => (d.scriptsInstalled || 0) >= 10 },
    { id: 'pu_install_25',      cat: 'Power User', name: 'Hoarder',                    desc: 'Install 25 scripts',                          pts: 25, icon: '\uD83D\uDCE6', target: 25, progress: d => Math.min(d.scriptsInstalled || 0, 25), check: d => (d.scriptsInstalled || 0) >= 25 },
    { id: 'pu_install_50',      cat: 'Power User', name: 'Script Vault',               desc: 'Install 50 scripts',                          pts: 50, icon: '\uD83C\uDFE6', target: 50, progress: d => Math.min(d.scriptsInstalled || 0, 50), check: d => (d.scriptsInstalled || 0) >= 50 },

    // Creator
    { id: 'cr_100_lines',       cat: 'Creator', name: 'Centurion',                     desc: 'Write a 100-line script',                     pts: 15, icon: '\uD83D\uDCDD', check: d => (d.maxScriptLines || 0) >= 100 },
    { id: 'cr_500_lines',       cat: 'Creator', name: 'Novelist',                      desc: 'Write a 500-line script',                     pts: 30, icon: '\uD83D\uDCD6', check: d => (d.maxScriptLines || 0) >= 500 },
    { id: 'cr_gm_apis_5',       cat: 'Creator', name: 'API Explorer',                  desc: 'Use 5 different GM APIs in scripts',          pts: 20, icon: '\uD83D\uDD27', target: 5, progress: d => Math.min(d.gmApisUsed || 0, 5), check: d => (d.gmApisUsed || 0) >= 5 },

    // Explorer
    { id: 'ex_all_tabs',        cat: 'Explorer', name: 'Tourist',                      desc: 'Visit every dashboard tab',                   pts: 10, icon: '\uD83D\uDDFA\uFE0F', check: d => (d.tabsVisited || 0) >= (d.totalTabs || 5) },
    { id: 'ex_cmd_palette',     cat: 'Explorer', name: 'Commander',                    desc: 'Use the command palette',                     pts: 5,  icon: '\u2328\uFE0F', check: d => !!d.usedCommandPalette },
    { id: 'ex_kb_shortcuts',    cat: 'Explorer', name: 'Shortcutter',                  desc: 'Use 5 different keyboard shortcuts',          pts: 10, icon: '\u2328', target: 5, progress: d => Math.min(d.shortcutsUsed || 0, 5), check: d => (d.shortcutsUsed || 0) >= 5 },

    // Social
    { id: 'so_share',           cat: 'Social', name: 'Sharer',                         desc: 'Share a script with someone',                 pts: 10, icon: '\uD83D\uDCE4', check: d => !!d.sharedScript },
    { id: 'so_gist',            cat: 'Social', name: 'Gist Master',                    desc: 'Export a script to GitHub Gist',              pts: 15, icon: '\uD83D\uDC19', check: d => !!d.exportedGist },
    { id: 'so_template',        cat: 'Social', name: 'Template User',                  desc: 'Create a script from a template',             pts: 10, icon: '\uD83D\uDCC4', check: d => !!d.usedTemplate },

    // Maintenance
    { id: 'mn_update',          cat: 'Maintenance', name: 'Updater',                   desc: 'Update a script to a newer version',          pts: 10, icon: '\uD83D\uDD04', check: d => !!d.updatedScript },
    { id: 'mn_check_updates',   cat: 'Maintenance', name: 'Vigilant',                  desc: 'Check for script updates',                    pts: 5,  icon: '\uD83D\uDD0D', check: d => !!d.checkedUpdates },
    { id: 'mn_backup',          cat: 'Maintenance', name: 'Safety First',              desc: 'Create a backup of your scripts',             pts: 15, icon: '\uD83D\uDCBE', check: d => !!d.createdBackup },

    // Performance
    { id: 'pf_fast',            cat: 'Performance', name: 'Speed Demon',               desc: 'All scripts avg under 50ms execution',        pts: 25, icon: '\u26A1',       check: d => !!d.allScriptsFast },
    { id: 'pf_fix_error',       cat: 'Performance', name: 'Bug Squasher',              desc: 'Fix an error in a script',                    pts: 15, icon: '\uD83D\uDC1B', check: d => !!d.fixedError },
    { id: 'pf_clear_log',       cat: 'Performance', name: 'Clean Slate',               desc: 'Clear the error log',                         pts: 5,  icon: '\uD83E\uDDF9', check: d => !!d.clearedErrorLog },

    // Collector
    { id: 'cl_5_domains',       cat: 'Collector', name: 'Domain Hopper',               desc: 'Install scripts from 5 different domains',    pts: 20, icon: '\uD83C\uDF10', target: 5, progress: d => Math.min(d.installDomains || 0, 5), check: d => (d.installDomains || 0) >= 5 },
    { id: 'cl_10_sites',        cat: 'Collector', name: 'Web Surfer',                  desc: 'Have scripts targeting 10 different sites',   pts: 25, icon: '\uD83C\uDFC4', target: 10, progress: d => Math.min(d.targetSites || 0, 10), check: d => (d.targetSites || 0) >= 10 },

    // Veteran
    { id: 'vt_7_days',          cat: 'Veteran', name: 'Weekly Regular',                desc: 'Use ScriptVault for 7 days',                  pts: 10, icon: '\uD83D\uDCC5', target: 7,   progress: d => Math.min(d.daysActive || 0, 7),   check: d => (d.daysActive || 0) >= 7 },
    { id: 'vt_30_days',         cat: 'Veteran', name: 'Monthly Devotee',               desc: 'Use ScriptVault for 30 days',                 pts: 25, icon: '\uD83D\uDCC6', target: 30,  progress: d => Math.min(d.daysActive || 0, 30),  check: d => (d.daysActive || 0) >= 30 },
    { id: 'vt_90_days',         cat: 'Veteran', name: 'Quarterly Veteran',             desc: 'Use ScriptVault for 90 days',                 pts: 50, icon: '\uD83C\uDFC6', target: 90,  progress: d => Math.min(d.daysActive || 0, 90),  check: d => (d.daysActive || 0) >= 90 },
    { id: 'vt_365_days',        cat: 'Veteran', name: 'Yearly Legend',                 desc: 'Use ScriptVault for 365 days',                pts: 100,icon: '\uD83D\uDC8E', target: 365, progress: d => Math.min(d.daysActive || 0, 365), check: d => (d.daysActive || 0) >= 365 },

    // Special (Easter Eggs)
    { id: 'sp_konami',          cat: 'Special', name: 'Konami Coder',                  desc: '???',                                         pts: 15, icon: '\uD83C\uDFAE', hidden: true, check: d => !!d.konamiEntered },
    { id: 'sp_midnight',        cat: 'Special', name: 'Night Owl',                     desc: '???',                                         pts: 10, icon: '\uD83E\uDD89', hidden: true, check: d => !!d.midnightUse },
    { id: 'sp_100_clicks',      cat: 'Special', name: 'Click Frenzy',                  desc: '???',                                         pts: 5,  icon: '\uD83D\uDDB1\uFE0F', hidden: true, check: d => (d.logoClicks || 0) >= 100 }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _data = null;       // persisted gamification state
  let _initialized = false;
  let _toastQueue = [];
  let _toastActive = false;
  let _konamiBuffer = [];
  const KONAMI = 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a';

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Gamification Layout */
.sv-gam-wrap {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 8px 0;
}

/* Profile Card */
.sv-gam-profile {
  display: flex;
  align-items: center;
  gap: 18px;
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 10px;
  padding: 18px 22px;
}
.sv-gam-profile-badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: linear-gradient(135deg, var(--accent-green-dark, #22c55e), var(--accent-blue, #60a5fa));
  flex-shrink: 0;
}
.sv-gam-profile-info { flex: 1; }
.sv-gam-profile-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
}
.sv-gam-profile-level {
  font-size: 13px;
  color: var(--accent-green, #4ade80);
  margin-top: 2px;
}
.sv-gam-profile-stats {
  display: flex;
  gap: 18px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
}
.sv-gam-profile-stats span { white-space: nowrap; }
.sv-gam-profile-stats strong {
  color: var(--text-primary, #e0e0e0);
}
.sv-gam-profile-xp-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-input, #333);
  margin-top: 8px;
  overflow: hidden;
}
.sv-gam-profile-xp-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent-green, #4ade80), var(--accent-blue, #60a5fa));
  transition: width 0.6s ease;
}
.sv-gam-share-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.sv-gam-share-btn:hover {
  background: var(--bg-row-hover, #333);
  color: var(--text-primary, #e0e0e0);
}

/* Streaks */
.sv-gam-streaks {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.sv-gam-streak-card {
  flex: 1;
  min-width: 180px;
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 14px 16px;
}
.sv-gam-streak-label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 6px;
}
.sv-gam-streak-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent-yellow, #fbbf24);
}
.sv-gam-streak-value.fire::after { content: ' \uD83D\uDD25'; font-size: 22px; }
.sv-gam-streak-sub {
  font-size: 11px;
  color: var(--text-muted, #707070);
  margin-top: 4px;
}

/* Achievement Grid */
.sv-gam-section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
  margin-bottom: 10px;
}
.sv-gam-category-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  margin: 14px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #404040);
}
.sv-gam-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}
.sv-gam-badge {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
}
.sv-gam-badge.unlocked {
  border-color: var(--accent-green-dark, #22c55e);
}
.sv-gam-badge.unlocked:hover {
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.15);
}
.sv-gam-badge.locked {
  opacity: 0.55;
  filter: grayscale(0.5);
}
.sv-gam-badge-icon {
  font-size: 24px;
  flex-shrink: 0;
  width: 32px;
  text-align: center;
}
.sv-gam-badge-body { flex: 1; min-width: 0; }
.sv-gam-badge-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}
.sv-gam-badge-desc {
  font-size: 11px;
  color: var(--text-secondary, #a0a0a0);
  margin-top: 2px;
}
.sv-gam-badge-pts {
  font-size: 10px;
  color: var(--accent-green, #4ade80);
  margin-top: 3px;
}
.sv-gam-badge-time {
  font-size: 10px;
  color: var(--text-muted, #707070);
  margin-top: 2px;
}
.sv-gam-badge-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-input, #333);
  margin-top: 6px;
  overflow: hidden;
}
.sv-gam-badge-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent-green, #4ade80);
  transition: width 0.4s ease;
}

/* Toast */
.sv-gam-toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.sv-gam-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: var(--bg-header, #252525);
  border: 1px solid var(--accent-green-dark, #22c55e);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  animation: sv-gam-toast-in 0.35s ease forwards;
  pointer-events: auto;
  max-width: 340px;
}
.sv-gam-toast.out {
  animation: sv-gam-toast-out 0.3s ease forwards;
}
.sv-gam-toast-icon { font-size: 26px; flex-shrink: 0; }
.sv-gam-toast-text { flex: 1; }
.sv-gam-toast-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-green, #4ade80);
}
.sv-gam-toast-desc {
  font-size: 11px;
  color: var(--text-secondary, #a0a0a0);
  margin-top: 2px;
}
@keyframes sv-gam-toast-in {
  from { opacity: 0; transform: translateX(60px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes sv-gam-toast-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(60px); }
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultData() {
    return {
      stats: {},
      unlocked: {},          // { [achievementId]: timestamp }
      streaks: {
        usage: { current: 0, longest: 0, lastDate: null },
        creation: { current: 0, longest: 0, lastDate: null }
      },
      activeDays: [],        // sorted list of YYYY-MM-DD strings
      firstSeen: todayKey()
    };
  }

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      _data = result[STORAGE_KEY] || defaultData();
      // Ensure sub-objects exist
      _data.stats = _data.stats || {};
      _data.unlocked = _data.unlocked || {};
      _data.streaks = _data.streaks || defaultData().streaks;
      _data.activeDays = _data.activeDays || [];
      _data.firstSeen = _data.firstSeen || todayKey();
    } catch {
      _data = defaultData();
    }
  }

  async function saveData() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _data });
    } catch (e) {
      console.warn('[Gamification] save failed:', e);
    }
  }

  function computeDaysActive() {
    return _data.activeDays.length;
  }

  function recordDay() {
    const today = todayKey();
    if (!_data.activeDays.includes(today)) {
      _data.activeDays.push(today);
      _data.activeDays.sort();
    }
  }

  function updateStreak(key) {
    const s = _data.streaks[key];
    if (!s) return;
    const today = todayKey();
    if (s.lastDate === today) return;

    const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
    if (s.lastDate === yesterday) {
      s.current += 1;
    } else {
      s.current = 1;
    }
    s.lastDate = today;
    if (s.current > s.longest) s.longest = s.current;
  }

  function getLevel(pts) {
    let lv = LEVELS[0];
    for (const l of LEVELS) {
      if (pts >= l.minPts) lv = l;
    }
    return lv;
  }

  function getNextLevel(pts) {
    for (const l of LEVELS) {
      if (pts < l.minPts) return l;
    }
    return null;
  }

  function totalPoints() {
    let sum = 0;
    for (const a of ACHIEVEMENTS) {
      if (_data.unlocked[a.id]) sum += a.pts;
    }
    return sum;
  }

  function unlockedCount() {
    return Object.keys(_data.unlocked).length;
  }

  /* ------------------------------------------------------------------ */
  /*  Toast Notifications                                                */
  /* ------------------------------------------------------------------ */

  let _toastContainer = null;

  function ensureToastContainer() {
    if (_toastContainer && document.body.contains(_toastContainer)) return;
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'sv-gam-toast-container';
    document.body.appendChild(_toastContainer);
  }

  function showToast(achievement) {
    _toastQueue.push(achievement);
    drainToastQueue();
  }

  function drainToastQueue() {
    if (_toastActive || _toastQueue.length === 0) return;
    _toastActive = true;
    const a = _toastQueue.shift();
    ensureToastContainer();

    const el = document.createElement('div');
    el.className = 'sv-gam-toast';
    el.innerHTML = `
      <span class="sv-gam-toast-icon">${a.icon}</span>
      <div class="sv-gam-toast-text">
        <div class="sv-gam-toast-title">Achievement Unlocked!</div>
        <div class="sv-gam-toast-desc">${esc(a.name)} &mdash; ${esc(a.desc)}</div>
      </div>`;
    _toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => {
        el.remove();
        _toastActive = false;
        drainToastQueue();
      }, { once: true });
    }, TOAST_DURATION);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /*  Achievement Checking                                               */
  /* ------------------------------------------------------------------ */

  function checkAllAchievements() {
    const dataView = buildDataView();
    const newlyUnlocked = [];

    for (const a of ACHIEVEMENTS) {
      if (_data.unlocked[a.id]) continue;
      try {
        if (a.check(dataView)) {
          _data.unlocked[a.id] = Date.now();
          newlyUnlocked.push(a);
        }
      } catch { /* ignore check errors */ }
    }

    if (newlyUnlocked.length > 0) {
      saveData();
      for (const a of newlyUnlocked) {
        showToast(a);
      }
    }

    return newlyUnlocked;
  }

  function buildDataView() {
    return {
      ...(_data.stats || {}),
      daysActive: computeDaysActive()
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Konami Code Listener                                               */
  /* ------------------------------------------------------------------ */

  function onKeyDown(e) {
    _konamiBuffer.push(e.key);
    if (_konamiBuffer.length > 10) _konamiBuffer.shift();
    if (_konamiBuffer.join(',') === KONAMI) {
      _data.stats.konamiEntered = true;
      saveData();
      checkAllAchievements();
      _konamiBuffer = [];
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Midnight Check                                                     */
  /* ------------------------------------------------------------------ */

  function checkMidnight() {
    const h = new Date().getHours();
    if (h >= 0 && h < 4) {
      _data.stats.midnightUse = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering: Profile Card                                            */
  /* ------------------------------------------------------------------ */

  function renderProfileCard() {
    const pts = totalPoints();
    const level = getLevel(pts);
    const next = getNextLevel(pts);
    const unlocked = unlockedCount();
    const total = ACHIEVEMENTS.length;
    const usage = _data.streaks.usage || { current: 0, longest: 0 };
    const creation = _data.streaks.creation || { current: 0, longest: 0 };

    const xpPct = next
      ? ((pts - level.minPts) / (next.minPts - level.minPts)) * 100
      : 100;

    const el = document.createElement('div');
    el.className = 'sv-gam-profile';
    el.innerHTML = `
      <div class="sv-gam-profile-badge">${level.icon}</div>
      <div class="sv-gam-profile-info">
        <div class="sv-gam-profile-name">${esc(level.name)}</div>
        <div class="sv-gam-profile-level">${pts} pts${next ? ` &middot; ${next.minPts - pts} pts to ${esc(next.name)}` : ' &middot; Max Level!'}</div>
        <div class="sv-gam-profile-xp-bar"><div class="sv-gam-profile-xp-fill" style="width:${xpPct}%"></div></div>
        <div class="sv-gam-profile-stats">
          <span><strong>${unlocked}</strong>/${total} achievements</span>
          <span>\uD83D\uDD25 <strong>${usage.current}</strong> day streak</span>
          <span>Best: <strong>${usage.longest}</strong> days</span>
        </div>
      </div>
      <button class="sv-gam-share-btn" title="Share profile as image">Share</button>`;

    el.querySelector('.sv-gam-share-btn').addEventListener('click', () => {
      renderProfileImage(level, pts, next, unlocked, total, usage);
    });

    return el;
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering: Shareable Profile Image (Canvas)                        */
  /* ------------------------------------------------------------------ */

  function renderProfileImage(level, pts, next, unlocked, total, usage) {
    const W = 480, H = 200;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1a1a1a');
    grad.addColorStop(1, '#252525');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.roundRect(1, 1, W - 2, H - 2, 12);
    ctx.stroke();

    // Badge circle
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(60, H / 2, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(level.icon, 60, H / 2);

    // Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(level.name, 115, 50);

    ctx.fillStyle = '#4ade80';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${pts} points`, 115, 75);

    ctx.fillStyle = '#a0a0a0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${unlocked}/${total} achievements unlocked`, 115, 100);
    ctx.fillText(`Current streak: ${usage.current} days  |  Best: ${usage.longest} days`, 115, 122);

    // XP bar
    const barX = 115, barY = 140, barW = 330, barH = 10;
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();
    const pct = next ? (pts - level.minPts) / (next.minPts - level.minPts) : 1;
    const gBar = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gBar.addColorStop(0, '#4ade80');
    gBar.addColorStop(1, '#60a5fa');
    ctx.fillStyle = gBar;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * pct, barH, 5);
    ctx.fill();

    // Branding
    ctx.fillStyle = '#707070';
    ctx.font = '11px sans-serif';
    ctx.fillText('ScriptVault Gamification', 115, 172);

    // Trigger download
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scriptvault-profile.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering: Streaks                                                 */
  /* ------------------------------------------------------------------ */

  function renderStreaks() {
    const usage = _data.streaks.usage || { current: 0, longest: 0 };
    const creation = _data.streaks.creation || { current: 0, longest: 0 };

    const wrap = document.createElement('div');
    wrap.className = 'sv-gam-streaks';
    wrap.innerHTML = `
      <div class="sv-gam-streak-card">
        <div class="sv-gam-streak-label">Daily Usage Streak</div>
        <div class="sv-gam-streak-value${usage.current >= 3 ? ' fire' : ''}">${usage.current}</div>
        <div class="sv-gam-streak-sub">Longest: ${usage.longest} days</div>
      </div>
      <div class="sv-gam-streak-card">
        <div class="sv-gam-streak-label">Creation Streak</div>
        <div class="sv-gam-streak-value${creation.current >= 3 ? ' fire' : ''}">${creation.current}</div>
        <div class="sv-gam-streak-sub">Longest: ${creation.longest} days</div>
      </div>
      <div class="sv-gam-streak-card">
        <div class="sv-gam-streak-label">Total Active Days</div>
        <div class="sv-gam-streak-value">${computeDaysActive()}</div>
        <div class="sv-gam-streak-sub">Since ${_data.firstSeen || '—'}</div>
      </div>`;
    return wrap;
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering: Achievement Gallery                                     */
  /* ------------------------------------------------------------------ */

  function renderAchievementGallery() {
    const frag = document.createDocumentFragment();
    const title = document.createElement('div');
    title.className = 'sv-gam-section-title';
    title.textContent = `Achievements (${unlockedCount()}/${ACHIEVEMENTS.length})`;
    frag.appendChild(title);

    const categories = [];
    const catMap = new Map();
    for (const a of ACHIEVEMENTS) {
      if (!catMap.has(a.cat)) {
        catMap.set(a.cat, []);
        categories.push(a.cat);
      }
      catMap.get(a.cat).push(a);
    }

    const dataView = buildDataView();

    for (const cat of categories) {
      const cTitle = document.createElement('div');
      cTitle.className = 'sv-gam-category-title';
      cTitle.textContent = cat;
      frag.appendChild(cTitle);

      const grid = document.createElement('div');
      grid.className = 'sv-gam-grid';

      for (const a of catMap.get(cat)) {
        const isUnlocked = !!_data.unlocked[a.id];
        const isHidden = a.hidden && !isUnlocked;

        const badge = document.createElement('div');
        badge.className = `sv-gam-badge ${isUnlocked ? 'unlocked' : 'locked'}`;

        const progressHTML = (!isUnlocked && a.target && a.progress)
          ? (() => {
              const curr = a.progress(dataView);
              const pct = Math.min((curr / a.target) * 100, 100);
              return `<div class="sv-gam-badge-progress"><div class="sv-gam-badge-progress-fill" style="width:${pct}%"></div></div>
                      <div class="sv-gam-badge-pts">${curr}/${a.target}</div>`;
            })()
          : `<div class="sv-gam-badge-pts">${a.pts} pts</div>`;

        const timeHTML = isUnlocked
          ? `<div class="sv-gam-badge-time">Unlocked ${new Date(_data.unlocked[a.id]).toLocaleDateString()}</div>`
          : '';

        badge.innerHTML = `
          <div class="sv-gam-badge-icon">${isHidden ? '\uD83D\uDD12' : a.icon}</div>
          <div class="sv-gam-badge-body">
            <div class="sv-gam-badge-name">${isHidden ? 'Hidden' : esc(a.name)}</div>
            <div class="sv-gam-badge-desc">${isHidden ? 'Discover this secret achievement' : esc(a.desc)}</div>
            ${progressHTML}
            ${timeHTML}
          </div>`;

        grid.appendChild(badge);
      }
      frag.appendChild(grid);
    }

    return frag;
  }

  /* ------------------------------------------------------------------ */
  /*  Inject Styles                                                      */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    _styleEl = document.createElement('style');
    _styleEl.id = STYLE_ID;
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function removeStyles() {
    if (_styleEl) { _styleEl.remove(); _styleEl = null; }
  }

  /* ------------------------------------------------------------------ */
  /*  Full Render                                                        */
  /* ------------------------------------------------------------------ */

  function render() {
    if (!_container) return;
    _container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'sv-gam-wrap';

    wrap.appendChild(renderProfileCard());
    wrap.appendChild(renderStreaks());

    const gallery = document.createElement('div');
    gallery.appendChild(renderAchievementGallery());
    wrap.appendChild(gallery);

    _container.appendChild(wrap);
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialize the gamification system and render into container.
     * @param {HTMLElement} containerEl
     */
    async init(containerEl) {
      if (_initialized) this.destroy();
      _container = containerEl;
      injectStyles();
      await loadData();

      // Record daily activity
      recordDay();
      updateStreak('usage');
      checkMidnight();
      await saveData();

      // Easter egg listener
      document.addEventListener('keydown', onKeyDown);

      // Initial achievement scan
      checkAllAchievements();

      render();
      _initialized = true;
    },

    /**
     * Check whether a specific achievement (or all) should be unlocked.
     * Call this from other modules when relevant events occur.
     * @param {string} type — stat key to increment or set
     * @param {*} data — value to set (number) or increment (default +1)
     * @returns {Array} newly unlocked achievements
     */
    async checkAchievement(type, data) {
      if (!_data) await loadData();

      if (typeof data === 'number') {
        _data.stats[type] = (_data.stats[type] || 0) + data;
      } else if (typeof data === 'boolean') {
        _data.stats[type] = data;
      } else if (data === undefined || data === null) {
        _data.stats[type] = (_data.stats[type] || 0) + 1;
      } else {
        _data.stats[type] = data;
      }

      await saveData();
      const unlocked = checkAllAchievements();
      if (_container) render();
      return unlocked;
    },

    /**
     * Return all achievement definitions with unlock state.
     */
    getAchievements() {
      const dataView = buildDataView();
      return ACHIEVEMENTS.map(a => ({
        id: a.id,
        category: a.cat,
        name: a.name,
        description: a.desc,
        points: a.pts,
        icon: a.icon,
        hidden: !!a.hidden,
        unlocked: !!(_data && _data.unlocked[a.id]),
        unlockedAt: _data && _data.unlocked[a.id] ? _data.unlocked[a.id] : null,
        progress: (a.target && a.progress) ? { current: a.progress(dataView), target: a.target } : null
      }));
    },

    /**
     * Return the user profile summary.
     */
    getProfile() {
      if (!_data) return null;
      const pts = totalPoints();
      const level = getLevel(pts);
      const next = getNextLevel(pts);
      return {
        level: level.name,
        icon: level.icon,
        points: pts,
        nextLevel: next ? next.name : null,
        pointsToNext: next ? next.minPts - pts : 0,
        achievementsUnlocked: unlockedCount(),
        achievementsTotal: ACHIEVEMENTS.length,
        daysActive: computeDaysActive(),
        memberSince: _data.firstSeen
      };
    },

    /**
     * Return current streak data.
     */
    getStreaks() {
      if (!_data) return null;
      return {
        usage: { ..._data.streaks.usage },
        creation: { ..._data.streaks.creation },
        totalActiveDays: computeDaysActive()
      };
    },

    /**
     * Record an activity (used by other modules to trigger gamification).
     * @param {string} type — activity type key
     */
    async recordActivity(type) {
      if (!_data) await loadData();

      recordDay();
      updateStreak('usage');

      if (type === 'scriptCreated' || type === 'scriptEdited') {
        updateStreak('creation');
      }

      // Auto-increment common stat counters
      const incrementMap = {
        scriptInstalled: 'scriptsInstalled',
        scriptCreated: 'scriptsCreated',
        scriptEdited: 'scriptsEdited',
        scriptShared: 'sharedScript',
        gistExported: 'exportedGist',
        templateUsed: 'usedTemplate',
        scriptUpdated: 'updatedScript',
        updatesChecked: 'checkedUpdates',
        backupCreated: 'createdBackup',
        errorFixed: 'fixedError',
        errorLogCleared: 'clearedErrorLog',
        commandPaletteUsed: 'usedCommandPalette',
        logoClicked: 'logoClicks'
      };

      const statKey = incrementMap[type];
      if (statKey) {
        if (typeof _data.stats[statKey] === 'boolean') {
          _data.stats[statKey] = true;
        } else {
          _data.stats[statKey] = (_data.stats[statKey] || 0) + 1;
        }
      }

      // For boolean stats, set to true
      const booleanStats = ['sharedScript', 'exportedGist', 'usedTemplate',
        'updatedScript', 'checkedUpdates', 'createdBackup', 'fixedError',
        'clearedErrorLog', 'usedCommandPalette', 'allScriptsFast'];
      if (booleanStats.includes(statKey)) {
        _data.stats[statKey] = true;
      }

      await saveData();
      checkAllAchievements();
      if (_container) render();
    },

    /**
     * Render the profile card element (standalone, detached).
     * @returns {HTMLElement}
     */
    renderProfileCard() {
      injectStyles();
      return renderProfileCard();
    },

    /**
     * Tear down: remove listeners, styles, clear state.
     */
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      removeStyles();
      if (_toastContainer) { _toastContainer.remove(); _toastContainer = null; }
      _container = null;
      _data = null;
      _initialized = false;
      _toastQueue = [];
      _toastActive = false;
      _konamiBuffer = [];
    }
  };
})();
