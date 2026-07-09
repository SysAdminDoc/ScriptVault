import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../../pages/theme-tokens.css";
import "../../pages/dashboard.css";
import "../../pages/dashboard-workbench.css";

const rows = [
  ["YouTube Enhancer", "Enhance YouTube with ad block, theme...", "3.2.1", "youtube.com", "2h ago", "Greasy Fork", true],
  ["Reddit UI Tweaks", "Improve Reddit browsing experience", "2.7.4", "reddit.com", "1d ago", "Greasy Fork", true],
  ["GitHub Dark Mode", "Dark mode for GitHub", "1.5.0", "github.com", "3d ago", "OpenUserJS", true],
  ["Google Search Cleaner", "Remove clutter from Google search", "1.3.6", "google.com", "5d ago", "Greasy Fork", true],
  ["Twitter/X Video Downloader", "Download videos from X", "0.9.8", "x.com", "1w ago", "Greasy Fork", false],
  ["Netflix Subtitle Tweaks", "Better subtitle styling on Netflix", "1.1.2", "netflix.com", "1w ago", "User Script Zone", true],
  ["Copy as Markdown", "Copy selection as Markdown", "2.0.3", "*", "2w ago", "Greasy Fork", true],
  ["Old Forum Fix", "Restore old forum layouts", "0.7.1", "forum.example.com", "2w ago", "User Script Zone", false],
];

function renderRows() {
  return rows.map(([name, description, version, site, updated, source, enabled], index) => `
    <tr class="${name === "Reddit UI Tweaks" ? "selected row-selected" : ""}">
      <td class="center"><input type="checkbox" ${name === "Reddit UI Tweaks" ? "checked" : ""} aria-label="Select ${name}"></td>
      <td class="center">${index + 1}</td>
      <td class="center">${enabled ? '<span class="sv-status-dot good"></span>' : '<span class="sv-status-dot"></span>'}</td>
      <td>
        <div class="script-name-cell">
          <span class="script-icon-placeholder">${name.slice(0, 1)}</span>
          <div class="script-name-stack">
            <span class="script-name">${name}</span>
            <span class="script-author">${description}</span>
          </div>
        </div>
      </td>
      <td class="center">${version}</td>
      <td class="center">42 KB</td>
      <td class="center">180</td>
      <td class="center"><span class="site-icon site-more">${site === "*" ? "*" : site.slice(0, 1).toUpperCase()}</span> ${site}${index === 1 ? " +1" : ""}</td>
      <td class="center"><span class="script-health-badge good">${source}</span></td>
      <td class="center">-</td>
      <td class="center">${updated}</td>
      <td class="center">8ms</td>
      <td class="center"><button class="action-icon" type="button" aria-label="More ${name}">...</button></td>
    </tr>
  `).join("");
}

