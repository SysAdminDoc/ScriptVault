import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const debuggerJs = readFileSync(resolve(process.cwd(), "pages/dashboard-debugger.js"), "utf8");
const patternBuilderJs = readFileSync(resolve(process.cwd(), "pages/dashboard-pattern-builder.js"), "utf8");
const schedulerJs = readFileSync(resolve(process.cwd(), "pages/dashboard-scheduler.js"), "utf8");
const snippetsJs = readFileSync(resolve(process.cwd(), "pages/dashboard-snippets.js"), "utf8");
const themeEditorJs = readFileSync(resolve(process.cwd(), "pages/dashboard-theme-editor.js"), "utf8");
const sharingJs = readFileSync(resolve(process.cwd(), "pages/dashboard-sharing.js"), "utf8");
const depgraphJs = readFileSync(resolve(process.cwd(), "pages/dashboard-depgraph.js"), "utf8");
const gistJs = readFileSync(resolve(process.cwd(), "pages/dashboard-gist.js"), "utf8");

describe("secondary dashboard UX audit", () => {
  test("debugger uses semantic controls and improved input affordances", () => {
    expect(debuggerJs).not.toMatch(/transition:\s*all/);
    expect(debuggerJs).toMatch(/const bar = el\('div', \{ class: 'dbg-tabs', role: 'tablist', 'aria-label': 'Debugger views' \}\)/);
    expect(debuggerJs).toMatch(/const tab = el\('button', \{/);
    expect(debuggerJs).toMatch(/type: 'search'/);
    expect(debuggerJs).toMatch(/name: 'debugVariableSearch'/);
    expect(debuggerJs).toMatch(/placeholder: 'Search Variables…'/);
    expect(debuggerJs).toMatch(/'aria-pressed': String\(_liveReload\[id\]\)/);
    expect(debuggerJs).toMatch(/const toggle = el\('button', \{ class: 'dbg-json-toggle'/);
  });

  test("pattern builder uses real buttons and URL-aware testing controls", () => {
    expect(patternBuilderJs).not.toMatch(/transition:\s*all/);
    expect(patternBuilderJs).toMatch(/const wildcardToggle = el\('button', \{/);
    expect(patternBuilderJs).toMatch(/'aria-label': 'Toggle subdomain wildcard prefix'/);
    expect(patternBuilderJs).toMatch(/type: 'url'/);
    expect(patternBuilderJs).toMatch(/name: 'patternBuilderTestUrl'/);
    expect(patternBuilderJs).toMatch(/placeholder: 'Paste a URL & press Enter to test…'/);
    expect(patternBuilderJs).toMatch(/const removeBtn = el\('button', \{ class: 'pb-remove-btn'/);
    expect(patternBuilderJs).toMatch(/const chip = el\('button', \{ class: 'pb-preset-chip'/);
  });

  test("scheduler exposes tab and day controls as accessible buttons", () => {
    expect(schedulerJs).not.toMatch(/transition:\s*all/);
    expect(schedulerJs).toMatch(/role: 'tablist'/);
    expect(schedulerJs).toMatch(/role: 'tab'/);
    expect(schedulerJs).toMatch(/role: 'tabpanel'/);
    expect(schedulerJs).toMatch(/const day = el\('button', \{/);
    expect(schedulerJs).toMatch(/'aria-pressed': 'false'/);
    expect(schedulerJs).toMatch(/setAttribute\('aria-selected', String\(isActive\)\)/);
    expect(schedulerJs).toMatch(/setAttribute\('aria-pressed', String\(isActive\)\)/);
    expect(schedulerJs).toMatch(/'aria-label': 'Close schedule dialog'/);
  });

  test("snippets tighten search and modal semantics", () => {
    expect(snippetsJs).not.toMatch(/transition:\s*all/);
    expect(snippetsJs).toMatch(/type="search" class="snip-search" name="snippetSearch" autocomplete="off" spellcheck="false" placeholder="Search Snippets…"/);
    expect(snippetsJs).toMatch(/role="dialog" aria-modal="true" aria-label="/);
    expect(snippetsJs).toMatch(/id="snip-edit-save" type="button"/);
    expect(snippetsJs).toMatch(/id="snip-del-confirm" type="button"/);
  });

  test("theme editor uses button-based sections and presets", () => {
    expect(themeEditorJs).not.toMatch(/transition:\s*all/);
    expect(themeEditorJs).toMatch(/function buildSectionHeader\(title, section, startsExpanded = true\)/);
    expect(themeEditorJs).toMatch(/const header = el\('button', \{/);
    expect(themeEditorJs).toMatch(/const card = el\('button', \{/);
    expect(themeEditorJs).toMatch(/'aria-pressed': String\(_activePreset === key\)/);
    expect(themeEditorJs).toMatch(/placeholder="Custom theme name…"/);
    expect(themeEditorJs).toMatch(/\.sv-te-preset:focus-within \.sv-te-delete-custom/);
  });

  test("sharing and dependency graph dialogs use safer button semantics", () => {
    expect(sharingJs).toMatch(/modal\.setAttribute\('role', 'dialog'\)/);
    expect(sharingJs).toMatch(/modal\.setAttribute\('aria-modal', 'true'\)/);
    expect(sharingJs).toMatch(/role="tablist" aria-label="Share options"/);
    expect(sharingJs).toMatch(/class="ss-modal-close" data-action="close" type="button" aria-label="Close share dialog"/);
    expect(sharingJs).toMatch(/data-action="import-decode" type="button"/);
    expect(depgraphJs).toMatch(/data-action="reset-zoom" title="Reset view" type="button"/);
    expect(depgraphJs).toMatch(/data-action="toggle-sidebar" title="Toggle sidebar" type="button" aria-label="Close details panel"/);
  });

  test("gist integration uses modern import and preview control semantics", () => {
    expect(gistJs).toMatch(/function closeModal\(\)/);
    expect(gistJs).toMatch(/input\.type = 'url';/);
    expect(gistJs).toMatch(/input\.name = 'gistImportUrl';/);
    expect(gistJs).toMatch(/input\.autocomplete = 'off';/);
    expect(gistJs).toMatch(/input\.spellcheck = false;/);
    expect(gistJs).toMatch(/btn\.type = 'button';/);
    expect(gistJs).toMatch(/btn\.addEventListener\('click', async \(\) => \{/);
    expect(gistJs).toMatch(/btn\.innerHTML = '<span class="gi-spinner"><\/span>Fetching…';/);
    expect(gistJs).toMatch(/modal\.setAttribute\('role', 'dialog'\);/);
    expect(gistJs).toMatch(/modal\.setAttribute\('aria-modal', 'true'\);/);
    expect(gistJs).toMatch(/closeBtn\.type = 'button';/);
    expect(gistJs).toMatch(/closeBtn\.setAttribute\('aria-label', 'Close import preview'\);/);
    expect(gistJs).toMatch(/searchInput\.type = 'search';/);
    expect(gistJs).toMatch(/searchInput\.name = 'gistSearch';/);
    expect(gistJs).toMatch(/searchInput\.placeholder = 'Search Gists…';/);
    expect(gistJs).toMatch(/searchInput\.addEventListener\('input', \(\) => \{/);
  });
});
