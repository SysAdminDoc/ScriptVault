/**
 * ScriptVault Smart Recommendations Engine
 * Intelligent script suggestions based on installed scripts,
 * browsing patterns, usage data, and Greasy Fork categories.
 */
const Recommendations = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STYLE_ID = 'sv-rec-styles';
  const STORAGE_KEY_DISMISSED = 'sv_rec_dismissed';
  const STORAGE_KEY_CACHE = 'sv_rec_cache';
  const CACHE_TTL = 3600000; // 1 hour

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _recommendations = [];
  let _dismissed = new Set();
  let _onInstall = null;
  let _getScripts = null;
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
.sv-rec-root {
  display: flex;
  flex-direction: column;
  background: var(--bg-body, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 16px;
  gap: 14px;
}
.sv-rec-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sv-rec-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-rec-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
}
.sv-rec-btn {
  padding: 5px 12px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.sv-rec-btn:hover {
  border-color: var(--accent-green, #4ade80);
}
.sv-rec-btn-primary {
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  border-color: var(--accent-green-dark, #22c55e);
}
.sv-rec-btn-primary:hover {
  background: var(--accent-green, #4ade80);
  color: #1a1a1a;
}
.sv-rec-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border-color, #404040);
  margin-top: 8px;
}
.sv-rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.sv-rec-card {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 10px;
  padding: 16px;
  transition: border-color 0.2s, transform 0.15s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sv-rec-card:hover {
  border-color: var(--accent-green, #4ade80);
  transform: translateY(-1px);
}
.sv-rec-card-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.sv-rec-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--bg-input, #333);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  color: var(--accent-green, #4ade80);
}
.sv-rec-card-info {
  flex: 1;
  min-width: 0;
}
.sv-rec-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sv-rec-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 2px;
}
.sv-rec-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted, #707070);
}
.sv-rec-card-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sv-rec-card-score {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sv-rec-card-score-bar {
  width: 50px;
  height: 4px;
  background: var(--bg-input, #333);
  border-radius: 2px;
  overflow: hidden;
}
.sv-rec-card-score-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent-green, #4ade80);
  transition: width 0.3s;
}
.sv-rec-card-reason {
  font-size: 11px;
  color: var(--accent-blue, #60a5fa);
  background: rgba(96, 165, 250, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1.4;
}
.sv-rec-card-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
.sv-rec-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted, #707070);
  font-size: 13px;
}
.sv-rec-empty-icon {
  font-size: 40px;
  margin-bottom: 10px;
  opacity: 0.4;
}
.sv-rec-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-muted, #707070);
}
.sv-rec-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color, #404040);
  border-top-color: var(--accent-green, #4ade80);
  border-radius: 50%;
  animation: sv-rec-spin 0.8s linear infinite;
  margin-right: 10px;
}
@keyframes sv-rec-spin {
  to { transform: rotate(360deg); }
}
.sv-rec-category-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  background: var(--bg-input, #333);
  color: var(--text-secondary, #a0a0a0);
  margin-right: 4px;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Domain / Category Knowledge Base                                   */
  /* ------------------------------------------------------------------ */

  const CATEGORY_MAP = {
    'youtube.com': ['video', 'media', 'entertainment'],
    'twitter.com': ['social', 'microblog'],
    'x.com': ['social', 'microblog'],
    'reddit.com': ['social', 'forum'],
    'github.com': ['dev', 'code', 'productivity'],
    'stackoverflow.com': ['dev', 'qa'],
    'google.com': ['search', 'productivity'],
    'facebook.com': ['social'],
    'instagram.com': ['social', 'media'],
    'twitch.tv': ['video', 'streaming', 'entertainment'],
    'amazon.com': ['shopping'],
    'ebay.com': ['shopping'],
    'wikipedia.org': ['reference', 'knowledge'],
    'netflix.com': ['video', 'streaming'],
    'discord.com': ['social', 'chat'],
  };

  const POPULAR_SCRIPTS = [
    { id: 'rec-yt-enhancer', name: 'YouTube Enhancer Pro', description: 'Ad-free viewing, SponsorBlock, custom player controls, and download options.', domains: ['youtube.com'], categories: ['video', 'media'], installs: 245000, rating: 4.8 },
    { id: 'rec-yt-age-bypass', name: 'YouTube Age Bypass', description: 'Bypass age-restricted content without signing in.', domains: ['youtube.com'], categories: ['video'], installs: 180000, rating: 4.6 },
    { id: 'rec-reddit-enhance', name: 'Reddit Enhancement Suite Lite', description: 'Infinite scroll, user tagging, keyboard nav for old and new Reddit.', domains: ['reddit.com'], categories: ['social', 'forum'], installs: 120000, rating: 4.7 },
    { id: 'rec-github-enhance', name: 'GitHub Code Enhancer', description: 'File tree, copy buttons, dark mode fixes, and PR improvements.', domains: ['github.com'], categories: ['dev', 'code'], installs: 95000, rating: 4.5 },
    { id: 'rec-twitter-clean', name: 'Twitter/X Declutter', description: 'Hide trends, promoted tweets, and algorithmic suggestions.', domains: ['twitter.com', 'x.com'], categories: ['social', 'microblog'], installs: 78000, rating: 4.4 },
    { id: 'rec-adblock-extra', name: 'Anti-Adblock Killer', description: 'Bypass anti-adblock detection on popular websites.', domains: [], categories: ['utility', 'privacy'], installs: 310000, rating: 4.3 },
    { id: 'rec-dark-reader', name: 'Universal Dark Mode', description: 'Force dark mode on any website with customizable colors.', domains: [], categories: ['utility', 'theme'], installs: 290000, rating: 4.6 },
    { id: 'rec-direct-dl', name: 'Direct Download Links', description: 'Convert download site links to direct download URLs.', domains: [], categories: ['utility', 'download'], installs: 150000, rating: 4.2 },
    { id: 'rec-google-clean', name: 'Google Search Clean', description: 'Remove sponsored results, tracking redirects, and clutter from Google.', domains: ['google.com'], categories: ['search', 'privacy'], installs: 200000, rating: 4.5 },
    { id: 'rec-amazon-price', name: 'Amazon Price History', description: 'Show price history charts and alert on price drops.', domains: ['amazon.com'], categories: ['shopping'], installs: 165000, rating: 4.7 },
    { id: 'rec-twitch-enhance', name: 'Twitch Enhancements', description: 'Better chat, ad-skip, VOD tools, and stream stats.', domains: ['twitch.tv'], categories: ['video', 'streaming'], installs: 88000, rating: 4.4 },
    { id: 'rec-wiki-enhance', name: 'Wikipedia Enhanced', description: 'Better typography, dark mode, and table of contents improvements.', domains: ['wikipedia.org'], categories: ['reference'], installs: 45000, rating: 4.3 },
    { id: 'rec-fb-clean', name: 'Facebook Purity', description: 'Hide sponsored posts, suggested content, and clean up the feed.', domains: ['facebook.com'], categories: ['social'], installs: 110000, rating: 4.2 },
    { id: 'rec-ig-download', name: 'Instagram Downloader', description: 'Download photos, videos, stories, and reels from Instagram.', domains: ['instagram.com'], categories: ['social', 'media', 'download'], installs: 135000, rating: 4.5 },
    { id: 'rec-cookie-auto', name: 'Auto Cookie Consent', description: 'Automatically dismiss cookie consent popups across all sites.', domains: [], categories: ['utility', 'privacy'], installs: 250000, rating: 4.6 },
    { id: 'rec-so-enhance', name: 'Stack Overflow Plus', description: 'Syntax highlighting themes, copy code buttons, and answer sorting.', domains: ['stackoverflow.com'], categories: ['dev', 'qa'], installs: 72000, rating: 4.4 },
    { id: 'rec-netflix-enhance', name: 'Netflix Tweaks', description: 'Skip intros, auto-play next, keyboard shortcuts, and IMDb ratings.', domains: ['netflix.com'], categories: ['video', 'streaming'], installs: 95000, rating: 4.3 },
    { id: 'rec-discord-enhance', name: 'Discord Enhancer', description: 'Custom themes, hidden features, and quality-of-life improvements.', domains: ['discord.com'], categories: ['social', 'chat'], installs: 68000, rating: 4.1 },
    { id: 'rec-password-gen', name: 'Inline Password Generator', description: 'Generate secure passwords directly in password fields.', domains: [], categories: ['utility', 'security'], installs: 55000, rating: 4.5 },
    { id: 'rec-font-render', name: 'Font Rendering Enhancer', description: 'Improve font rendering and readability across all websites.', domains: [], categories: ['utility', 'theme'], installs: 82000, rating: 4.2 },
  ];

  /* ------------------------------------------------------------------ */
  /*  Data Helpers                                                       */
  /* ------------------------------------------------------------------ */

  async function _loadDismissed() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_DISMISSED);
      const raw = result[STORAGE_KEY_DISMISSED];
      _dismissed = raw ? new Set(Array.isArray(raw) ? raw : JSON.parse(raw)) : new Set();
    } catch { _dismissed = new Set(); }
  }

  function _saveDismissed() {
    try {
      chrome.storage.local.set({ [STORAGE_KEY_DISMISSED]: [..._dismissed] });
    } catch {}
  }

  function _getInstalledScripts() {
    if (_getScripts) {
      try { return _getScripts(); } catch {}
    }
    return [];
  }

  function _extractDomains(scripts) {
    const domains = new Map(); // domain -> count
    for (const script of scripts) {
      const matches = script.matches || script.match || [];
      const allPatterns = Array.isArray(matches) ? matches : [matches];
      for (const pattern of allPatterns) {
        try {
          const m = String(pattern).match(/^(?:https?|\*):\/\/([^/]+)/);
          if (m) {
            let domain = m[1].replace(/^\*\./, '').replace(/^\*$/, '');
            if (domain) {
              domains.set(domain, (domains.get(domain) || 0) + 1);
            }
          }
        } catch {}
      }
    }
    return domains;
  }

  function _extractCategories(scripts) {
    const cats = new Set();
    const domains = _extractDomains(scripts);
    for (const [domain] of domains) {
      const baseDomain = domain.replace(/^www\./, '');
      const mapped = CATEGORY_MAP[baseDomain];
      if (mapped) mapped.forEach(c => cats.add(c));
    }
    return cats;
  }

  function _getInstalledIds() {
    return new Set(_getInstalledScripts().map(s => s.id || s.name || ''));
  }

  /* ------------------------------------------------------------------ */
  /*  Recommendation Engine                                              */
  /* ------------------------------------------------------------------ */

  async function _generateRecommendations() {
    const scripts = _getInstalledScripts();
    const installedIds = _getInstalledIds();
    const domains = _extractDomains(scripts);
    const categories = _extractCategories(scripts);
    const scored = [];

    for (const candidate of POPULAR_SCRIPTS) {
      if (installedIds.has(candidate.id)) continue;
      if (_dismissed.has(candidate.id)) continue;

      let score = 0;
      const reasons = [];

      // Domain match scoring
      for (const domain of candidate.domains) {
        if (domains.has(domain)) {
          score += 30;
          reasons.push(`You use scripts on ${domain}`);
        }
        const baseDomain = domain.replace(/^www\./, '');
        for (const [installedDomain] of domains) {
          if (installedDomain.includes(baseDomain) || baseDomain.includes(installedDomain)) {
            score += 15;
          }
        }
      }

      // Category match scoring
      for (const cat of candidate.categories) {
        if (categories.has(cat)) {
          score += 20;
          reasons.push(`Matches your "${cat}" category`);
        }
      }

      // Popularity bonus
      if (candidate.installs > 200000) score += 15;
      else if (candidate.installs > 100000) score += 10;
      else if (candidate.installs > 50000) score += 5;

      // Rating bonus
      if (candidate.rating >= 4.5) score += 10;
      else if (candidate.rating >= 4.0) score += 5;

      // Complementary scripts (simulated "users who installed X also installed Y")
      const installedDomains = new Set([...domains.keys()].map(d => d.replace(/^www\./, '')));
      for (const cd of candidate.domains) {
        for (const id of installedDomains) {
          const catA = CATEGORY_MAP[cd] || [];
          const catB = CATEGORY_MAP[id] || [];
          const overlap = catA.filter(c => catB.includes(c));
          if (overlap.length > 0 && cd !== id) {
            score += 10;
            reasons.push(`Complements your ${id} scripts`);
          }
        }
      }

      // Minimum relevance threshold
      if (score < 10 && reasons.length === 0) {
        // Give a small base score for highly popular universal scripts
        if (candidate.domains.length === 0 && candidate.installs > 200000) {
          score += 8;
          reasons.push('Popular across all users');
        }
      }

      if (score > 0 || reasons.length > 0) {
        scored.push({
          ...candidate,
          score: Math.min(100, score),
          reason: [...new Set(reasons)].slice(0, 2).join('. ') || 'Popular userscript',
          type: _classifyRecommendation(candidate, scripts),
        });
      }
    }

    // Add usage-based recommendations
    await _addUsageRecommendations(scored, scripts);

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  function _classifyRecommendation(candidate, installedScripts) {
    const domains = _extractDomains(installedScripts);
    for (const d of candidate.domains) {
      if (domains.has(d)) return 'domain';
    }
    if (candidate.domains.length === 0) return 'popular';
    return 'category';
  }

  async function _addUsageRecommendations(scored, installedScripts) {
    // Check for outdated scripts
    for (const script of installedScripts) {
      if (script.hasUpdate || script.outdated) {
        scored.push({
          id: `update-${script.id || script.name}`,
          name: `Update: ${script.name || script.id}`,
          description: 'A newer version is available. Update to get bug fixes and new features.',
          domains: [],
          categories: [],
          installs: 0,
          rating: 0,
          score: 90,
          reason: 'Outdated version detected',
          type: 'update',
        });
      }
    }

    // Check for scripts with errors
    try {
      const analyticsResult = await chrome.storage.local.get('sv_analytics');
      const analyticsData = analyticsResult['sv_analytics'] || {};
      for (const [scriptId, data] of Object.entries(analyticsData)) {
        if (data && data.days) {
          const recentDays = Object.entries(data.days).slice(-7);
          const errorCount = recentDays.reduce((sum, [, d]) => sum + (d.errors || 0), 0);
          if (errorCount > 5) {
            scored.push({
              id: `error-${scriptId}`,
              name: `Check: ${scriptId}`,
              description: `This script has ${errorCount} errors in the last 7 days. Consider finding an alternative.`,
              domains: [],
              categories: [],
              installs: 0,
              rating: 0,
              score: 80,
              reason: 'High error rate detected',
              type: 'diagnostic',
            });
          }
        }
      }
    } catch {}
  }

  /* ------------------------------------------------------------------ */
  /*  UI Rendering                                                       */
  /* ------------------------------------------------------------------ */

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    _styleEl = document.createElement('style');
    _styleEl.id = STYLE_ID;
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function _buildUI() {
    _container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'sv-rec-root';

    // Header
    const header = document.createElement('div');
    header.className = 'sv-rec-header';
    const title = document.createElement('span');
    title.className = 'sv-rec-title';
    title.textContent = 'Recommendations';
    header.appendChild(title);

    if (_recommendations.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'sv-rec-badge';
      badge.textContent = _recommendations.length;
      header.appendChild(badge);
    }

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'sv-rec-btn';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.onclick = () => _refresh();
    header.appendChild(refreshBtn);
    root.appendChild(header);

    if (_recommendations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sv-rec-empty';
      const icon = document.createElement('div');
      icon.className = 'sv-rec-empty-icon';
      icon.textContent = '\uD83D\uDD0D';
      const msg = document.createElement('div');
      msg.textContent = 'No recommendations available. Install more scripts or check back later.';
      empty.append(icon, msg);
      root.appendChild(empty);
      _container.appendChild(root);
      return;
    }

    // Group by type
    const groups = {};
    for (const rec of _recommendations) {
      const type = rec.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(rec);
    }

    const groupLabels = {
      domain: 'Based on Your Sites',
      category: 'Based on Your Interests',
      popular: 'Popular Scripts',
      update: 'Available Updates',
      diagnostic: 'Script Health',
      other: 'Other Suggestions',
    };

    const groupOrder = ['update', 'diagnostic', 'domain', 'category', 'popular', 'other'];

    for (const groupKey of groupOrder) {
      const recs = groups[groupKey];
      if (!recs || !recs.length) continue;

      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'sv-rec-section-title';
      sectionTitle.textContent = groupLabels[groupKey] || groupKey;
      root.appendChild(sectionTitle);

      const grid = document.createElement('div');
      grid.className = 'sv-rec-grid';

      for (const rec of recs) {
        grid.appendChild(_buildCard(rec));
      }
      root.appendChild(grid);
    }

    _container.appendChild(root);
  }

  function _buildCard(rec) {
    const card = document.createElement('div');
    card.className = 'sv-rec-card';

    // Header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'sv-rec-card-header';
    const icon = document.createElement('div');
    icon.className = 'sv-rec-card-icon';
    const icons = { domain: '\uD83C\uDF10', category: '\uD83C\uDFAF', popular: '\u2B50', update: '\uD83D\uDD04', diagnostic: '\u26A0\uFE0F', other: '\uD83D\uDCA1' };
    icon.textContent = icons[rec.type] || '\uD83D\uDCA1';
    const info = document.createElement('div');
    info.className = 'sv-rec-card-info';
    const name = document.createElement('div');
    name.className = 'sv-rec-card-name';
    name.textContent = rec.name;
    name.title = rec.name;
    const desc = document.createElement('div');
    desc.className = 'sv-rec-card-desc';
    desc.textContent = rec.description;
    info.append(name, desc);
    cardHeader.append(icon, info);
    card.appendChild(cardHeader);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'sv-rec-card-meta';
    if (rec.installs > 0) {
      const instItem = document.createElement('span');
      instItem.className = 'sv-rec-card-meta-item';
      instItem.textContent = `${_formatNumber(rec.installs)} installs`;
      meta.appendChild(instItem);
    }
    if (rec.rating > 0) {
      const ratItem = document.createElement('span');
      ratItem.className = 'sv-rec-card-meta-item';
      ratItem.textContent = `${'*'.repeat(Math.round(rec.rating))} ${rec.rating}`;
      meta.appendChild(ratItem);
    }
    // Score bar
    const scoreWrap = document.createElement('span');
    scoreWrap.className = 'sv-rec-card-score';
    const scoreLabel = document.createElement('span');
    scoreLabel.textContent = `${rec.score}%`;
    const scoreBar = document.createElement('span');
    scoreBar.className = 'sv-rec-card-score-bar';
    const scoreFill = document.createElement('span');
    scoreFill.className = 'sv-rec-card-score-fill';
    scoreFill.style.width = rec.score + '%';
    scoreBar.appendChild(scoreFill);
    scoreWrap.append(scoreLabel, scoreBar);
    meta.appendChild(scoreWrap);
    card.appendChild(meta);

    // Categories
    if (rec.categories && rec.categories.length > 0) {
      const catWrap = document.createElement('div');
      for (const cat of rec.categories.slice(0, 3)) {
        const tag = document.createElement('span');
        tag.className = 'sv-rec-category-tag';
        tag.textContent = cat;
        catWrap.appendChild(tag);
      }
      card.appendChild(catWrap);
    }

    // Reason
    if (rec.reason) {
      const reason = document.createElement('div');
      reason.className = 'sv-rec-card-reason';
      reason.textContent = rec.reason;
      card.appendChild(reason);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'sv-rec-card-actions';

    if (rec.type !== 'diagnostic') {
      const installBtn = document.createElement('button');
      installBtn.className = 'sv-rec-btn sv-rec-btn-primary';
      installBtn.textContent = rec.type === 'update' ? 'Update' : 'Install';
      installBtn.onclick = (e) => {
        e.stopPropagation();
        if (_onInstall) _onInstall(rec);
        // Open Greasy Fork search as fallback
        const query = encodeURIComponent(rec.name);
        window.open(`https://greasyfork.org/en/scripts?q=${query}`, '_blank');
      };
      actions.appendChild(installBtn);
    }

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'sv-rec-btn';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.onclick = (e) => {
      e.stopPropagation();
      _dismissed.add(rec.id);
      _saveDismissed();
      _recommendations = _recommendations.filter(r => r.id !== rec.id);
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => { card.remove(); _updateBadge(); }, 300);
    };
    actions.appendChild(dismissBtn);
    card.appendChild(actions);

    return card;
  }

  function _updateBadge() {
    const badge = _container?.querySelector('.sv-rec-badge');
    if (badge) {
      badge.textContent = _recommendations.length;
      if (_recommendations.length === 0) badge.style.display = 'none';
    }
  }

  function _formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return String(n);
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  async function init(containerEl, options = {}) {
    _container = containerEl;
    _onInstall = options.onInstall || null;
    _getScripts = options.getScripts || (() => []);
    _injectStyles();
    await _loadDismissed();
    _recommendations = await _generateRecommendations();
    _buildUI();
    _initialized = true;
  }

  function getRecommendations() {
    return [..._recommendations];
  }

  function dismiss(recommendationId) {
    _dismissed.add(recommendationId);
    _saveDismissed();
    _recommendations = _recommendations.filter(r => r.id !== recommendationId);
    _buildUI();
  }

  async function _refresh() {
    _recommendations = await _generateRecommendations();
    _buildUI();
  }

  async function refresh() {
    await _refresh();
  }

  function destroy() {
    if (_container) _container.innerHTML = '';
    if (_styleEl) { _styleEl.remove(); _styleEl = null; }
    _container = null;
    _recommendations = [];
    _initialized = false;
  }

  return { init, getRecommendations, dismiss, refresh, destroy };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Recommendations;
