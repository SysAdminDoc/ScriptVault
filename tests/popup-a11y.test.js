import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const popupHtml = readFileSync(resolve(process.cwd(), "pages/popup.html"), "utf8");
const popupJs = readFileSync(resolve(process.cwd(), "pages/popup.js"), "utf8");

function parsePopup() {
  return new DOMParser().parseFromString(popupHtml, "text/html");
}

describe("popup UX markup", () => {
  test("empty state exposes title, hint, and icon without redundant action buttons", () => {
    const doc = parsePopup();
    const emptyState = doc.getElementById("emptyState");

    expect(emptyState).not.toBeNull();
    expect(doc.getElementById("emptyStateIcon")).not.toBeNull();
    expect(doc.getElementById("emptyStateTitle")).not.toBeNull();
    expect(doc.getElementById("emptyStateHint")).not.toBeNull();
    expect(doc.getElementById("emptyStateActions")).toBeNull();
    expect(doc.getElementById("btnEmptyFindScripts")).toBeNull();
    expect(doc.getElementById("btnEmptyNewScript")).toBeNull();
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

  test("shared script action dropdown exposes menu semantics", () => {
    const doc = parsePopup();
    const dropdown = doc.getElementById("scriptDropdown");

    expect(dropdown).not.toBeNull();
    expect(dropdown?.getAttribute("role")).toBe("menu");
    expect(dropdown?.getAttribute("aria-label")).toBe("Script actions");
    expect(dropdown?.getAttribute("aria-hidden")).toBe("true");
    expect(dropdown?.hasAttribute("hidden")).toBe(true);
    expect([...dropdown?.querySelectorAll("button") || []].every((button) => button.getAttribute("role") === "menuitem")).toBe(true);
  });

  test("popup script toolbar exposes search and quick filters", () => {
    const doc = parsePopup();
    const toolbar = doc.getElementById("popupScriptToolbar");
    const search = doc.getElementById("popupScriptSearch");
    const clearSearch = doc.getElementById("btnClearPopupScriptSearch");
    const filters = doc.getElementById("popupScriptFilters");
    const filterButtons = Array.from(doc.querySelectorAll("#popupScriptFilters [data-popup-filter]"));

    expect(toolbar).not.toBeNull();
    expect(toolbar?.hasAttribute("hidden")).toBe(true);

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
    ]);
    expect(filterButtons.every((button) => button.getAttribute("type") === "button")).toBe(true);

    expect(doc.getElementById("popupListSummary")).toBeNull();
    expect(doc.getElementById("btnClearPopupScriptView")).toBeNull();
  });

  test("debloated popup drops url bar, page summary, footer total, feedback link, and timeline", () => {
    const doc = parsePopup();
    expect(doc.getElementById("urlBar")).toBeNull();
    expect(doc.getElementById("pageSummary")).toBeNull();
    expect(doc.getElementById("footerTotalCount")).toBeNull();
    expect(doc.getElementById("btnFeedback")).toBeNull();
    expect(doc.querySelector(".popup-meta")).toBeNull();
    expect(popupHtml).not.toMatch(/popup-timeline\.js/);
  });

  test("popup script list exposes list semantics for keyboard scanning", () => {
    const doc = parsePopup();
    const scriptList = doc.getElementById("scriptList");

    expect(scriptList).not.toBeNull();
    expect(scriptList?.hasAttribute("hidden")).toBe(true);
    expect(scriptList?.getAttribute("role")).toBe("list");
    expect(scriptList?.getAttribute("aria-label")).toBe("Scripts for this page");
  });
});