function renderDashboardShell(theme = "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = "comfortable";
  document.documentElement.dataset.uiScale = "1";
  document.body.innerHTML = `
    <main class="visual-frame" data-testid="dashboard-shell" aria-label="ScriptVault dashboard shell">
      <div class="sv-workbench-shell">
        <aside class="sv-nav-rail" aria-label="ScriptVault workspace">
          <div class="sv-rail-brand">
            <div class="script-icon-placeholder" aria-hidden="true">SV</div>
            <div><strong>ScriptVault</strong><span>v3.19.0</span></div>
          </div>
          <nav class="sv-rail-nav" aria-label="Dashboard sections">
            <button class="sv-rail-item active" type="button"><span class="sv-rail-icon">#</span><span>Scripts</span><span class="sv-rail-count">128</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">U</span><span>Updates</span><span class="sv-rail-count warning">3</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">C</span><span>Collections</span><span class="sv-rail-count">12</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">H</span><span>History</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">S</span><span>Settings</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">W</span><span>Utilities</span></button>
          </nav>
          <div class="sv-rail-section">
            <span class="sv-rail-section-title">System</span>
            <button class="sv-rail-item sv-rail-subitem" type="button"><span class="sv-rail-icon">R</span><span>Sync &amp; Backup</span><span class="sv-status-dot good"></span></button>
            <button class="sv-rail-item sv-rail-subitem" type="button"><span class="sv-rail-icon">I</span><span>Import / Export</span></button>
            <button class="sv-rail-item sv-rail-subitem" type="button"><span class="sv-rail-icon">L</span><span>Logs</span></button>
          </div>
          <div class="sv-rail-section">
            <span class="sv-rail-section-title">Trust</span>
            <button class="sv-rail-item sv-rail-subitem" type="button"><span class="sv-rail-icon">T</span><span>Trusted Sources</span><span class="sv-status-dot good"></span></button>
            <button class="sv-rail-item sv-rail-subitem" type="button"><span class="sv-rail-icon">P</span><span>Permissions</span></button>
            <button class="sv-rail-item sv-rail-subitem" type="button"><span class="sv-rail-icon">D</span><span>Domain Access</span></button>
          </div>
          <div class="sv-rail-storage">
            <div><span>Storage</span><strong>2.4 GB / 10 GB</strong></div>
            <div class="sv-rail-storage-track"><span style="width:24%"></span></div>
            <small>24%</small>
          </div>
          <div class="sv-rail-footer"><span class="sv-sync-dot"></span><span>ScriptVault Pro</span></div>
        </aside>
        <section class="tm-content sv-workbench-main">
          <div id="scriptsPanel" class="tm-panel active">
            <div class="scripts-shell-header">
              <div class="scripts-shell-copy"><h2>Scripts</h2><p>Manage, review, and run your userscripts from one trusted workspace.</p></div>
              <div class="scripts-shell-actions" role="group" aria-label="Primary script actions">
                <button class="toolbar-btn primary" id="btnNewScript" type="button">New script</button>
                <button class="toolbar-btn" id="btnImportScript" type="button">Import</button>
                <button class="toolbar-btn" id="btnWorkbenchSyncNow" type="button">Sync</button>
              </div>
            </div>
            <div class="scripts-shell-stats" aria-label="Workspace stats">
              <div class="scripts-shell-stat"><span class="scripts-shell-stat-mark">S</span><div class="scripts-shell-stat-copy"><strong>128</strong><span>Scripts</span></div></div>
              <div class="scripts-shell-stat" data-tone="good"><span class="scripts-shell-stat-mark">ON</span><div class="scripts-shell-stat-copy"><strong>98</strong><span>Enabled</span></div></div>
              <div class="scripts-shell-stat" data-tone="info"><span class="scripts-shell-stat-mark">UP</span><div class="scripts-shell-stat-copy"><strong>18</strong><span>Updates</span></div></div>
              <div class="scripts-shell-health" id="svCommandHealth"><span class="scripts-shell-stat-mark">OK</span><div class="scripts-shell-health-copy"><strong>Sync healthy</strong><small>Last synced 1m ago</small></div></div>
            </div>
            <div class="scripts-toolbar" role="toolbar" aria-label="Script controls">
              <div class="scripts-toolbar-left toolbar-section">
                <button class="toolbar-btn" id="btnExportAll" type="button">Backup</button>
                <button class="toolbar-btn" id="btnCheckUpdates" type="button">Check updates</button>
                <button class="toolbar-btn" id="btnNewFolder" type="button">Folder</button>
                <button class="toolbar-btn" id="btnFindScripts" type="button">Find</button>
                <div class="toolbar-divider"></div>
                <select id="filterSelect" class="select-field bulk-select" aria-label="Filter scripts"><option>All scripts</option></select>
                <span class="script-counter" id="scriptCounter">1-10 of 128</span>
                <div class="bulk-action-cluster"><label class="bulk-toggle"><input type="checkbox"> <span>Select Shown</span></label><select class="select-field"><option>Choose Action</option></select><button class="btn">Apply</button></div>
                <label class="search-box" aria-label="Search scripts">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="M21 21 16.65 16.65"></path></svg>
                  <input value="" placeholder="Search scripts" aria-label="Search scripts">
                </label>
                <button class="toolbar-btn compact active" id="btnViewToggle" type="button">List</button>
                <button class="toolbar-btn compact" id="btnColumnToggle" type="button">Cols</button>
              </div>
            </div>
            <div class="scripts-workbench-grid">
              <section class="scripts-list-stage">
                <div class="scripts-table-container table-wrapper">
                  <table class="scripts-table">
                    <thead><tr><th class="center">□</th><th class="center">#</th><th class="center">Status</th><th>Name</th><th class="center">Version</th><th class="center">Size</th><th class="center">Lines</th><th class="center">Sites</th><th class="center">Source</th><th class="center">Home</th><th class="center">Updated</th><th class="center">Perf</th><th class="center">More</th></tr></thead>
                    <tbody>${renderRows()}</tbody>
                  </table>
                </div>
                <section class="scripts-update-queue">
                  <div class="scripts-update-queue-header"><div><strong>Update Queue</strong><span class="sv-rail-count warning">3</span></div><div class="scripts-update-queue-actions"><button class="toolbar-btn">Review all</button><button class="toolbar-btn">Update all</button></div></div>
                  <div class="scripts-update-queue-list">
                    <article class="scripts-update-queue-row review-required"><div><strong>Old Forum Fix</strong><span>0.7.1 -> 0.8.0</span></div><a>Changelog</a><span class="pending-update-status review">Requires review</span><button class="toolbar-btn">Review update</button><button class="toolbar-btn">Ignore</button></article>
                    <article class="scripts-update-queue-row review-required"><div><strong>Reddit UI Tweaks</strong><span>2.7.4 -> 2.8.0</span></div><a>Changelog</a><span class="pending-update-status review">Requires review</span><button class="toolbar-btn">Review update</button><button class="toolbar-btn">Ignore</button></article>
                    <article class="scripts-update-queue-row review-required"><div><strong>Netflix Subtitle Tweaks</strong><span>1.1.2 -> 1.2.0</span></div><a>Changelog</a><span class="pending-update-status review">Requires review</span><button class="toolbar-btn">Review update</button><button class="toolbar-btn">Ignore</button></article>
                  </div>
                </section>
              </section>
              <aside class="script-inspector-panel" aria-label="Selected script inspector">
                <div class="script-inspector-header"><span class="script-inspector-eyebrow">Selected Script</span><strong>Reddit UI Tweaks</strong><span>Improve Reddit browsing experience with cleaner UI and quality of life tweaks.</span></div>
                <div class="script-inspector-actions">
                  <button class="btn btn-primary script-inspector-action-tile" type="button"><span>&lt;/&gt;</span>Edit</button>
                  <button class="btn script-inspector-action-tile" type="button"><span>*</span>Config</button>
                  <button class="btn script-inspector-action-tile" type="button"><span>@</span>Site access</button>
                  <button class="btn script-inspector-action-tile" type="button"><span>...</span>Update</button>
                </div>
                <div class="script-inspector-tabs"><button class="active">Overview</button><button>Access</button><button>Grants</button><button>History</button></div>
                <div class="script-inspector-score" data-tone="good"><div><span>Trust Score</span><strong>96%</strong></div><small>No review flags</small></div>
                <div class="script-inspector-section"><h3>Overview</h3><dl class="script-inspector-meta"><div><dt>Status</dt><dd>Enabled</dd></div><div><dt>Version</dt><dd>2.7.4</dd></div><div><dt>Author</dt><dd>not-an-aardvark</dd></div><div><dt>Source</dt><dd>Greasy Fork</dd></div><div><dt>License</dt><dd>MIT</dd></div><div><dt>Runs at</dt><dd>document-end</dd></div><div><dt>Updated</dt><dd>1 day ago</dd></div><div><dt>Installed</dt><dd>14 days ago</dd></div><div><dt>Size</dt><dd>42 KB</dd></div></dl></div>
                <div class="script-inspector-section"><h3>Trust &amp; Security</h3><div class="script-inspector-checks"><div class="script-inspector-check good"><span>Code signature</span><strong>Valid</strong></div><div class="script-inspector-check good"><span>Known vulnerabilities</span><strong>Clear</strong></div><div class="script-inspector-check good"><span>Permissions</span><strong>5 granted</strong></div></div></div>
                <div class="script-inspector-section"><h3>Domain Access</h3><div class="script-inspector-domain-access"><div class="script-inspector-domain-row"><span>reddit.com</span><strong>Allow</strong></div><div class="script-inspector-domain-row"><span>old.reddit.com</span><strong>Allow</strong></div><div class="script-inspector-domain-row"><span>*.redd.it</span><strong>Allow</strong></div></div></div>
              </aside>
            </div>
          </div>
          <footer class="sv-workbench-statusbar"><span>128 scripts - 98 enabled - 30 disabled</span><span>18 with updates</span><span><span class="sv-status-dot good"></span> Engine: Violentmonkey 2.18.0</span></footer>
        </section>
      </div>
    </main>
  `;

  const style = document.createElement("style");
  style.textContent = `
    body {
      min-height: 100vh;
      margin: 0;
      background: var(--sv-app-bg);
    }

    .visual-frame {
      position: relative;
      width: 1540px;
      height: 940px;
      overflow: hidden;
      border: 1px solid var(--hairline-strong);
      background: var(--sv-app-bg);
      box-shadow: var(--shadow-lg);
    }

    .visual-frame .sv-workbench-shell,
    .visual-frame .sv-nav-rail {
      min-height: 940px;
    }

    .visual-frame .sv-workbench-main {
      position: static;
    }

    .visual-frame .scripts-workbench-grid table {
      min-width: 0;
    }

    .visual-frame .search-box svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }

    .visual-frame .sv-workbench-statusbar {
      position: absolute;
      left: 248px;
      right: 0;
      bottom: 0;
    }
  `;
  document.head.append(style);
}

describe("dashboard visual shell", () => {
  it.each(["dark", "light", "catppuccin", "oled"])("matches the pinned %s list-view baseline", async (theme) => {
    await page.viewport(1600, 980);
    renderDashboardShell(theme);

    const shell = page.getByTestId("dashboard-shell");
    await expect.element(shell).toBeVisible();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await expect.element(shell).toMatchScreenshot(`dashboard-list-shell-${theme}`);
  });
});
