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

  test("popup script toolbar exposes search, quick filters, and reset controls", () => {
    const doc = parsePopup();
    const toolbar = doc.getElementById("popupScriptToolbar");
    const search = doc.getElementById("popupScriptSearch");
    const clearSearch = doc.getElementById("btnClearPopupScriptSearch");
    const filters = doc.getElementById("popupScriptFilters");
    const filterButtons = Array.from(doc.querySelectorAll("#popupScriptFilters [data-popup-filter]"));
    const summary = doc.getElementById("popupListSummary");
    const resetView = doc.getElementById("btnClearPopupScriptView");

    expect(toolbar).not.toBeNull();

    expect(search).not.toBeNull();
    expect(search?.getAttribute("type")).toBe("search");
    expect(search?.getAttribute("name")).toBe("popup_script_search");
    expect(search?.getAttribute("autocomplete")).toBe("off");
    expect(search?.getAttribute("spellcheck")).toBe("false");

    expect(clearSearch).not.toBeNull();
    expect(clearSearch?.getAttribute("type")).toBe("button");
    expect(clearSearch?.getAttribute("aria-label")).toBe("Clear popup script search");
    expect(clearSearch?.hasAttribute("hidden")).toBe(true);

    expect(filters).not.toBeNull();
    expect(filters?.getAttribute("role")).toBe("group");
    expect(filters?.getAttribute("aria-label")).toBe("Script list filters");
    expect(filterButtons.map((button) => button.getAttribute("data-popup-filter"))).toEqual([
      "all",
      "running",
      "errors",
      "pinned",
      "paused",
    ]);
    expect(filterButtons.every((button) => button.getAttribute("type") === "button")).toBe(true);

    expect(summary).not.toBeNull();
    expect(summary?.getAttribute("role")).toBe("status");
    expect(summary?.getAttribute("aria-live")).toBe("polite");
    expect(summary?.getAttribute("aria-atomic")).toBe("true");

    expect(resetView).not.toBeNull();
    expect(resetView?.getAttribute("type")).toBe("button");
    expect(resetView?.hasAttribute("hidden")).toBe(true);
  });

  test("popup script list exposes list semantics for keyboard scanning", () => {
    const doc = parsePopup();
    const scriptList = doc.getElementById("scriptList");

    expect(scriptList).not.toBeNull();
    expect(scriptList?.getAttribute("role")).toBe("list");
    expect(scriptList?.getAttribute("aria-label")).toBe("Scripts for this page");
  });
});