describe("popup UX controller", () => {
  test("popup controller centralizes toolbar, busy states, and submenu state", () => {
    expect(popupJs).toMatch(/function updatePopupToolbarVisibility\(\)/);
    expect(popupJs).toMatch(/function updatePrimaryActionMenuVisibility\(\)/);
    expect(popupJs).toMatch(/const busyControls = new WeakSet\(\);/);
    expect(popupJs).toMatch(/const pendingScriptActions = new Set\(\);/);
    expect(popupJs).toMatch(/async function runBusyControl\(control, task\)/);
    expect(popupJs).toMatch(/async function runScriptAction\(scriptId, task\)/);
    expect(popupJs).toMatch(/async function copyTextToClipboard\(text\)/);
    expect(popupJs).toMatch(/function derivePopupHomepageUrl\(url\)/);
    expect(popupJs).toMatch(/function describePopupScriptProvenance\(script\)/);
    expect(popupJs).toMatch(/function configureScriptDropdown\(scriptId\)/);
    expect(popupJs).toMatch(/let pendingPopupFocusDescriptor = null;/);
    expect(popupJs).toMatch(/function getDropdownMenuItems\(\)/);
    expect(popupJs).toMatch(/function getPopupFocusDescriptor\(control = document\.activeElement\)/);
    expect(popupJs).toMatch(/function resolvePopupFocusTarget\(descriptor\)/);
    expect(popupJs).toMatch(/function restorePopupFocus\(descriptor\)/);
    expect(popupJs).toMatch(/function restorePopupFallbackFocus\(\)/);
    expect(popupJs).toMatch(/function queuePopupFocusRestore\(descriptor\)/);
    expect(popupJs).toMatch(/function focusDropdownMenuItem\(target = 0\)/);
    expect(popupJs).toMatch(/function openScriptDropdown\(scriptId, trigger, \{ focusTarget = 0 \} = \{\}\)/);
    expect(popupJs).toMatch(/function setUtilitiesSubmenuOpen\(isOpen, \{ restoreFocus = false \} = \{\}\)/);
    expect(popupJs).toMatch(/elements\.utilitiesSubmenu\.hidden = !isOpen;/);
    expect(popupJs).toMatch(/elements\.popupScriptToolbar\.hidden = !shouldShowToolbar;/);
    expect(popupJs).toMatch(/elements\.btnFindScripts\.hidden = !canFind;/);
    expect(popupJs).toMatch(/if \(elements\.scriptList\) elements\.scriptList\.hidden = true;/);
    expect(popupJs).toMatch(/if \(elements\.scriptList\) elements\.scriptList\.hidden = false;/);
    expect(popupJs).toMatch(/setUtilitiesSubmenuOpen\(false\);\s+await loadPageScripts\(\);/);
    expect(popupJs).toMatch(/if \(e\.key === 'Escape' && elements\.utilitiesSubmenu\?\.classList\.contains\('open'\)\)/);
    expect(popupJs).toMatch(/if \(e\.key === 'Escape' && document\.getElementById\('scriptDropdown'\)\?\.classList\.contains\('open'\)\)/);
    expect(popupJs).toMatch(/document\.addEventListener\('click', \(e\) => \{/);
    expect(popupJs).toMatch(/showPopupToast\('Checking for updates…'\)/);
    expect(popupJs).toMatch(/closeScriptDropdown\(\);[\s\S]*?elements\.scriptList\.innerHTML = displayScripts\.map/);
    expect(popupJs).toMatch(/await copyTextToClipboard\(url\);/);
    expect(popupJs).toMatch(/updateBtn\.disabled = !hasUpdateUrl;/);
    expect(popupJs).toMatch(/copyUrlBtn\.disabled = !installUrl;/);
    expect(popupJs).toMatch(/pinBtn\.textContent = script\?\.settings\?\.pinned \? 'Unpin Script' : 'Pin Script';/);
    expect(popupJs).toMatch(/dropdown\.setAttribute\('aria-label', `Actions for \$\{name\}`\);/);
    expect(popupJs).toMatch(/queuePopupFocusRestore\(getPopupFocusDescriptor\(getDropdownTriggerButton\(scriptId\)\)\);/);
    expect(popupJs).toMatch(/dropdown\.addEventListener\('keydown', \(e\) => \{/);
    expect(popupJs).toMatch(/openScriptDropdown\(scriptId, moreBtn, \{ focusTarget: 0 \}\);/);
    expect(popupJs).toMatch(/openScriptDropdown\(scriptId, moreBtn, \{ focusTarget: -1 \}\);/);
  });

  test("popup toolbar controller supports inline list filtering and keyboard search", () => {
    expect(popupJs).toMatch(/function getPopupActiveFilter\(\)/);
    expect(popupJs).toMatch(/function setPopupActiveFilter\(nextFilter = 'all'\)/);
    expect(popupJs).toMatch(/function getPopupScriptRows\(\)/);
    expect(popupJs).toMatch(/function focusPopupScriptRow\(row\)/);
    expect(popupJs).toMatch(/function resetPopupScriptView\(\)/);
    expect(popupJs).toMatch(/role="listitem" tabindex="0"/);
    expect(popupJs).toMatch(/aria-posinset="\$\{i \+ 1\}" aria-setsize="\$\{displayScripts.length\}"/);
    expect(popupJs).toMatch(/const provenance = describePopupScriptProvenance\(script\);/);
    expect(popupJs).toMatch(/<span class="script-tag edited">Edited<\/span>/);
    expect(popupJs).toMatch(/<span class="script-tag stale">Stale<\/span>/);
    expect(popupJs).toMatch(/<span class="script-tag source"/);
    expect(popupJs).toMatch(/const focusDescriptor = pendingPopupFocusDescriptor/);
    expect(popupJs).toMatch(/requestAnimationFrame\(\(\) => restorePopupFocus\(focusDescriptor\)\);/);
    expect(popupJs).toMatch(/requestAnimationFrame\(\(\) => restorePopupFallbackFocus\(\)\);/);
    expect(popupJs).toMatch(/elements\.popupScriptSearch\?\.value\?\.trim\(\)\.toLowerCase\(\) \|\| ''/);
    expect(popupJs).toMatch(/const activeFilter = getPopupActiveFilter\(\);/);
    expect(popupJs).toMatch(/No scripts matched "\$\{elements\.popupScriptSearch\?\.value\?\.trim\(\) \|\| ''\}" in the current view\./);
    expect(popupJs).toMatch(/elements\.popupScriptSearch\?\.addEventListener\('input', \(\) => \{/);
    expect(popupJs).toMatch(/elements\.btnClearPopupScriptSearch\?\.addEventListener\('click', \(\) => \{/);
    expect(popupJs).toMatch(/elements\.popupScriptFilters\?\.querySelectorAll\('\[data-popup-filter\]'\)\?\./);
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
});
