import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const pagesDir = join(projectRoot, 'pages');

function readProjectFile(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

function collectDashboardFiles() {
  return new Set(
    readdirSync(pagesDir)
      .filter(name => /^dashboard-.*\.js$/.test(name))
      .sort()
  );
}

function extractTriageEntries(dashboardSource) {
  const match = dashboardSource.match(/const\s+DASHBOARD_MODULE_TRIAGE\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\s*\}\);/);
  if (!match) return new Set();
  const entries = new Set();
  for (const entry of match[1].matchAll(/'([^']+\.js)'\s*:/g)) {
    entries.add(entry[1]);
  }
  return entries;
}

function extractDashboardScriptReferences(source) {
  return new Set(
    [...source.matchAll(/['"]([^'"]*dashboard-[^'"]+\.js)['"]/g)]
      .map(match => basename(match[1]))
      .filter(Boolean)
  );
}

function extractDashboardHtmlScripts(htmlSource) {
  return new Set(
    [...htmlSource.matchAll(/<script[^>]+src=["']([^"']*dashboard-[^"']+\.js)["']/g)]
      .map(match => basename(match[1]))
      .filter(Boolean)
  );
}

function assertToken(errors, source, token, path, reason) {
  if (!source.includes(token)) {
    errors.push(`${path} missing token "${token}" (${reason})`);
  }
}

const dashboardSource = readProjectFile('pages/dashboard.js');
const lazyLoaderSource = readProjectFile('pages/dashboard-lazy-loader.js');
const htmlSource = readProjectFile('pages/dashboard.html');
const packageJson = JSON.parse(readProjectFile('package.json'));

const dashboardFiles = collectDashboardFiles();
const triageEntries = extractTriageEntries(dashboardSource);
const lazyReferences = extractDashboardScriptReferences(lazyLoaderSource);
const htmlScripts = extractDashboardHtmlScripts(htmlSource);
const reachableReferences = new Set([...lazyReferences, ...htmlScripts]);
const errors = [];

for (const file of dashboardFiles) {
  if (!triageEntries.has(file)) errors.push(`Missing DASHBOARD_MODULE_TRIAGE entry for ${file}`);
}

for (const file of triageEntries) {
  if (!dashboardFiles.has(file)) errors.push(`DASHBOARD_MODULE_TRIAGE references missing file ${file}`);
}

for (const file of reachableReferences) {
  if (!dashboardFiles.has(file)) errors.push(`Dashboard reachability references missing file ${file}`);
  if (!triageEntries.has(file)) errors.push(`Reachable dashboard module ${file} lacks triage metadata`);
}

for (const file of dashboardFiles) {
  if (!reachableReferences.has(file)) {
    errors.push(`${file} is not referenced by dashboard.html or dashboard-lazy-loader.js`);
  }
}

const expectedScript = 'node scripts/check-dashboard-modules.mjs';
if (packageJson.scripts?.['dashboard:modules:check'] !== expectedScript) {
  errors.push('package.json must expose "dashboard:modules:check" for dashboard module reachability');
}
if (!packageJson.scripts?.check?.includes('dashboard:modules:check')) {
  errors.push('package.json "check" must run dashboard:modules:check');
}

const wiringChecks = [
  ['dashboard-a11y.js', dashboardSource, 'A11y.init', 'pages/dashboard.js'],
  ['dashboard-cardview.js', dashboardSource, 'CardView.init', 'pages/dashboard.js'],
  ['dashboard-chains.js', dashboardSource, 'ScriptChains.init', 'pages/dashboard.js'],
  ['dashboard-collections.js', dashboardSource, 'CollectionManager.init', 'pages/dashboard.js'],
  ['dashboard-csp.js', dashboardSource, 'CSPReporter.init', 'pages/dashboard.js'],
  ['dashboard-debugger.js', dashboardSource, 'ScriptDebugger.init', 'pages/dashboard.js'],
  ['dashboard-debugger.js', htmlSource, 'tbtnDebug', 'pages/dashboard.html'],
  ['dashboard-depgraph.js', dashboardSource, 'DependencyGraph.init', 'pages/dashboard.js'],
  ['dashboard-diff.js', dashboardSource, 'DiffTool.init', 'pages/dashboard.js'],
  ['dashboard-diff.js', htmlSource, 'tbtnDiff', 'pages/dashboard.html'],
  ['dashboard-firefox-compat.js', dashboardSource, 'FirefoxCompat.polyfill', 'pages/dashboard.js'],
  ['dashboard-gamification.js', dashboardSource, 'Gamification.init', 'pages/dashboard.js'],
  ['dashboard-gist.js', dashboardSource, 'GistIntegration.init', 'pages/dashboard.js'],
  ['dashboard-heatmap.js', dashboardSource, 'ActivityHeatmap.init', 'pages/dashboard.js'],
  ['dashboard-keyboard.js', dashboardSource, 'KeyboardNav.init', 'pages/dashboard.js'],
  ['dashboard-lazy-loader.js', dashboardSource, 'LazyLoader.loadForTab', 'pages/dashboard.js'],
  ['dashboard-linter.js', dashboardSource, 'AdvancedLinter.init', 'pages/dashboard.js'],
  ['dashboard-linter.js', htmlSource, 'tbtnLint', 'pages/dashboard.html'],
  ['dashboard-pattern-builder.js', dashboardSource, 'PatternBuilder.init', 'pages/dashboard.js'],
  ['dashboard-pattern-builder.js', htmlSource, 'tbtnPattern', 'pages/dashboard.html'],
  ['dashboard-profiles.js', dashboardSource, 'ProfileManager.init', 'pages/dashboard.js'],
  ['dashboard-recommendations.js', dashboardSource, 'Recommendations.init', 'pages/dashboard.js'],
  ['dashboard-scheduler.js', dashboardSource, 'ScriptScheduler.init', 'pages/dashboard.js'],
  ['dashboard-sharing.js', dashboardSource, 'ScriptSharing.init', 'pages/dashboard.js'],
  ['dashboard-sharing.js', htmlSource, 'tbtnShare', 'pages/dashboard.html'],
  ['dashboard-snippets.js', dashboardSource, 'SnippetLibrary.init', 'pages/dashboard.js'],
  ['dashboard-snippets.js', htmlSource, 'tbtnSnippet', 'pages/dashboard.html'],
  ['dashboard-standalone.js', dashboardSource, 'StandaloneExport.init', 'pages/dashboard.js'],
  ['dashboard-standalone.js', htmlSource, 'btnStandaloneHtml', 'pages/dashboard.html'],
  ['dashboard-store.js', dashboardSource, 'ScriptStore.init', 'pages/dashboard.js'],
  ['dashboard-templates.js', dashboardSource, 'TemplateManager.init', 'pages/dashboard.js'],
  ['dashboard-templates.js', htmlSource, 'tbtnTemplate', 'pages/dashboard.html'],
  ['dashboard-theme-editor.js', dashboardSource, 'ThemeEditor.init', 'pages/dashboard.js'],
  ['dashboard-theme-editor.js', htmlSource, 'themeEditorContainer', 'pages/dashboard.html'],
  ['dashboard-viewsettings.js', htmlSource, 'dashboard-viewsettings.js', 'pages/dashboard.html'],
  ['dashboard-virtual-rows.js', dashboardSource, 'DashboardVirtualRows', 'pages/dashboard.js'],
  ['dashboard-whatsnew.js', dashboardSource, 'WhatsNew.shouldShow', 'pages/dashboard.js'],
];

for (const [file, source, token, path] of wiringChecks) {
  assertToken(errors, source, token, path, `${file} reachability`);
}

for (const [file, token] of [
  ['dashboard-linter.js', 'dashboard-linter.js'],
  ['dashboard-pattern-builder.js', 'dashboard-pattern-builder.js'],
  ['dashboard-debugger.js', 'dashboard-debugger.js'],
  ['dashboard-diff.js', 'dashboard-diff.js'],
  ['dashboard-snippets.js', 'dashboard-snippets.js'],
  ['dashboard-templates.js', 'dashboard-templates.js'],
  ['dashboard-sharing.js', 'dashboard-sharing.js'],
]) {
  assertToken(errors, lazyLoaderSource, token, 'pages/dashboard-lazy-loader.js', `${file} editor loader`);
}

if (errors.length > 0) {
  console.error('Dashboard module reachability check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Dashboard module reachability check passed (${dashboardFiles.size} modules).`);
}
