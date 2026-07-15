// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runReadabilityCheck } from "../scripts/check-readability.mjs";

const dashboardHtml = readFileSync(resolve(process.cwd(), "pages/dashboard.html"), "utf8");
const dashboardCss = readFileSync(resolve(process.cwd(), "pages/dashboard.css"), "utf8");
const dashboardJs = readFileSync(resolve(process.cwd(), "pages/dashboard.js"), "utf8");
const popupHtml = readFileSync(resolve(process.cwd(), "pages/popup.html"), "utf8");
const popupJs = readFileSync(resolve(process.cwd(), "pages/popup.js"), "utf8");
const sidepanelHtml = readFileSync(resolve(process.cwd(), "pages/sidepanel.html"), "utf8");
const sidepanelJs = readFileSync(resolve(process.cwd(), "pages/sidepanel.js"), "utf8");
const devtoolsHtml = readFileSync(resolve(process.cwd(), "pages/devtools-panel.html"), "utf8");
const installHtml = readFileSync(resolve(process.cwd(), "pages/install.html"), "utf8");
const installJs = readFileSync(resolve(process.cwd(), "pages/install.js"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

function expectForcedColorsSurface(source) {
  expect(source).toContain("@media (forced-colors: active)");
  expect(source).toContain("CanvasText");
  expect(source).toContain("ButtonFace");
  expect(source).toContain("ButtonText");
  expect(source).toContain("Highlight");
  expect(source).toContain("box-shadow: none !important");
  expect(source).toContain("outline: 2px solid Highlight !important");
}

function findTagById(source, id) {
  return source.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>`, "i"))?.[0] || "";
}

function getAttr(tag, attr) {
  return tag.match(new RegExp(`\\b${attr}="([^"]*)"`, "i"))?.[1] || null;
}

function hasClassLink(source, className, href) {
  return source.includes(`class="${className}"`) && source.includes(`href="${href}"`);
}

function expectHelpControl(source, id) {
  const tag = findTagById(source, id);
  expect(tag).toBeTruthy();
  expect(tag).toMatch(/\bdata-help\b/i);
  expect(getAttr(tag, "aria-label")).toBe("Help");
}

function styleBlocksFor(selector, source = dashboardHtml) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...source.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, "g"))]
    .map((match) => match[1]);
}

