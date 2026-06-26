import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const installHtml = readFileSync(resolve(process.cwd(), "pages/install.html"), "utf8");
const installJs = readFileSync(resolve(process.cwd(), "pages/install.js"), "utf8");
const sidepanelHtml = readFileSync(resolve(process.cwd(), "pages/sidepanel.html"), "utf8");
const sidepanelJs = readFileSync(resolve(process.cwd(), "pages/sidepanel.js"), "utf8");
const devtoolsHtml = readFileSync(resolve(process.cwd(), "pages/devtools-panel.html"), "utf8");
const devtoolsJs = readFileSync(resolve(process.cwd(), "pages/devtools-panel.js"), "utf8");
const dashboardJs = readFileSync(resolve(process.cwd(), "pages/dashboard.js"), "utf8");

function parseHtml(source) {
  return new DOMParser().parseFromString(source, "text/html");
}

function pageUiFiles(dir = resolve(process.cwd(), "pages")) {
  return readdirSync(dir).flatMap((entry) => {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) return pageUiFiles(full);
    return /\.(html|css|js)$/.test(entry) ? [full] : [];
  });
}

describe("cross-surface UX audit", () => {
  test("UI surfaces avoid oversized rounded backdrops and blur-heavy chrome", () => {
    const disallowedRadius = /border-radius:[^;]*(?:1[3-9]|2[0-9]|999)px/;
    const disallowedScaledRadius = /border-radius:\s*calc\((?:9|1[0-9])px \* var\(--ui-scale\)\)/;
    const blurBackdrop = /(?:-webkit-)?backdrop-filter:\s*blur\(/;
    const offenders = [];

    for (const file of pageUiFiles()) {
      const source = readFileSync(file, "utf8");
      if (disallowedRadius.test(source)) offenders.push(`${file}: oversized border radius`);
      if (disallowedScaledRadius.test(source)) offenders.push(`${file}: unclamped scaled border radius`);
      if (blurBackdrop.test(source)) offenders.push(`${file}: blur backdrop`);
    }

    expect(offenders).toEqual([]);
  });

  test("install flow keeps expandable rule disclosures and live review status", () => {
    expect(installHtml).toContain(".match-list-toggle");
    expect(installHtml).toContain(".review-nav");
    expect(installHtml).toContain(".review-nav-status");
    expect(installHtml).toContain(".decision-hero");
    expect(installHtml).toContain(".install-terminal");
    expect(installHtml).toContain(".install-state-mark");
    expect(installHtml).toContain(".install-inline-mark");
    expect(installHtml).toContain(".success-next-step");
    expect(installJs).toContain("function renderExpandablePatternSection");
    expect(installJs).toContain("function setupExpandablePatternSections");
    expect(installJs).toContain("function setupReviewNav");
    expect(installJs).toContain("function getDecisionHeroState()");
    expect(installJs).toContain("function updateDecisionHero()");
    expect(installJs).toContain("function setCodePreviewExpanded(expanded, { restoreFocus = false } = {})");
    expect(installJs).toContain("function clearInstallError()");
    expect(installJs).toContain("let reviewExitGuardActive = false;");
    expect(installJs).toContain("function setReviewExitGuard(active)");
    expect(installJs).toContain("window.addEventListener('beforeunload', (event) => {");
    expect(installJs).toContain('id="reviewNav"');
    expect(installJs).toContain('id="reviewNavStatus" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain('id="analysisMount"');
    expect(installJs).toContain('id="trustMount"');
    expect(installJs).toContain('id="decisionHero" data-tone="neutral"');
    expect(installJs).toContain('id="decisionHeroCopy" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain('id="code-container" hidden aria-hidden="true"');
    expect(installJs).toContain("reviewSecurity");
    expect(installJs).toContain('id="reviewInstall"');
    expect(installJs).toContain('id="dep-status" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain('id="analysisStatus" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain("button.setAttribute('aria-current', 'location')");
    expect(installJs).toContain("event.key === 'ArrowRight'");
    expect(installJs).toContain("event.key === 'Home'");
    expect(installJs).toContain("event.key === 'End'");
    expect(installJs).toContain('rel="noopener noreferrer"');
    expect(installJs).toContain('role="alert" aria-live="assertive"');
    expect(installJs).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain('aria-labelledby="installTerminalTitle" aria-describedby="installTerminalMessage"');
    expect(installJs).toContain("No script was saved. Review the install details, then try again.");
    expect(installJs).toContain("ScriptVault saved the script locally before leaving the install review.");
    expect(installJs).toContain("Open Dashboard");
    expect(installJs).not.toContain("\\u26A0\\uFE0F");
    expect(installJs).not.toContain("\\u274C");
    expect(installJs).not.toContain("\\u2705");
    expect(installJs).toContain("if (codeContainer?.classList.contains('expanded')) {");
    expect(installJs).toContain("setCodePreviewExpanded(false, { restoreFocus: true });");
  });

  test("side panel exposes clearer search and collapse semantics", () => {
    const doc = parseHtml(sidepanelHtml);
    const searchBar = doc.querySelector('.sp-search-bar[role="search"]');
    const searchInput = doc.getElementById("spSearch");
    const clearButton = doc.getElementById("btnClearSearch");
    const searchStatus = doc.getElementById("spSearchStatus");
    const allSectionHeader = doc.getElementById("allSectionHeader");
    const allScriptList = doc.getElementById("allScriptList");

    expect(searchBar).not.toBeNull();
    expect(searchInput?.getAttribute("type")).toBe("search");
    expect(searchInput?.getAttribute("aria-describedby")).toBe("spSearchStatus");
    expect(clearButton?.getAttribute("type")).toBe("button");
    expect(searchStatus?.getAttribute("role")).toBe("status");
    expect(searchStatus?.getAttribute("aria-live")).toBe("polite");
    expect(allSectionHeader?.getAttribute("aria-controls")).toBe("allScriptList");
    expect(allSectionHeader?.getAttribute("aria-expanded")).toBe("true");
    expect(doc.getElementById("pageScriptList")?.getAttribute("role")).toBe("list");
    expect(allScriptList?.getAttribute("role")).toBe("list");
    expect(allScriptList?.getAttribute("aria-labelledby")).toBe("allSectionHeader");

    expect(sidepanelJs).toContain("function updateSearchSummary");
    expect(sidepanelJs).toContain("function setAllScriptsCollapsed");
    expect(sidepanelJs).toContain("function setButtonLabel");
    expect(sidepanelJs).toContain("const pendingScriptActions = new Set();");
    expect(sidepanelJs).toContain("function setScriptRowsBusy(scriptId, isBusy)");
    expect(sidepanelJs).toContain("function getScriptToggleLabel(script, enabled = script.enabled !== false)");
    expect(sidepanelJs).toContain("function focusWithinScriptList(control, selector, direction)");
    expect(sidepanelJs).toContain("function getSidepanelFocusDescriptor(control = document.activeElement)");
    expect(sidepanelJs).toContain("function resolveSidepanelFocusTarget(descriptor)");
    expect(sidepanelJs).toContain("function restoreSidepanelFocus(descriptor)");
    expect(sidepanelJs).toContain("function restoreSidepanelFallbackFocus(listName)");
    expect(sidepanelJs).toContain("input.setAttribute('aria-label', getScriptToggleLabel(script, enabled));");
    expect(sidepanelJs).toContain("detailText = isPageScript");
    expect(sidepanelJs).toContain("Available on this page");
    expect(sidepanelJs).toContain("Paused for this page");
    expect(sidepanelJs).toContain("if (pendingScriptActions.has(id)) return;");
    expect(sidepanelJs).toContain("event.key === 'ArrowDown'");
    expect(sidepanelJs).toContain("event.key === 'ArrowUp'");
    expect(sidepanelJs).toContain("event.key === 'Home'");
    expect(sidepanelJs).toContain("event.key === 'End'");
    expect(sidepanelJs).toContain("const focusDescriptor = list.contains(document.activeElement) ? getSidepanelFocusDescriptor(document.activeElement) : null;");
    expect(sidepanelJs).toContain("requestAnimationFrame(() => restoreSidepanelFocus(focusDescriptor));");
    expect(sidepanelJs).toContain("requestAnimationFrame(() => restoreSidepanelFallbackFocus('page'));");
    expect(sidepanelJs).toContain("requestAnimationFrame(() => restoreSidepanelFallbackFocus('all'));");
    expect(sidepanelJs).toContain("tSidepanel('sideNoMatchingScriptsForQuery', 'No scripts match \"{query}\".', { query: searchQuery })");
    expect(sidepanelJs).toContain("Find for ");
    expect(sidepanelHtml).toContain(".sp-context-banner");
    expect(sidepanelJs).toContain("const banner = document.createElement('button');");
    expect(sidepanelJs).toContain("banner.className = 'sp-context-banner';");
    expect(sidepanelJs).toContain("banner.setAttribute('aria-live', 'assertive');");
    expect(sidepanelJs).toContain("Extension restarted. Reconnect side panel.");
    expect(doc.querySelector("#btnHelp svg")).not.toBeNull();
    expect(doc.querySelector("#btnRefresh svg")).not.toBeNull();
    expect(doc.querySelector("#btnDashboard svg")).not.toBeNull();
    expect(doc.querySelector("#btnFindScripts svg")).not.toBeNull();
  });

  test("devtools panel uses real tab semantics and an honest filter/detail shell", () => {
    const doc = parseHtml(devtoolsHtml);
    const tablist = doc.querySelector('.toolbar-tabs[role="tablist"][aria-label="DevTools sections"]');
    const tabs = Array.from(doc.querySelectorAll('.toolbar-tabs .tab-btn[role="tab"]'));
    const filterInput = doc.getElementById("filterInput");
    const toolbarStatus = doc.getElementById("toolbarStatus");
    const status = doc.getElementById("devtoolsStatus");
    const detail = doc.getElementById("netDetail");
    const panels = Array.from(doc.querySelectorAll('.panel[role="tabpanel"]'));
    const consoleActions = Array.from(doc.querySelectorAll('#consoleEmpty .empty-action'));

    expect(tablist).not.toBeNull();
    expect(tabs.map((tab) => tab.dataset.tab)).toEqual(["network", "execution", "console"]);
    expect(filterInput?.getAttribute("type")).toBe("search");
    expect(filterInput?.getAttribute("aria-describedby")).toBe("toolbarStatus");
    expect(filterInput?.getAttribute("placeholder")).toContain("…");
    expect(toolbarStatus?.getAttribute("role")).toBe("status");
    expect(toolbarStatus?.getAttribute("aria-live")).toBe("polite");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(detail?.getAttribute("role")).toBe("region");
    expect(detail?.getAttribute("aria-hidden")).toBe("true");
    expect(detail?.hasAttribute("hidden")).toBe(true);
    expect(panels).toHaveLength(3);
    expect(consoleActions.map((button) => button.textContent?.trim())).toEqual(["Open Network", "Open Execution"]);

    expect(devtoolsJs).toContain("function setActiveTab");
    expect(devtoolsJs).toContain("function setToolbarStatus(message, tone = '')");
    expect(devtoolsJs).toContain("function setRefreshBusy");
    expect(devtoolsJs).toContain("function clearFilter({ focus = false } = {})");
    expect(devtoolsJs).toContain("function getNetworkRows()");
    expect(devtoolsJs).toContain("function renderDetailContent(entry)");
    expect(devtoolsJs).toContain("function syncNetworkRowState()");
    expect(devtoolsJs).toContain("function focusNetworkRow(target)");
    expect(devtoolsJs).toContain("function closeDetail");
    expect(devtoolsJs).toContain("function updateToolbarContext");
    expect(devtoolsJs).toContain("renderConsoleState()");
    expect(devtoolsJs).toContain("event.key === 'ArrowRight'");
    expect(devtoolsJs).toContain("event.key === 'ArrowDown'");
    expect(devtoolsJs).toContain("event.key === 'ArrowUp'");
    expect(devtoolsJs).toContain("event.key === 'Escape'");
    expect(devtoolsJs).toContain("event.key.toLowerCase() === 'f'");
    expect(devtoolsJs).toContain("const restoreTableFocus = Boolean(activeElement?.closest?.('#netTableBody'));");
    expect(devtoolsJs).toContain("const activeInDetail = Boolean(activeElement?.closest?.('#netDetail'));");
    expect(devtoolsJs).toContain("showDetail(entry, tr, { moveFocus: true });");
    expect(devtoolsJs).toContain("$('btnCloseDetail').focus({ preventScroll: true });");
    expect(devtoolsJs).toContain("if (selectedEntry && $('netDetail').classList.contains('open')) {");
    expect(devtoolsJs).toContain("renderDetailContent(selectedEntry);");
    expect(devtoolsJs).toContain("clearButton.textContent = tDevtools('resetView', 'Reset View');");
    expect(devtoolsJs).toContain("clearButton.setAttribute('aria-label', tDevtools('devtoolsResetExecutionFilter', 'Reset execution filter'));");
    expect(devtoolsJs).toContain("tr.setAttribute('aria-selected', String(selectedRow === entry.id));");
    expect(devtoolsJs).toContain("Console capture isn’t available here yet. Use Network or Execution for current insight.");
    expect(devtoolsJs).toContain("No requests match");
    expect(devtoolsJs).toContain("No scripts match");
    expect(devtoolsJs).toContain("clearButton.textContent = tDevtools('clearAction', 'Clear');");
    expect(devtoolsJs).toContain("clearButton.setAttribute('aria-label', tDevtools('devtoolsClearRecordedNetworkRequests', 'Clear recorded network requests'));");
    expect(devtoolsJs).toContain("No network or execution data to export yet.");
    expect(devtoolsJs).toContain("Diagnostics refresh failed. Showing the last available data.");
    expect(devtoolsHtml).toContain('.toolbar-btn[aria-busy="true"]');
    expect(devtoolsHtml).toContain('--bg: var(--sv-bg)');
    expect(devtoolsHtml).toContain('.exec-table-wrap[aria-busy="true"]::after');
    expect(devtoolsHtml).toContain('id="execTableWrap"');
    expect(devtoolsJs).toContain("$('execTableWrap').setAttribute('aria-busy', String(isBusy));");
  });

  test("dashboard keeps the updated column on a real button control", () => {
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("pendingFocusRestore: null");
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("function getStoreFocusDescriptor(control = document.activeElement)");
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("function resolveStoreFocusTarget(descriptor)");
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("function restoreStoreFocus(descriptor)");
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("function restoreStoreFallbackFocus()");
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("queueStoreFocusRestore(getStoreFocusDescriptor(btn));");
    expect(readFileSync(resolve(process.cwd(), "pages/dashboard-store.js"), "utf8")).toContain("queueMicrotask(() => restoreStoreFocus(focusDescriptor));");
    expect(dashboardJs).toContain('<button type="button" class="updated-link"');
    expect(dashboardJs).toContain("triggerEl.disabled = true");
    expect(dashboardJs).toContain("triggerEl.textContent = force ? 'Forcing…' : 'Checking…'");
  });
});
