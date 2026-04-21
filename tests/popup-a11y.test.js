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

  test("debloated popup drops the search toolbar, filter chips, page chrome, and timeline", () => {
    const doc = parsePopup();
    expect(doc.getElementById("popupScriptToolbar")).toBeNull();
    expect(doc.getElementById("popupScriptSearch")).toBeNull();
    expect(doc.getElementById("btnClearPopupScriptSearch")).toBeNull();
    expect(doc.getElementById("popupScriptFilters")).toBeNull();
    expect(doc.querySelectorAll('[data-popup-filter]').length).toBe(0);
    expect(doc.getElementById("urlBar")).toBeNull();
    expect(doc.getElementById("pageSummary")).toBeNull();
    expect(doc.getElementById("footerTotalCount")).toBeNull();
    expect(doc.getElementById("btnFeedback")).toBeNull();
    expect(doc.querySelector(".popup-meta")).toBeNull();
    expect(popupHtml).not.toMatch(/popup-timeline\.js/);
    expect(popupHtml).not.toMatch(/\.script-state-pill/);
    expect(popupHtml).not.toMatch(/\.script-secondary/);
    expect(popupHtml).not.toMatch(/\.script-perf/);
    expect(popupHtml).not.toMatch(/\.script-status/);
    expect(popupHtml).not.toMatch(/\.script-tag/);
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
  test("popup controller centralizes busy states, focus, and submenu state", () => {
    expect(popupJs).toMatch(/function updatePrimaryActionMenuVisibility\(\)/);
    expect(popupJs).toMatch(/const busyControls = new WeakSet\(\);/);
    expect(popupJs).toMatch(/const pendingScriptActions = new Set\(\);/);
    expect(popupJs).toMatch(/async function runBusyControl\(control, task\)/);
    expect(popupJs).toMatch(/async function runScriptAction\(scriptId, task\)/);
    expect(popupJs).toMatch(/async function copyTextToClipboard\(text\)/);
    expect(popupJs).toMatch(/function configureScriptDropdown\(scriptId\)/);
    expect(popupJs).toMatch(/let pendingPopupFocusDescriptor = null;/);
    expect(popupJs).toMatch(/function getDropdownMenuItems\(\)/);
    expect(popupJs).toMatch(/function getPopupFocusDescriptor\(control = document\.activeElement\)/);
    expect(popupJs).toMatch(/function resolvePopupFocusTarget\(descriptor\)/);
    expect(popupJs).toMatch(/function restorePopupFocus\(descriptor\)/);
    expect(popupJs).toMatch(/function queuePopupFocusRestore\(descriptor\)/);
    expect(popupJs).toMatch(/function focusDropdownMenuItem\(target = 0\)/);
    expect(popupJs).toMatch(/function openScriptDropdown\(scriptId, trigger, \{ focusTarget = 0 \} = \{\}\)/);
    expect(popupJs).toMatch(/function setUtilitiesSubmenuOpen\(isOpen, \{ restoreFocus = false \} = \{\}\)/);
    expect(popupJs).toMatch(/elements\.utilitiesSubmenu\.hidden = !isOpen;/);
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

  test("popup script rows render only essential controls and keyboard navigation", () => {
    expect(popupJs).toMatch(/function getPopupScriptRows\(\)/);
    expect(popupJs).toMatch(/function focusPopupScriptRow\(row\)/);
    expect(popupJs).toMatch(/const scriptIdAttr = escapeHtml\(script\.id\);/);
    expect(popupJs).toMatch(/data-script-id="\$\{scriptIdAttr\}"/);
    expect(popupJs).toMatch(/data-toggle-id="\$\{scriptIdAttr\}"/);
    expect(popupJs).toMatch(/data-edit-id="\$\{scriptIdAttr\}"/);
    expect(popupJs).toMatch(/data-quickedit-id="\$\{scriptIdAttr\}"/);
    expect(popupJs).toMatch(/data-more-id="\$\{scriptIdAttr\}"/);
    expect(popupJs).not.toContain('data-script-id="${script.id}"');
    expect(popupJs).toMatch(/role="listitem" tabindex="0"/);
    expect(popupJs).toMatch(/aria-posinset="\$\{i \+ 1\}" aria-setsize="\$\{displayScripts.length\}"/);
    expect(popupJs).not.toMatch(/script-state-pill/);
    expect(popupJs).not.toMatch(/script-secondary/);
    expect(popupJs).not.toMatch(/script-perf/);
    expect(popupJs).not.toMatch(/script-status/);
    expect(popupJs).not.toMatch(/script-tag/);
    expect(popupJs).not.toMatch(/script-meta-row/);
    expect(popupJs).not.toMatch(/describePopupScriptProvenance/);
    expect(popupJs).not.toMatch(/popupScriptSearch/);
    expect(popupJs).not.toMatch(/popupScriptFilters/);
    expect(popupJs).not.toMatch(/getPopupActiveFilter/);
    expect(popupJs).toMatch(/const focusDescriptor = pendingPopupFocusDescriptor/);
    expect(popupJs).toMatch(/requestAnimationFrame\(\(\) => restorePopupFocus\(focusDescriptor\)\);/);
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
