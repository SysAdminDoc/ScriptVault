import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const popupHtml = readFileSync(resolve(process.cwd(), "pages/popup.html"), "utf8");
const popupJs = readFileSync(resolve(process.cwd(), "pages/popup.js"), "utf8");
const popupTimelineJs = readFileSync(resolve(process.cwd(), "pages/popup-timeline.js"), "utf8");

function parsePopup() {
  return new DOMParser().parseFromString(popupHtml, "text/html");
}

describe("popup UX markup", () => {
  test("feedback uses real link semantics to the new issue form", () => {
    const doc = parsePopup();
    const feedback = doc.getElementById("btnFeedback");

    expect(feedback).not.toBeNull();
    expect(feedback?.tagName).toBe("A");
    expect(feedback?.getAttribute("href")).toBe("https://github.com/SysAdminDoc/ScriptVault/issues/new");
    expect(feedback?.getAttribute("target")).toBe("_blank");
    expect(feedback?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("empty state exposes actionable recovery buttons", () => {
    const doc = parsePopup();
    const emptyState = doc.getElementById("emptyState");
    const findButton = doc.getElementById("btnEmptyFindScripts");
    const createButton = doc.getElementById("btnEmptyNewScript");

    expect(emptyState).not.toBeNull();
    expect(doc.getElementById("emptyStateIcon")).not.toBeNull();
    expect(doc.getElementById("emptyStateTitle")).not.toBeNull();
    expect(doc.getElementById("emptyStateHint")).not.toBeNull();
    expect(doc.getElementById("emptyStateActions")).not.toBeNull();
    expect(findButton?.getAttribute("type")).toBe("button");
    expect(createButton?.getAttribute("type")).toBe("button");
    expect(findButton?.textContent).toContain("Find Scripts");
    expect(createButton?.textContent).toContain("Create Script");
  });

  test("utilities submenu starts as a hidden grouped action cluster", () => {
    const doc = parsePopup();
    const trigger = doc.getElementById("btnUtilities");
    const submenu = doc.getElementById("utilitiesSubmenu");

    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.getAttribute("aria-controls")).toBe("utilitiesSubmenu");

    expect(submenu).not.toBeNull();
    expect(submenu?.hasAttribute("hidden")).toBe(true);
    expect(submenu?.getAttribute("aria-hidden")).toBe("true");
    expect(submenu?.getAttribute("role")).toBe("group");
    expect(submenu?.getAttribute("aria-label")).toBe("Utility actions");
  });

  test("page summary and shared script menu expose live status and menu semantics", () => {
    const doc = parsePopup();
    const summary = doc.getElementById("pageSummary");
    const dropdown = doc.getElementById("scriptDropdown");

    expect(summary).not.toBeNull();
    expect(summary?.getAttribute("role")).toBe("status");
    expect(summary?.getAttribute("aria-live")).toBe("polite");
    expect(doc.getElementById("pageSummaryTitle")).not.toBeNull();
    expect(doc.getElementById("pageSummaryMeta")).not.toBeNull();
    expect(doc.getElementById("pageSummaryCount")).not.toBeNull();

    expect(dropdown).not.toBeNull();
    expect(dropdown?.getAttribute("role")).toBe("menu");
    expect(dropdown?.getAttribute("aria-label")).toBe("Script actions");
    expect(dropdown?.getAttribute("aria-hidden")).toBe("true");
    expect(dropdown?.hasAttribute("hidden")).toBe(true);
    expect([...dropdown?.querySelectorAll("button") || []].every((button) => button.getAttribute("role") === "menuitem")).toBe(true);
  });
});

describe("popup UX controller", () => {
  test("popup controller centralizes popup summary, busy states, and submenu state", () => {
    expect(popupJs).toMatch(/function updatePageSummary\(displayScripts = pageScripts\)/);
    expect(popupJs).toMatch(/const busyControls = new WeakSet\(\);/);
    expect(popupJs).toMatch(/const pendingScriptActions = new Set\(\);/);
    expect(popupJs).toMatch(/async function runBusyControl\(control, task\)/);
    expect(popupJs).toMatch(/async function runScriptAction\(scriptId, task\)/);
    expect(popupJs).toMatch(/function setUtilitiesSubmenuOpen\(isOpen, \{ restoreFocus = false \} = \{\}\)/);
    expect(popupJs).toMatch(/elements\.utilitiesSubmenu\.hidden = !isOpen;/);
    expect(popupJs).toMatch(/elements\.btnEmptyFindScripts\?\.addEventListener\('click', findScripts\)/);
    expect(popupJs).toMatch(/elements\.btnEmptyNewScript\?\.addEventListener\('click', createNewScript\)/);
    expect(popupJs).toMatch(/setUtilitiesSubmenuOpen\(false\);\s+await loadPageScripts\(\);/);
    expect(popupJs).toMatch(/if \(e\.key === 'Escape' && elements\.utilitiesSubmenu\?\.classList\.contains\('open'\)\)/);
    expect(popupJs).toMatch(/if \(e\.key === 'Escape' && document\.getElementById\('scriptDropdown'\)\?\.classList\.contains\('open'\)\)/);
    expect(popupJs).toMatch(/document\.addEventListener\('click', \(e\) => \{/);
    expect(popupJs).toMatch(/showPopupToast\('Checking for updates…'\)/);
    expect(popupJs).toMatch(/closeScriptDropdown\(\);[\s\S]*?elements\.scriptList\.innerHTML = displayScripts\.map/);
  });

  test("popup timeline uses real disclosure semantics", () => {
    expect(popupTimelineJs).toMatch(/<button class="ptl-header" id="ptlToggle" type="button" aria-expanded="false" aria-controls="ptlPanel">/);
    expect(popupTimelineJs).toMatch(/<div class="ptl-panel" id="ptlPanel" role="region" aria-label="Execution timeline" hidden>/);
    expect(popupTimelineJs).toMatch(/panel\.hidden = !_visible;/);
    expect(popupTimelineJs).toMatch(/toggle\.setAttribute\('aria-expanded', String\(_visible\)\)/);
  });
});