describe("popup UX controller", () => {
  test("popup controller centralizes popup summary, busy states, and submenu state", () => {
    expect(popupJs).toMatch(/function updatePageSummary\(displayScripts = pageScripts\)/);
    expect(popupJs).toMatch(/const busyControls = new WeakSet\(\);/);
    expect(popupJs).toMatch(/const pendingScriptActions = new Set\(\);/);
    expect(popupJs).toMatch(/async function runBusyControl\(control, task\)/);
    expect(popupJs).toMatch(/async function runScriptAction\(scriptId, task\)/);
    expect(popupJs).toMatch(/async function copyTextToClipboard\(text\)/);
    expect(popupJs).toMatch(/function getDropdownMenuItems\(\)/);
    expect(popupJs).toMatch(/function focusDropdownMenuItem\(target = 0\)/);
    expect(popupJs).toMatch(/function openScriptDropdown\(scriptId, trigger, \{ focusTarget = 0 \} = \{\}\)/);
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
    expect(popupJs).toMatch(/await copyTextToClipboard\(url\);/);
    expect(popupJs).toMatch(/dropdown\.addEventListener\('keydown', \(e\) => \{/);
    expect(popupJs).toMatch(/openScriptDropdown\(scriptId, moreBtn, \{ focusTarget: 0 \}\);/);
    expect(popupJs).toMatch(/openScriptDropdown\(scriptId, moreBtn, \{ focusTarget: -1 \}\);/);
  });

  test("popup toolbar controller supports inline list filtering and keyboard search", () => {
    expect(popupJs).toMatch(/function getPopupActiveFilter\(\)/);
    expect(popupJs).toMatch(/function setPopupActiveFilter\(nextFilter = 'all'\)/);
    expect(popupJs).toMatch(/function updatePopupListSummary\(displayScripts = pageScripts\)/);
    expect(popupJs).toMatch(/function getPopupScriptRows\(\)/);
    expect(popupJs).toMatch(/function focusPopupScriptRow\(row\)/);
    expect(popupJs).toMatch(/function resetPopupScriptView\(\)/);
    expect(popupJs).toMatch(/const hiddenCount = Math\.max\(0, totalMatched - visibleScripts\);/);
    expect(popupJs).toMatch(/role="listitem" tabindex="0"/);
    expect(popupJs).toMatch(/aria-posinset="\$\{i \+ 1\}" aria-setsize="\$\{displayScripts.length\}"/);
    expect(popupJs).toMatch(/elements\.popupScriptSearch\?\.value\?\.trim\(\)\.toLowerCase\(\) \|\| ''/);
    expect(popupJs).toMatch(/const activeFilter = getPopupActiveFilter\(\);/);
    expect(popupJs).toMatch(/No scripts matched "\$\{elements\.popupScriptSearch\?\.value\?\.trim\(\) \|\| ''\}" in the current view\./);
    expect(popupJs).toMatch(/elements\.popupScriptSearch\?\.addEventListener\('input', \(\) => \{/);
    expect(popupJs).toMatch(/elements\.btnClearPopupScriptSearch\?\.addEventListener\('click', \(\) => \{/);
    expect(popupJs).toMatch(/elements\.popupScriptFilters\?\.querySelectorAll\('\[data-popup-filter\]'\)\?\./);
    expect(popupJs).toMatch(/elements\.btnClearPopupScriptView\?\.addEventListener\('click', resetPopupScriptView\);/);
    expect(popupJs).toMatch(/if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.key\.toLowerCase\(\) === 'f'\) \{/);
    expect(popupJs).toMatch(/elements\.popupScriptSearch\?\.focus\(\);/);
    expect(popupJs).toMatch(/elements\.popupScriptSearch\?\.select\?\.\(\);/);
    expect(popupJs).toMatch(/if \(\(e\.key === 'Enter' \|\| e\.key === ' '\) && e\.target === item\) \{/);
    expect(popupJs).toMatch(/if \(e\.key === 'ArrowDown'\) \{/);
    expect(popupJs).toMatch(/focusPopupScriptRow\(next\);/);
    expect(popupJs).toMatch(/if \(e\.key === 'ArrowUp'\) \{/);
    expect(popupJs).toMatch(/focusPopupScriptRow\(prev\);/);
    expect(popupJs).toMatch(/if \(e\.key === 'Home'\) \{/);
    expect(popupJs).toMatch(/focusPopupScriptRow\(items\[0\]\);/);
    expect(popupJs).toMatch(/if \(e\.key === 'End'\) \{/);
    expect(popupJs).toMatch(/focusPopupScriptRow\(items\[items.length - 1\]\);/);
    expect(popupJs).toMatch(/} else if \(e\.key === 'Enter' && focusedRow\) \{/);
  });

  test("popup timeline uses real disclosure semantics", () => {
    expect(popupTimelineJs).toMatch(/<button class="ptl-header" id="ptlToggle" type="button" aria-expanded="false" aria-controls="ptlPanel">/);
    expect(popupTimelineJs).toMatch(/<div class="ptl-panel" id="ptlPanel" role="region" aria-label="Execution timeline" hidden>/);
    expect(popupTimelineJs).toMatch(/panel\.hidden = !_visible;/);
    expect(popupTimelineJs).toMatch(/toggle\.setAttribute\('aria-expanded', String\(_visible\)\)/);
  });
});
