import { readFileSync } from "node:fs";
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

describe("cross-surface UX audit", () => {
  test("install flow keeps expandable rule disclosures and live review status", () => {
    expect(installHtml).toContain(".match-list-toggle");
    expect(installHtml).toContain(".review-nav");
    expect(installHtml).toContain(".review-nav-status");
    expect(installJs).toContain("function renderExpandablePatternSection");
    expect(installJs).toContain("function setupExpandablePatternSections");
    expect(installJs).toContain("function setupReviewNav");
    expect(installJs).toContain('id="reviewNav"');
    expect(installJs).toContain('id="reviewNavStatus" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain("reviewSecurity");
    expect(installJs).toContain('id="reviewInstall"');
    expect(installJs).toContain('id="dep-status" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain('id="analysisStatus" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain("button.setAttribute('aria-current', 'location')");
    expect(installJs).toContain("event.key === 'ArrowRight'");
    expect(installJs).toContain("event.key === 'Home'");
    expect(installJs).toContain("event.key === 'End'");
    expect(installJs).toContain('rel="noopener noreferrer"');
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
    expect(sidepanelJs).toContain("const pendingScriptActions = new Set();");
    expect(sidepanelJs).toContain("function setScriptRowsBusy(scriptId, isBusy)");
    expect(sidepanelJs).toContain("function getScriptToggleLabel(script, enabled = script.enabled !== false)");
    expect(sidepanelJs).toContain("function focusWithinScriptList(control, selector, direction)");
    expect(sidepanelJs).toContain("input.setAttribute('aria-label', getScriptToggleLabel(script, enabled));");
    expect(sidepanelJs).toContain("detailText = isPageScript");
    expect(sidepanelJs).toContain("Available on this page");
    expect(sidepanelJs).toContain("Paused for this page");
    expect(sidepanelJs).toContain("if (pendingScriptActions.has(id)) return;");
    expect(sidepanelJs).toContain("event.key === 'ArrowDown'");
    expect(sidepanelJs).toContain("event.key === 'ArrowUp'");
    expect(sidepanelJs).toContain("event.key === 'Home'");
    expect(sidepanelJs).toContain("event.key === 'End'");
    expect(sidepanelJs).toContain('No scripts match "${searchQuery}".');
    expect(sidepanelJs).toContain("Find for ");
  });

  test("devtools panel uses real tab semantics and an honest filter/detail shell", () => {
    const doc = parseHtml(devtoolsHtml);
    const tablist = doc.querySelector('.toolbar-tabs[role="tablist"][aria-label="DevTools sections"]');
    const tabs = Array.from(doc.querySelectorAll('.toolbar-tabs .tab-btn[role="tab"]'));
    const filterInput = doc.getElementById("filterInput");
    const status = doc.getElementById("devtoolsStatus");
    const detail = doc.getElementById("netDetail");
    const panels = Array.from(doc.querySelectorAll('.panel[role="tabpanel"]'));

    expect(tablist).not.toBeNull();
    expect(tabs.map((tab) => tab.dataset.tab)).toEqual(["network", "execution", "console"]);
    expect(filterInput?.getAttribute("type")).toBe("search");
    expect(filterInput?.getAttribute("aria-describedby")).toBe("devtoolsStatus");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(detail?.getAttribute("role")).toBe("region");
    expect(detail?.getAttribute("aria-hidden")).toBe("true");
    expect(detail?.hasAttribute("hidden")).toBe(true);
    expect(panels).toHaveLength(3);

    expect(devtoolsJs).toContain("function setActiveTab");
    expect(devtoolsJs).toContain("function closeDetail");
    expect(devtoolsJs).toContain("function updateToolbarContext");
    expect(devtoolsJs).toContain("event.key === 'ArrowRight'");
    expect(devtoolsJs).toContain("event.key === 'Escape'");
    expect(devtoolsJs).toContain("No requests match");
    expect(devtoolsJs).toContain("No scripts match");
    expect(devtoolsJs).toContain("clearButton.textContent = 'Clear Requests'");
  });

  test("dashboard keeps the updated column on a real button control", () => {
    expect(dashboardJs).toContain('<button type="button" class="updated-link"');
    expect(dashboardJs).toContain("triggerEl.disabled = true");
    expect(dashboardJs).toContain("triggerEl.textContent = force ? 'Forcing…' : 'Checking…'");
  });
});
