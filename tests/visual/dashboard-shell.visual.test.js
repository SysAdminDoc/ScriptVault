import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../../pages/theme-tokens.css";
import "../../pages/dashboard.css";

function renderDashboardShell() {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.dataset.density = "comfortable";
  document.documentElement.dataset.uiScale = "1";
  document.body.innerHTML = `
    <main class="visual-frame" data-testid="dashboard-shell" aria-label="ScriptVault dashboard shell">
      <div class="sv-workbench-shell">
        <aside class="sv-nav-rail" aria-label="ScriptVault workspace">
          <div class="sv-rail-brand">
            <div class="script-icon-placeholder" aria-hidden="true">SV</div>
            <div>
              <strong>ScriptVault</strong>
              <span>Control Desk</span>
            </div>
          </div>
          <nav class="sv-rail-nav" aria-label="Dashboard sections">
            <button class="sv-rail-item active" type="button"><span class="sv-rail-icon">SV</span><span>Scripts</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">UP</span><span>Updates</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">UT</span><span>Utilities</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">ST</span><span>Settings</span></button>
            <button class="sv-rail-item" type="button"><span class="sv-rail-icon">RC</span><span>Recovery</span></button>
          </nav>
          <div class="sv-rail-section">
            <span class="sv-rail-section-title">Trust</span>
            <div class="sv-rail-metric"><span>Host access</span><strong>Scoped</strong></div>
            <div class="sv-rail-metric"><span>Backups</span><strong>Local</strong></div>
          </div>
          <div class="sv-rail-footer"><span class="sv-sync-dot" aria-hidden="true"></span><span>Vault healthy</span></div>
        </aside>
        <section class="tm-content sv-workbench-main">
          <div id="scriptsPanel" class="tm-panel active">
            <div class="scripts-shell-header">
              <div class="scripts-shell-copy">
                <span class="scripts-shell-kicker">Workspace</span>
                <h2>Installed Userscripts</h2>
                <p>Install, organize, and inspect scripts without slowing down the control surface.</p>
              </div>
              <div class="scripts-shell-stats" aria-label="Workspace stats">
                <div class="scripts-shell-stat"><span>Installed</span><strong>4</strong></div>
                <div class="scripts-shell-stat"><span>Active</span><strong>3</strong></div>
                <div class="scripts-shell-stat"><span>Storage</span><strong>1.7 MB</strong></div>
              </div>
            </div>
            <div class="scripts-toolbar" role="toolbar" aria-label="Script controls">
              <div class="scripts-toolbar-left toolbar-section">
                <button class="toolbar-btn toolbar-btn-primary primary" type="button">New</button>
                <button class="toolbar-btn" type="button">Install URL</button>
                <button class="toolbar-btn" type="button">Backup</button>
                <select class="select-field" aria-label="Status"><option>All scripts</option></select>
                <span class="script-counter">Showing 4</span>
                <label class="search-box" aria-label="Search scripts">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="7" cy="7" r="4"></circle>
                    <path d="M10.5 10.5 14 14"></path>
                  </svg>
                  <input value="privacy" aria-label="Search scripts">
                </label>
              </div>
            </div>
            <div class="scripts-workbench-grid">
              <section class="scripts-list-stage">
                <div class="scripts-table-container table-wrapper">
                  <table class="scripts-table">
                    <thead>
                      <tr>
                        <th class="col-checkbox"><input type="checkbox" aria-label="Select all scripts"></th>
                        <th class="col-enabled">On</th>
                        <th class="col-name sortable sort-asc">Name <span class="sort-arrow">^</span></th>
                        <th class="col-version">Version</th>
                        <th class="col-sites">Sites</th>
                        <th class="col-features">Source</th>
                        <th class="col-updated">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="selected">
                        <td class="col-checkbox"><input type="checkbox" checked aria-label="Select Privacy Guard"></td>
                        <td class="col-enabled"><label class="toggle" aria-label="Privacy Guard enabled"><input type="checkbox" checked><span class="toggle-slider"></span></label></td>
                        <td class="col-name">
                          <div class="script-name-cell">
                            <span class="script-icon-placeholder">P</span>
                            <span><span class="script-name">Privacy Guard</span><span class="script-author">SysAdminDoc</span></span>
                            <span class="script-tags"><span class="script-tag">privacy</span><span class="script-tag">security</span></span>
                          </div>
                        </td>
                        <td class="col-version">2.3.0</td>
                        <td class="col-sites"><span class="sites-list"><span class="site-icon site-more">+5</span></span></td>
                        <td class="col-features"><span class="script-tag">Trusted</span></td>
                        <td class="col-updated">Today</td>
                      </tr>
                      <tr>
                        <td class="col-checkbox"><input type="checkbox" aria-label="Select Reader Fixes"></td>
                        <td class="col-enabled"><label class="toggle" aria-label="Reader Fixes enabled"><input type="checkbox" checked><span class="toggle-slider"></span></label></td>
                        <td class="col-name"><div class="script-name-cell"><span class="script-icon-placeholder">R</span><span><span class="script-name">Reader Fixes</span><span class="script-author">Local workspace</span></span><span class="script-tags"><span class="script-tag">reader</span></span></div></td>
                        <td class="col-version">1.8.1</td>
                        <td class="col-sites"><span class="sites-list"><span class="site-icon site-more">+2</span></span></td>
                        <td class="col-features"><span class="script-tag">Local</span></td>
                        <td class="col-updated">Jun 26</td>
                      </tr>
                      <tr>
                        <td class="col-checkbox"><input type="checkbox" aria-label="Select Admin Helper"></td>
                        <td class="col-enabled"><label class="toggle" aria-label="Admin Helper disabled"><input type="checkbox"><span class="toggle-slider"></span></label></td>
                        <td class="col-name"><div class="script-name-cell"><span class="script-icon-placeholder">A</span><span><span class="script-name">Admin Helper</span><span class="script-author">Internal</span></span><span class="conflict-badge">needs review</span></div></td>
                        <td class="col-version">0.9.4</td>
                        <td class="col-sites"><span class="sites-list"><span class="site-icon site-more">+1</span></span></td>
                        <td class="col-features"><span class="script-tag">Review</span></td>
                        <td class="col-updated">Jun 24</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <aside class="script-inspector-panel" aria-label="Selected script inspector">
                <div class="script-inspector-header">
                  <span class="script-inspector-eyebrow">Selected Script</span>
                  <strong>Privacy Guard</strong>
                  <span>Blocks noisy trackers and normalizes consent surfaces.</span>
                </div>
                <div class="script-inspector-actions">
                  <button class="toolbar-btn toolbar-btn-primary primary" type="button">Edit</button>
                  <button class="toolbar-btn" type="button">Check Update</button>
                </div>
                <div class="script-inspector-score" data-tone="good">
                  <div><span>Trust Score</span><strong>94%</strong></div>
                  <small>No review flags</small>
                </div>
                <div class="script-inspector-section">
                  <h3>Overview</h3>
                  <dl class="script-inspector-meta">
                    <div><dt>Status</dt><dd>Enabled</dd></div>
                    <div><dt>Version</dt><dd>2.3.0</dd></div>
                    <div><dt>Updated</dt><dd>Today</dd></div>
                    <div><dt>Runtime</dt><dd>128 runs | 8ms avg</dd></div>
                  </dl>
                </div>
                <div class="script-inspector-section">
                  <h3>Access</h3>
                  <div class="script-inspector-list"><span class="inspector-token">reddit.com</span><span class="inspector-token">news.ycombinator.com</span><span class="inspector-token">+3</span></div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;

  const style = document.createElement("style");
  style.textContent = `
    body {
      min-height: 100vh;
      padding: 20px;
      background: var(--sv-app-bg);
    }

    .visual-frame {
      width: 1200px;
      height: 760px;
      overflow: hidden;
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-md);
      background: var(--sv-app-bg);
      box-shadow: var(--shadow-lg);
    }

    .visual-frame .sv-workbench-shell {
      height: 100%;
      min-height: 0;
    }

    .visual-frame .sv-nav-rail {
      min-height: 728px;
    }

    .visual-frame .sv-workbench-main {
      min-height: 0;
    }

    .visual-frame .table-wrapper {
      overflow: hidden;
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
  `;
  document.head.append(style);
}

describe("dashboard visual shell", () => {
  it("matches the pinned dark list-view baseline", async () => {
    await page.viewport(1280, 820);
    renderDashboardShell();

    const shell = page.getByTestId("dashboard-shell");
    await expect.element(shell).toBeVisible();
    await expect.element(shell).toMatchScreenshot("dashboard-list-shell");
  });
});