describe("accessibility surface pass", () => {
  test("a11y command runs every focused surface audit", () => {
    expect(packageJson.scripts["readability:check"]).toBe("node scripts/check-readability.mjs --check");
    expect(packageJson.scripts["test:a11y"]).toContain("scripts/check-readability.mjs");
    expect(packageJson.scripts["test:a11y"]).toContain("tests/dashboard-a11y.test.js");
    expect(packageJson.scripts["test:a11y"]).toContain("tests/popup-a11y.test.js");
    expect(packageJson.scripts["test:a11y"]).toContain("tests/gui-ux-audit.test.js");
    expect(packageJson.scripts["test:a11y"]).toContain("tests/accessibility-surface-pass.test.js");
    expect(packageJson.scripts.check).toContain("node scripts/check-readability.mjs --check");
  });

  test("plain-language audit keeps setup and install copy readable", () => {
    const { results, failures } = runReadabilityCheck();
    expect(failures).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(10);
    expect(Math.min(...results.map((result) => result.score))).toBeGreaterThanOrEqual(60);
  });

  test("major extension surfaces include forced-colors system-color fallbacks", () => {
    expectForcedColorsSurface(dashboardCss);
    expectForcedColorsSurface(popupHtml);
    expectForcedColorsSurface(sidepanelHtml);
    expectForcedColorsSurface(devtoolsHtml);
    expectForcedColorsSurface(installHtml);
  });

  test("major extension surfaces expose skip links or a bypass target", () => {
    expect(hasClassLink(dashboardHtml, "skip-link", "#mainContent")).toBe(true);
    expect(getAttr(findTagById(dashboardHtml, "mainContent"), "tabindex")).toBe("-1");

    expect(hasClassLink(popupHtml, "popup-skip-link", "#menuSection")).toBe(true);
    expect(findTagById(popupHtml, "menuSection")).toBeTruthy();

    expect(hasClassLink(sidepanelHtml, "sp-skip-link", "#pageScriptList")).toBe(true);
    expect(getAttr(findTagById(sidepanelHtml, "pageScriptList"), "role")).toBe("region");

    expect(hasClassLink(installHtml, "install-skip-link", "#content")).toBe(true);
    expect(findTagById(installHtml, "content")).toBeTruthy();
  });

  test("major extension surfaces expose a consistent Help deep link", () => {
    expectHelpControl(dashboardHtml, "btnHelpTab");
    expectHelpControl(popupHtml, "btnHelp");
    expectHelpControl(sidepanelHtml, "btnHelp");
    expectHelpControl(installHtml, "btnHelp");

    expect(dashboardJs).toContain("const DASHBOARD_TABS = ['scripts', 'updates', 'settings', 'utilities', 'trash', 'help']");
    expect(dashboardJs).toContain("await switchTab('help')");
    expect(popupJs).toContain("data: { tab: 'help' }");
    expect(popupJs).toContain("pages/dashboard.html#tab=help");
    expect(sidepanelJs).toContain("openDashboardTarget({ tab: 'help' })");
    expect(sidepanelJs).toContain("chrome.runtime.getURL(`pages/dashboard.html#tab=${encodeURIComponent(data.tab)}`)");
    expect(installJs).toContain("pages/dashboard.html#tab=help");
  });

  test("status, toast, and async surfaces have live-region contracts", () => {
    expect(getAttr(findTagById(dashboardHtml, "a11yAnnouncer"), "role")).toBe("status");
    expect(getAttr(findTagById(dashboardHtml, "a11yAnnouncer"), "aria-live")).toBe("polite");
    expect(getAttr(findTagById(dashboardHtml, "emptyState"), "role")).toBe("status");
    expect(getAttr(findTagById(dashboardHtml, "emptyState"), "aria-live")).toBe("polite");
    expect(getAttr(findTagById(dashboardHtml, "scriptSearch"), "aria-describedby")).toBe("scriptCounter");
    expect(getAttr(findTagById(dashboardHtml, "progressStatus"), "aria-live")).toBe("polite");
    expect(getAttr(findTagById(dashboardHtml, "editorSaveState"), "aria-atomic")).toBe("true");
    expect(dashboardJs).toContain("toast.setAttribute('role', type === 'error' ? 'alert' : 'status')");
    expect(dashboardJs).toContain("toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')");

    expect(getAttr(findTagById(popupHtml, "setupWarning"), "aria-live")).toBe("polite");
    expect(getAttr(findTagById(popupHtml, "emptyState"), "role")).toBe("status");
    expect(popupJs).toContain("toast.setAttribute('role', 'status')");
    expect(popupJs).toContain("toast.setAttribute('aria-live', 'polite')");

    expect(getAttr(findTagById(sidepanelHtml, "statusMessage"), "role")).toBe("status");
    expect(getAttr(findTagById(sidepanelHtml, "spSearchStatus"), "aria-live")).toBe("polite");
    expect(sidepanelJs).toContain("function showPanelNotice");
    expect(sidepanelJs).toContain("notice.hidden = false");
    expect(sidepanelHtml).toContain(".sp-context-banner");
    expect(sidepanelJs).toContain("const banner = document.createElement('button');");
    expect(sidepanelJs).toContain("banner.setAttribute('aria-live', 'assertive');");
    expect(sidepanelJs).toContain("banner.setAttribute('aria-atomic', 'true');");

    expect(installJs).toContain('id="decisionHeroCopy" role="status" aria-live="polite" aria-atomic="true"');
    expect(installJs).toContain('role="alert" aria-live="assertive"');
    expect(installJs).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });

  test("premium polish layer keeps state feedback explicit across surfaces", () => {
    expect(dashboardHtml).toContain("Premium cohesion pass (v3.12)");
    expect(dashboardHtml).toContain("--premium-state-transition");
    expect(dashboardHtml).toContain("Your vault is empty");
    expect(dashboardJs).toContain("No scripts match this view");
    expect(dashboardJs).toContain("function enhanceSettingsPanelSemantics");
    expect(dashboardJs).toContain("function syncSettingsSectionErrorStates");
    expect(dashboardCss).toContain('[data-settings-state="invalid"]');
    expect(dashboardCss).toContain(".toast.toast-info");

    expect(popupHtml).toContain(".popup-toast.warning");
    expect(popupHtml).toContain("No scripts run here");
    expect(popupJs).toContain("toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status')");
    expect(popupJs).toContain("toast.setAttribute('aria-live', toastType === 'error' ? 'assertive' : 'polite')");

    expect(sidepanelHtml).toContain("Premium compact polish");
    expect(sidepanelJs).toContain("No scripts in your vault yet.");
    expect(installHtml).toContain("Premium review polish");
    expect(installHtml).toContain("@keyframes installLoadingSweep");
  });

  test("dashboard workbench exposes the mockup hierarchy and status semantics", () => {
    expect(dashboardHtml).toContain('href="dashboard-workbench.css"');
    expect(dashboardHtml).toContain('class="scripts-shell-actions"');
    expect(dashboardHtml).toContain('id="workspaceUpdatesStat"');
    expect(dashboardHtml).toContain('id="svCommandHealth" role="status" aria-live="polite"');
    expect(dashboardHtml).toContain('Manage, review, and run your userscripts from one trusted workspace.');
    expect(dashboardHtml.match(/id="btnNewScript"/g)).toHaveLength(1);
    expect(dashboardHtml.match(/id="btnImportScript"/g)).toHaveLength(1);
    expect(dashboardHtml.match(/id="btnWorkbenchSyncNow"/g)).toHaveLength(1);
    expect(dashboardJs).toContain("elements.workspaceUpdatesStat = document.getElementById('workspaceUpdatesStat')");
    expect(dashboardJs).toContain("elements.workspaceUpdatesStat.textContent = numberFormatter.format(value)");
  });

  test("dashboard table shell clips corners without trapping the sticky header", () => {
    const tableContainerBlocks = styleBlocksFor(".scripts-table-container");
    const finalTableContainerBlock = tableContainerBlocks.at(-1) || "";

    expect(tableContainerBlocks.length).toBeGreaterThan(1);
    expect(finalTableContainerBlock).toContain("overflow: clip");
    expect(finalTableContainerBlock).not.toMatch(/overflow\s*:\s*hidden\s*;/);
    expect(dashboardHtml).toContain("top: var(--toolbar-bottom");
  });

  test("dashboard script search keeps compact copy and icon-safe padding", () => {
    const searchInputBlocks = styleBlocksFor(".search-box input");
    const finalSearchInputBlock = searchInputBlocks.at(-1) || "";

    expect(dashboardHtml).toContain('placeholder="Search scripts or code:fetch"');
    expect(dashboardHtml).toContain('title="Search by script name, domain, tag, or code:fetch"');
    expect(finalSearchInputBlock).toContain("padding-inline-start: calc(34px * var(--ui-scale))");
    expect(finalSearchInputBlock).toContain("padding-inline-end: calc(34px * var(--ui-scale))");
    expect(dashboardHtml).not.toContain(".search-box:focus-within");
    expect(dashboardHtml).toContain(".search-box input:focus-visible");
    expect(dashboardHtml).toContain("box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14)");
  });

  test("compact popup and side-panel toggles meet 24px touch-target height", () => {
    expect(popupHtml).toContain("width: 40px;");
    expect(popupHtml).toContain("height: 24px;");
    expect(sidepanelHtml).toContain("width: 40px; height: 24px");
    expect(sidepanelHtml).toContain("width: 18px; height: 18px");
  });
});
