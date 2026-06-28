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
      <header class="header">
        <div class="header-top">
          <div class="logo">
            <div class="script-icon-placeholder" aria-hidden="true">SV</div>
            <div class="logo-text">
              <h1>ScriptVault <sup>MV3</sup></h1>
              <small>Open userscript manager</small>
            </div>
          </div>
          <div class="header-stats">
            <span>4 scripts</span>
            <span class="stats-sep">|</span>
            <span>3 enabled</span>
          </div>
        </div>
        <nav class="tabs" aria-label="Dashboard tabs">
          <button class="tab active" type="button">Scripts <span class="tab-count">4</span></button>
          <button class="tab" type="button">Editor</button>
          <button class="tab" type="button">Settings</button>
          <button class="tab" type="button">Utilities</button>
        </nav>
      </header>
      <section class="content">
        <div class="panel active">
          <div class="toolbar">
            <div class="toolbar-section">
              <span class="toolbar-label">Status</span>
              <select class="toolbar-select" aria-label="Status">
                <option>All scripts</option>
              </select>
              <button class="toolbar-btn toolbar-btn-primary" type="button">New</button>
              <button class="toolbar-btn" type="button">Import</button>
            </div>
            <div class="toolbar-right">
              <label class="search-box" aria-label="Search scripts">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="7" cy="7" r="4"></circle>
                  <path d="M10.5 10.5 14 14"></path>
                </svg>
                <input value="privacy" aria-label="Search scripts">
              </label>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="scripts-table">
              <thead>
                <tr>
                  <th class="col-checkbox"><input type="checkbox" aria-label="Select all scripts"></th>
                  <th class="col-enabled">On</th>
                  <th class="col-name sortable sort-asc">Name <span class="sort-arrow">^</span></th>
                  <th class="col-version">Version</th>
                  <th class="col-sites">Sites</th>
                  <th class="col-features">Features</th>
                  <th class="col-updated">Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr class="selected">
                  <td class="col-checkbox"><input type="checkbox" checked aria-label="Select Privacy Guard"></td>
                  <td class="col-enabled">
                    <label class="toggle" aria-label="Privacy Guard enabled">
                      <input type="checkbox" checked>
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td class="col-name">
                    <div class="script-name-cell">
                      <span class="script-icon-placeholder">P</span>
                      <span>
                        <span class="script-name">Privacy Guard</span>
                        <span class="script-author">SysAdminDoc</span>
                      </span>
                      <span class="script-tags">
                        <span class="script-tag">privacy</span>
                        <span class="script-tag">security</span>
                      </span>
                    </div>
                  </td>
                  <td class="col-version">2.3.0</td>
                  <td class="col-sites">
                    <span class="sites-list">
                      <span class="site-icon site-more">+5</span>
                    </span>
                  </td>
                  <td class="col-features"><span class="exec-stat fast">8ms</span></td>
                  <td class="col-updated">Today</td>
                </tr>
                <tr>
                  <td class="col-checkbox"><input type="checkbox" aria-label="Select Reader Fixes"></td>
                  <td class="col-enabled">
                    <label class="toggle" aria-label="Reader Fixes enabled">
                      <input type="checkbox" checked>
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td class="col-name">
                    <div class="script-name-cell">
                      <span class="script-icon-placeholder">R</span>
                      <span>
                        <span class="script-name">Reader Fixes</span>
                        <span class="script-author">Local workspace</span>
                      </span>
                      <span class="script-tags">
                        <span class="script-tag">reader</span>
                      </span>
                    </div>
                  </td>
                  <td class="col-version">1.8.1</td>
                  <td class="col-sites"><span class="sites-list"><span class="site-icon site-more">+2</span></span></td>
                  <td class="col-features"><span class="exec-stat medium">19ms</span></td>
                  <td class="col-updated">Jun 26</td>
                </tr>
                <tr>
                  <td class="col-checkbox"><input type="checkbox" aria-label="Select Admin Helper"></td>
                  <td class="col-enabled">
                    <label class="toggle" aria-label="Admin Helper disabled">
                      <input type="checkbox">
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td class="col-name">
                    <div class="script-name-cell">
                      <span class="script-icon-placeholder">A</span>
                      <span>
                        <span class="script-name">Admin Helper</span>
                        <span class="script-author">Internal</span>
                      </span>
                      <span class="conflict-badge">needs review</span>
                    </div>
                  </td>
                  <td class="col-version">0.9.4</td>
                  <td class="col-sites"><span class="sites-list"><span class="site-icon site-more">+1</span></span></td>
                  <td class="col-features"><span class="exec-stat slow">42ms</span></td>
                  <td class="col-updated">Jun 24</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  `;

  const style = document.createElement("style");
  style.textContent = `
    body {
      min-height: 100vh;
      padding: 24px;
      background:
        radial-gradient(circle at 12% 0%, rgba(34, 197, 94, 0.18), transparent 30%),
        var(--bg-body);
    }

    .visual-frame {
      width: 1024px;
      height: 636px;
      overflow: hidden;
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-md);
      background: var(--bg-row);
      box-shadow: var(--shadow-lg);
    }

    .visual-frame .content {
      min-height: auto;
    }

    .visual-frame .table-wrapper {
      overflow: hidden;
    }

    .visual-frame table {
      min-width: 920px;
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
    await page.viewport(1100, 720);
    renderDashboardShell();

    const shell = page.getByTestId("dashboard-shell");
    await expect.element(shell).toBeVisible();
    await expect.element(shell).toMatchScreenshot("dashboard-list-shell");
  });
});
