import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardHtml = readFileSync(resolve(process.cwd(), "pages/dashboard.html"), "utf8");
const dashboardJs = readFileSync(resolve(process.cwd(), "pages/dashboard.js"), "utf8");

function parseDashboard() {
  return new DOMParser().parseFromString(dashboardHtml, "text/html");
}

function describeButton(button) {
  return button.id || button.getAttribute("aria-label") || button.textContent.trim() || "(anonymous button)";
}

describe("dashboard accessibility markup", () => {
  test("all buttons declare an explicit button type", () => {
    const doc = parseDashboard();
    const buttons = Array.from(doc.querySelectorAll("button"));
    const missingTypes = buttons
      .filter((button) => !button.hasAttribute("type"))
      .map(describeButton);

    expect(buttons.length).toBeGreaterThan(0);
    expect(missingTypes).toEqual([]);
  });

  test("icon-only buttons expose explicit accessible names", () => {
    const doc = parseDashboard();
    const unlabeledIconButtons = Array.from(doc.querySelectorAll("button"))
      .filter((button) => {
        const text = button.textContent.replace(/\s+/g, "").trim();
        return text.length === 0;
      })
      .filter((button) => !button.getAttribute("aria-label")?.trim())
      .map(describeButton);

    expect(unlabeledIconButtons).toEqual([]);
  });

  test("find userscripts overlay keeps dialog semantics wired to its trigger", () => {
    const doc = parseDashboard();
    const trigger = doc.getElementById("btnFindScripts");
    const overlay = doc.getElementById("findScriptsOverlay");
    const titleId = overlay?.getAttribute("aria-labelledby");

    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("type")).toBe("button");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger?.getAttribute("aria-controls")).toBe("findScriptsOverlay");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(overlay?.hasAttribute("hidden")).toBe(true);
    expect(overlay?.getAttribute("tabindex")).toBe("-1");

    expect(titleId).toBeTruthy();
    expect(doc.getElementById(titleId)).not.toBeNull();
  });

  test("dashboard filter clusters expose labeled group semantics", () => {
    const doc = parseDashboard();
    const labeledGroups = [
      "settingsCategoryFilters",
      "utilitiesCategoryFilters",
      "trashCategoryFilters",
      "helpCategoryFilters",
    ];

    labeledGroups.forEach((id) => {
      const group = doc.getElementById(id);
      expect(group).not.toBeNull();
      expect(group?.getAttribute("role")).toBe("group");
      expect(group?.getAttribute("aria-label")).toMatch(/filters/i);
    });

    const backupBrowserGroup = doc.querySelector('.utilities-filter-row[role="group"][aria-label="Backup browser filters"]');
    expect(backupBrowserGroup).not.toBeNull();
  });

  test("dashboard section tabs keep live panel and skip-link wiring", () => {
    const doc = parseDashboard();
    const skipLink = doc.querySelector(".skip-link");
    const mainContent = doc.getElementById("mainContent");
    const tablist = doc.querySelector('.tm-tablist[role="tablist"][aria-label="Dashboard sections"]');
    const tabs = Array.from(doc.querySelectorAll('.tm-tablist .tm-tab[role="tab"]'));
    const selectedTabs = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
    const helpButton = doc.getElementById("btnHelpTab");
    const helpPanel = doc.getElementById("helpPanel");

    expect(skipLink?.getAttribute("href")).toBe("#mainContent");
    expect(mainContent?.getAttribute("tabindex")).toBe("-1");

    expect(tablist).not.toBeNull();
    expect(tabs.map((tab) => tab.dataset.tab)).toEqual([
      "scripts",
      "settings",
      "utilities",
      "trash",
      "store",
    ]);
    expect(selectedTabs).toHaveLength(1);
    expect(selectedTabs[0]?.dataset.tab).toBe("scripts");

    tabs.forEach((tab) => {
      expect(tab.getAttribute("aria-controls")).toBeTruthy();
      expect(tab.getAttribute("tabindex")).toMatch(/^(-1|0)$/);

      const panel = doc.getElementById(tab.getAttribute("aria-controls"));
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    });

    expect(doc.getElementById("scriptsPanel")?.hasAttribute("hidden")).toBe(false);
    expect(doc.getElementById("settingsPanel")?.hasAttribute("hidden")).toBe(true);
    expect(doc.getElementById("utilitiesPanel")?.hasAttribute("hidden")).toBe(true);
    expect(doc.getElementById("trashPanel")?.hasAttribute("hidden")).toBe(true);
    expect(doc.getElementById("storePanel")?.hasAttribute("hidden")).toBe(true);

    expect(helpButton).not.toBeNull();
    expect(helpButton?.getAttribute("aria-controls")).toBe("helpPanel");
    expect(helpButton?.getAttribute("aria-expanded")).toBe("false");
    expect(helpButton?.getAttribute("aria-pressed")).toBe("false");
    expect(helpPanel).not.toBeNull();
    expect(helpPanel?.getAttribute("role")).toBe("region");
    expect(helpPanel?.getAttribute("aria-labelledby")).toBe("btnHelpTab");
    expect(helpPanel?.hasAttribute("hidden")).toBe(true);
  });

  test("script tab strip exposes a labeled group container", () => {
    const doc = parseDashboard();
    const scriptTabsGroup = doc.getElementById("scriptTabsGroup");

    expect(scriptTabsGroup).not.toBeNull();
    expect(scriptTabsGroup?.getAttribute("role")).toBe("group");
    expect(scriptTabsGroup?.getAttribute("aria-label")).toBe("Open script editors");
  });

  test("editor tabs expose a complete tab-to-panel relationship", () => {
    const doc = parseDashboard();
    const tablist = doc.querySelector('.editor-tabs[role="tablist"][aria-label="Script editor panels"]');
    const tabs = Array.from(doc.querySelectorAll(".editor-tab"));
    const selectedTabs = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
    const hiddenPanels = Array.from(doc.querySelectorAll('.editor-panel[hidden]'));

    expect(tablist).not.toBeNull();
    expect(tabs.map((tab) => tab.dataset.panel)).toEqual([
      "code",
      "scriptsettings",
      "externals",
      "storage",
      "info",
    ]);
    expect(selectedTabs).toHaveLength(1);

    tabs.forEach((tab) => {
      expect(tab.getAttribute("role")).toBe("tab");
      expect(tab.getAttribute("aria-controls")).toBeTruthy();
      expect(tab.getAttribute("tabindex")).toMatch(/^(-1|0)$/);

      const panel = doc.getElementById(tab.getAttribute("aria-controls"));
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    });

    expect(selectedTabs[0]?.dataset.panel).toBe("code");
    expect(doc.getElementById("codePanel")?.hasAttribute("hidden")).toBe(false);
    expect(hiddenPanels.map((panel) => panel.id)).toEqual([
      "infoPanel",
      "storagePanel",
      "scriptsettingsPanel",
      "externalsPanel",
    ]);
  });

  test("editor overlay keeps dialog semantics and an explicit close control", () => {
    const doc = parseDashboard();
    const overlay = doc.getElementById("editorOverlay");
    const title = doc.getElementById("editorTitle");
    const subtitle = doc.getElementById("editorSubtitle");
    const closeButton = doc.getElementById("btnEditorClose");

    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
    expect(overlay?.getAttribute("aria-labelledby")).toBe("editorTitle");
    expect(overlay?.getAttribute("aria-describedby")).toBe("editorSubtitle");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(overlay?.getAttribute("tabindex")).toBe("-1");
    expect(overlay?.hasAttribute("hidden")).toBe(true);

    expect(title).not.toBeNull();
    expect(title?.tagName).toBe("H2");
    expect(subtitle).not.toBeNull();
    expect(subtitle?.tagName).toBe("P");

    expect(closeButton).not.toBeNull();
    expect(closeButton?.getAttribute("type")).toBe("button");
    expect(closeButton?.getAttribute("title")).toMatch(/close editor/i);
  });

  test("progress overlay keeps dialog semantics and live status feedback", () => {
    const doc = parseDashboard();
    const overlay = doc.getElementById("progressOverlay");
    const title = doc.getElementById("progressTitle");
    const status = doc.getElementById("progressStatus");

    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
    expect(overlay?.getAttribute("aria-labelledby")).toBe("progressTitle");
    expect(overlay?.getAttribute("aria-describedby")).toBe("progressStatus");
    expect(overlay?.getAttribute("aria-busy")).toBe("false");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(overlay?.getAttribute("tabindex")).toBe("-1");
    expect(overlay?.hasAttribute("hidden")).toBe(true);

    expect(title).not.toBeNull();
    expect(title?.tagName).toBe("H2");
    expect(title?.textContent).toContain("…");

    expect(status).not.toBeNull();
    expect(status?.tagName).toBe("P");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.getAttribute("aria-atomic")).toBe("true");
  });

  test("utility import controls expose labeled input semantics", () => {
    const doc = parseDashboard();
    const importFileName = doc.getElementById("importFileName");
    const textareaData = doc.getElementById("textareaData");
    const importUrlInput = doc.getElementById("importUrlInput");
    const batchUrlInput = doc.getElementById("batchUrlInput");

    expect(importFileName).not.toBeNull();
    expect(importFileName?.getAttribute("role")).toBe("status");
    expect(importFileName?.getAttribute("aria-live")).toBe("polite");
    expect(importFileName?.getAttribute("aria-atomic")).toBe("true");

    expect(textareaData).not.toBeNull();
    expect(textareaData?.getAttribute("name")).toBe("vault_json_data");
    expect(textareaData?.getAttribute("aria-label")).toBe("Vault JSON data");
    expect(textareaData?.getAttribute("spellcheck")).toBe("false");
    expect(textareaData?.getAttribute("placeholder")).toContain("…");

    expect(importUrlInput).not.toBeNull();
    expect(importUrlInput?.getAttribute("type")).toBe("url");
    expect(importUrlInput?.getAttribute("name")).toBe("import_script_url");
    expect(importUrlInput?.getAttribute("aria-label")).toBe("Userscript URL");
    expect(importUrlInput?.getAttribute("autocomplete")).toBe("off");
    expect(importUrlInput?.getAttribute("spellcheck")).toBe("false");
    expect(importUrlInput?.getAttribute("inputmode")).toBe("url");

    expect(batchUrlInput).not.toBeNull();
    expect(batchUrlInput?.getAttribute("name")).toBe("batch_install_urls");
    expect(batchUrlInput?.getAttribute("aria-label")).toBe("Batch install script URLs");
    expect(batchUrlInput?.getAttribute("spellcheck")).toBe("false");
    expect(batchUrlInput?.getAttribute("placeholder")).toContain("…");
  });

  test("editor tab controller keeps externals wired into the runtime map and keyboard navigation", () => {
    expect(dashboardJs).toMatch(/externals\s*:\s*document\.getElementById\(['"]externalsPanel['"]\)/);
    expect(dashboardJs).toMatch(/function setEditorTab/);
    expect(dashboardJs).toMatch(/case 'ArrowLeft':/);
    expect(dashboardJs).toMatch(/case 'ArrowRight':/);
    expect(dashboardJs).toMatch(/case 'Home':/);
    expect(dashboardJs).toMatch(/case 'End':/);
  });

  test("editor overlay controller centralizes focus management and close behavior", () => {
    expect(dashboardJs).toMatch(/let editorLastFocusedElement = null;/);
    expect(dashboardJs).toMatch(/let editorFocusManaged = false;/);
    expect(dashboardJs).toMatch(/const EDITOR_BACKGROUND_SELECTORS = \[/);
    expect(dashboardJs).toMatch(/function setEditorBackgroundHidden/);
    expect(dashboardJs).toMatch(/function openEditorOverlay/);
    expect(dashboardJs).toMatch(/function hideEditorOverlay/);
    expect(dashboardJs).toMatch(/A11y\.trapFocus\(overlay\)/);
    expect(dashboardJs).toMatch(/A11y\.releaseFocus\(\)/);
    expect(dashboardJs).toMatch(/elements\.btnEditorClose\?\.\s*addEventListener\('click', closeEditor\)/);
    expect(dashboardJs).toMatch(/openEditorOverlay\(\)/);
    expect(dashboardJs).toMatch(/hideEditorOverlay\(\)/);
    expect(dashboardJs).toMatch(/Saving…/);
    expect(dashboardJs).toMatch(/Writing changes…/);
  });

  test("progress overlay controller cancels stale hides and restores modal focus state", () => {
    expect(dashboardJs).toMatch(/let progressLastFocusedElement = null;/);
    expect(dashboardJs).toMatch(/let progressFocusManaged = false;/);
    expect(dashboardJs).toMatch(/let progressHideTimer = null;/);
    expect(dashboardJs).toMatch(/const PROGRESS_BACKGROUND_SELECTORS = \[/);
    expect(dashboardJs).toMatch(/function setProgressBackgroundHidden/);
    expect(dashboardJs).toMatch(/clearTimeout\(progressHideTimer\)/);
    expect(dashboardJs).toMatch(/progressEl\.overlay\.setAttribute\('aria-busy', 'true'\)/);
    expect(dashboardJs).toMatch(/progressEl\.overlay\.setAttribute\('aria-busy', 'false'\)/);
    expect(dashboardJs).toMatch(/A11y\.trapFocus\(progressEl\.overlay\)/);
    expect(dashboardJs).toMatch(/A11y\.releaseFocus\(\)/);
    expect(dashboardJs).toMatch(/progressHideTimer = window\.setTimeout/);
  });

  test("utility actions use pending button guards and reset file-import state", () => {
    expect(dashboardJs).toMatch(/async function runButtonTask/);
    expect(dashboardJs).toMatch(/button\.setAttribute\('aria-busy', 'true'\)/);
    expect(dashboardJs).toMatch(/elements\.btnCreateBackup\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/elements\.btnRefreshBackups\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/elements\.btnSaveBackupSettings\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/elements\.btnInstallFromUrl\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/document\.getElementById\('btnBatchInstall'\)\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/elements\.btnTextareaExport\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/elements\.btnTextareaImport\?\.\s*addEventListener\('click', async event =>/);
    expect(dashboardJs).toMatch(/input\.value = '';/);
    expect(dashboardJs).toMatch(/elements\.importFileName\)\s*elements\.importFileName\.textContent = 'No file chosen'/);
    expect(dashboardJs).toMatch(/elements\.btnExportZip\?\.click\(\)/);
    expect(dashboardJs).toMatch(/elements\.btnExportFile\?\.click\(\)/);
  });

  test("backup review flow preserves selection on canceled restore confirmation and guards async actions", () => {
    expect(dashboardJs).toMatch(/btn\.addEventListener\('click', async \(\) => \{\s*await runButtonTask\(btn, a\.callback, \{ busyLabel: a\.busyLabel \}\);/);
    expect(dashboardJs).toMatch(/button\.addEventListener\('click', async \(\) => \{\s*await runButtonTask\(button, \(\) => openBackupReviewModal\(button\.dataset\.backupReview\), \{ busyLabel: 'Loading…' \}\);/);
    expect(dashboardJs).toMatch(/button\.addEventListener\('click', async \(\) => \{\s*await runButtonTask\(button, \(\) => exportStoredBackup\(button\.dataset\.backupExport\), \{ busyLabel: 'Downloading…' \}\);/);
    expect(dashboardJs).toMatch(/const hasExplicitSelection = Array\.isArray\(options\.selectedScriptIds\);/);
    expect(dashboardJs).toMatch(/const selectedScriptIdSet = new Set\(hasExplicitSelection \? options\.selectedScriptIds\.filter\(Boolean\) : \[\]\);/);
    expect(dashboardJs).toMatch(/const reopenBackupReview = async selectedScriptIds => \{\s*await openBackupReviewModal\(backupId, \{ selectedScriptIds \}\);\s*\};/);
    expect(dashboardJs).toMatch(/if \(!confirmed\) \{\s*await reopenBackupReview\(selected\);\s*return;\s*\}/);
    expect(dashboardJs).toMatch(/if \(!confirmed\) \{\s*await reopenBackupReview\(preservedSelection\);\s*return;\s*\}/);
    expect(dashboardJs).toMatch(/busyLabel: 'Downloading…'/);
  });

  test("backup restore controller keeps progress open through folder-aware dashboard refresh", () => {
    expect(dashboardJs).toMatch(/updateProgress\(0, 3, progressDetail\)/);
    expect(dashboardJs).toMatch(/updateProgress\(1, 3, 'Refreshing folders…'\)/);
    expect(dashboardJs).toMatch(/await loadFolders\(\);/);
    expect(dashboardJs).toMatch(/updateProgress\(2, 3, 'Refreshing scripts, settings, and workspaces…'\)/);
    expect(dashboardJs).toMatch(/await Promise\.all\(\[\s*loadScripts\(\),\s*loadSettings\(\),\s*loadWorkspaces\(\)\s*\]\);/);
    expect(dashboardJs).toMatch(/updateStats\(\);\s*updateProgress\(3, 3, 'Restore complete'\);\s*hideProgress\(\);/);
  });

  test("trash and workspace actions use guarded async buttons and refresh live summaries", () => {
    expect(dashboardJs).toMatch(/runButtonTask\(button, async \(\) => \{\s*try \{\s*const response = await chrome\.runtime\.sendMessage\(\{ action: 'restoreFromTrash', scriptId: script\.id \}\);/);
    expect(dashboardJs).toMatch(/await Promise\.all\(\[loadTrash\(\), loadScripts\(\)\]\);\s*updateStats\(\);\s*showToast\('Script restored', 'success'\);/);
    expect(dashboardJs).toMatch(/runButtonTask\(button, async \(\) => \{\s*const confirm = await showConfirmModal\(\s*'Delete Forever'/);
    expect(dashboardJs).toMatch(/<button type="button" class="toolbar-btn\$\{ws\.id === active \? ' primary' : ''\}" data-ws-activate="\$\{ws\.id\}"\$\{ws\.id === active \? ' disabled aria-current="true" title="Current workspace"' : ' title="Switch to workspace"'}/);
    expect(dashboardJs).toMatch(/showToast\('Switching workspace…', 'info'\);/);
    expect(dashboardJs).toMatch(/await Promise\.all\(\[loadScripts\(\), loadWorkspaces\(\)\]\);\s*updateStats\(\);\s*showToast\(`Workspace "\$\{res\.name\}" activated`, 'success'\);/);
    expect(dashboardJs).toMatch(/runButtonTask\(btn, async \(\) => \{\s*const workspaceName = btn\.closest/);
    expect(dashboardJs).toMatch(/\}, \{ busyLabel: 'Saving…' \}\);/);
    expect(dashboardJs).toMatch(/\}, \{ busyLabel: 'Deleting…' \}\);/);
  });

  test("script toggle and folder actions keep table state honest during async updates", () => {
    expect(dashboardJs).toMatch(/async function toggleScriptEnabled\(scriptId, enabled, options = \{\}\)/);
    expect(dashboardJs).toMatch(/control\.disabled = true;/);
    expect(dashboardJs).toMatch(/control\.setAttribute\('aria-busy', 'true'\)/);
    expect(dashboardJs).toMatch(/const previousEnabled = script \? script\.enabled !== false : !enabled;/);
    expect(dashboardJs).toMatch(/renderScriptTable\(\);\s*updateStats\(\);\s*showToast\(enabled \? 'Enabled' : 'Disabled', 'success'\);/);
    expect(dashboardJs).toMatch(/if \(control instanceof HTMLInputElement && control\.isConnected\) \{\s*control\.checked = previousEnabled;/);
    expect(dashboardJs).toMatch(/showToast\('Failed to update script status', 'error'\);/);
    expect(dashboardJs).toMatch(/folderTr\.addEventListener\('click', async \(e\) => \{/);
    expect(dashboardJs).toMatch(/await runButtonTask\(deleteButton, \(\) => deleteFolder\(folder\.id\), \{ busyLabel: 'Deleting…' \}\);/);
    expect(dashboardJs).toMatch(/showToast\('Failed to delete folder', 'error'\);/);
    expect(dashboardJs).toMatch(/showToast\(toId \? 'Script moved to folder' : 'Script removed from folder', 'success'\);/);
    expect(dashboardJs).toMatch(/showToast\('Failed to move script', 'error'\);/);
  });

  test("dashboard tab controller synchronizes help state, keyboard navigation, and dynamic tab buttons", () => {
    expect(dashboardJs).toMatch(/function clearDashboardSectionSelection/);
    expect(dashboardJs).toMatch(/function setDashboardSection/);
    expect(dashboardJs).toMatch(/elements\.dashboardTabs\s*=\s*document\.querySelectorAll\(['"]\.tm-tab\[role="tab"\]['"]\)/);
    expect(dashboardJs).toMatch(/elements\.btnHelpTab\?\.\s*setAttribute\('aria-expanded', 'true'\)/);
    expect(dashboardJs).toMatch(/elements\.btnHelpTab\?\.\s*setAttribute\('aria-pressed', 'true'\)/);
    expect(dashboardJs).toMatch(/await switchTab\(tabs\[nextIndex\]\?\.dataset\.tab,\s*\{\s*focusControl:\s*true\s*\}\)/);
    expect(dashboardJs).toMatch(/tab\.type\s*=\s*'button'/);
  });

  test("command palette controller exposes active result semantics and item-only keyboard navigation", () => {
    expect(dashboardJs).toMatch(/function getCommandPaletteItems/);
    expect(dashboardJs).toMatch(/function setCommandPaletteActiveItem/);
    expect(dashboardJs).toMatch(/type="search"/);
    expect(dashboardJs).toMatch(/name="command_palette_query"/);
    expect(dashboardJs).toMatch(/aria-autocomplete="list"/);
    expect(dashboardJs).toMatch(/aria-controls="commandPaletteResults"/);
    expect(dashboardJs).toMatch(/aria-activedescendant/);
    expect(dashboardJs).toMatch(/aria-selected="\$\{String\(isActive\)\}"/);
    expect(dashboardJs).toMatch(/case 'Home':/);
    expect(dashboardJs).toMatch(/case 'End':/);
    expect(dashboardJs).not.toMatch(/nextElementSibling/);
    expect(dashboardJs).not.toMatch(/previousElementSibling/);
  });

  test("script tab controller advertises close shortcuts and keyboard tab-strip navigation", () => {
    expect(dashboardJs).toMatch(/function getOpenScriptTabs/);
    expect(dashboardJs).toMatch(/function syncScriptTabAccessibility/);
    expect(dashboardJs).toMatch(/aria-keyshortcuts', 'Delete Backspace'/);
    expect(dashboardJs).toMatch(/case 'Delete':/);
    expect(dashboardJs).toMatch(/case 'Backspace':/);
    expect(dashboardJs).toMatch(/closeScriptTab\(scriptId,\s*\{\s*focusFallbackScriptId:/);
    expect(dashboardJs).toMatch(/tabs\[nextIndex\]\?\.focus\(\)/);
  });

  test("library search input keeps accessible search semantics", () => {
    const doc = parseDashboard();
    const input = doc.getElementById("libSearchInput");
    const results = doc.getElementById("libSearchResults");

    expect(input).not.toBeNull();
    expect(input?.getAttribute("type")).toBe("search");
    expect(input?.getAttribute("name")).toBe("librarySearch");
    expect(input?.getAttribute("aria-label")).toBe("Search CDN libraries");
    expect(input?.getAttribute("autocomplete")).toBe("off");
    expect(input?.getAttribute("spellcheck")).toBe("false");
    expect(input?.getAttribute("placeholder")).toContain("…");

    expect(results).not.toBeNull();
    expect(results?.getAttribute("aria-live")).toBe("polite");
  });
});
