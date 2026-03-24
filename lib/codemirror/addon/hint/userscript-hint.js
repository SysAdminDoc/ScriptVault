// ScriptVault - Userscript API Autocomplete Hints for CodeMirror
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) define(["../../lib/codemirror"], mod);
  else mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  // GM_* API completions with signatures
  var gmApis = [
    { text: "GM_getValue", displayText: "GM_getValue(key, defaultValue)", className: "CodeMirror-hint" },
    { text: "GM_setValue", displayText: "GM_setValue(key, value)", className: "CodeMirror-hint" },
    { text: "GM_deleteValue", displayText: "GM_deleteValue(key)", className: "CodeMirror-hint" },
    { text: "GM_listValues", displayText: "GM_listValues()", className: "CodeMirror-hint" },
    { text: "GM_addValueChangeListener", displayText: "GM_addValueChangeListener(key, callback)", className: "CodeMirror-hint" },
    { text: "GM_removeValueChangeListener", displayText: "GM_removeValueChangeListener(listenerId)", className: "CodeMirror-hint" },
    { text: "GM_getResourceText", displayText: "GM_getResourceText(name)", className: "CodeMirror-hint" },
    { text: "GM_getResourceURL", displayText: "GM_getResourceURL(name)", className: "CodeMirror-hint" },
    { text: "GM_addStyle", displayText: "GM_addStyle(css)", className: "CodeMirror-hint" },
    { text: "GM_openInTab", displayText: "GM_openInTab(url, options)", className: "CodeMirror-hint" },
    { text: "GM_registerMenuCommand", displayText: "GM_registerMenuCommand(caption, onClick, options)", className: "CodeMirror-hint" },
    { text: "GM_unregisterMenuCommand", displayText: "GM_unregisterMenuCommand(caption)", className: "CodeMirror-hint" },
    { text: "GM_getMenuCommands", displayText: "GM_getMenuCommands()", className: "CodeMirror-hint" },
    { text: "GM_notification({\n    text: '',\n    title: 'Notification',\n    timeout: 5000,\n    onclick: function() {},\n    ondone: function() {}\n})", displayText: "GM_notification(details) [snippet]", className: "CodeMirror-hint" },
    { text: "GM_notification", displayText: "GM_notification(details, ondone)", className: "CodeMirror-hint" },
    { text: "GM_setClipboard", displayText: "GM_setClipboard(data, type)", className: "CodeMirror-hint" },
    { text: "GM_xmlhttpRequest({\n    method: 'GET',\n    url: '',\n    onload: function(response) {\n        console.log(response.responseText);\n    },\n    onerror: function(err) {\n        console.error(err);\n    }\n})", displayText: "GM_xmlhttpRequest(details) [snippet]", className: "CodeMirror-hint" },
    { text: "GM_xmlhttpRequest", displayText: "GM_xmlhttpRequest(details)", className: "CodeMirror-hint" },
    { text: "GM_download({\n    url: '',\n    name: 'file.txt',\n    onload: function() { console.log('Downloaded'); },\n    onerror: function(err) { console.error(err); }\n})", displayText: "GM_download(details) [snippet]", className: "CodeMirror-hint" },
    { text: "GM_download", displayText: "GM_download(details)", className: "CodeMirror-hint" },
    { text: "GM_log", displayText: "GM_log(...args)", className: "CodeMirror-hint" },
    { text: "GM_info", displayText: "GM_info", className: "CodeMirror-hint" },
    { text: "GM_getTab", displayText: "GM_getTab(callback)", className: "CodeMirror-hint" },
    { text: "GM_saveTab", displayText: "GM_saveTab(tabObj)", className: "CodeMirror-hint" },
    { text: "GM_getTabs", displayText: "GM_getTabs(callback)", className: "CodeMirror-hint" },
    { text: "GM_cookie", displayText: "GM_cookie", className: "CodeMirror-hint" },
    { text: "GM_focusTab", displayText: "GM_focusTab(tabId)", className: "CodeMirror-hint" },
    { text: "GM_closeTab", displayText: "GM_closeTab(tabId)", className: "CodeMirror-hint" },
    { text: "GM_getValues", displayText: "GM_getValues(keysOrDefaults)", className: "CodeMirror-hint" },
    { text: "GM_setValues", displayText: "GM_setValues(values)", className: "CodeMirror-hint" },
    { text: "GM_deleteValues", displayText: "GM_deleteValues(keys)", className: "CodeMirror-hint" },
    { text: "GM_addElement", displayText: "GM_addElement(tagName, attributes)", className: "CodeMirror-hint" },
    { text: "GM_loadScript", displayText: "GM_loadScript(url, options)", className: "CodeMirror-hint" },
    { text: "GM_audio", displayText: "GM_audio", className: "CodeMirror-hint" },
    // Promise-based GM.* API
    { text: "GM.getValue", displayText: "GM.getValue(key, defaultValue)", className: "CodeMirror-hint" },
    { text: "GM.setValue", displayText: "GM.setValue(key, value)", className: "CodeMirror-hint" },
    { text: "GM.deleteValue", displayText: "GM.deleteValue(key)", className: "CodeMirror-hint" },
    { text: "GM.listValues", displayText: "GM.listValues()", className: "CodeMirror-hint" },
    { text: "GM.getResourceText", displayText: "GM.getResourceText(name)", className: "CodeMirror-hint" },
    { text: "GM.getResourceUrl", displayText: "GM.getResourceUrl(name)", className: "CodeMirror-hint" },
    { text: "GM.addStyle", displayText: "GM.addStyle(css)", className: "CodeMirror-hint" },
    { text: "GM.openInTab", displayText: "GM.openInTab(url, options)", className: "CodeMirror-hint" },
    { text: "GM.registerMenuCommand", displayText: "GM.registerMenuCommand(caption, onClick, options)", className: "CodeMirror-hint" },
    { text: "GM.unregisterMenuCommand", displayText: "GM.unregisterMenuCommand(caption)", className: "CodeMirror-hint" },
    { text: "GM.notification", displayText: "GM.notification(details)", className: "CodeMirror-hint" },
    { text: "GM.setClipboard", displayText: "GM.setClipboard(data, type)", className: "CodeMirror-hint" },
    { text: "GM.xmlHttpRequest", displayText: "GM.xmlHttpRequest(details)", className: "CodeMirror-hint" },
    { text: "GM.download", displayText: "GM.download(details)", className: "CodeMirror-hint" },
    { text: "GM.info", displayText: "GM.info", className: "CodeMirror-hint" },
    { text: "GM.getTab", displayText: "GM.getTab()", className: "CodeMirror-hint" },
    { text: "GM.saveTab", displayText: "GM.saveTab(tabObj)", className: "CodeMirror-hint" },
    { text: "GM.getTabs", displayText: "GM.getTabs()", className: "CodeMirror-hint" },
    { text: "GM.cookies", displayText: "GM.cookies", className: "CodeMirror-hint" },
    { text: "GM.addElement", displayText: "GM.addElement(parentNode, tagName, attributes)", className: "CodeMirror-hint" }
  ];

  // Userscript metadata directives
  var metaDirectives = [
    "@name", "@namespace", "@description", "@version", "@author",
    "@match", "@include", "@exclude", "@exclude-match", "@icon", "@grant",
    "@run-at", "@noframes", "@require", "@resource", "@connect",
    "@inject-into", "@sandbox", "@antifeature", "@tag",
    "@run-in", "@top-level-await", "@license", "@copyright", "@priority",
    "@downloadURL", "@updateURL", "@homepageURL", "@supportURL",
    "@contributionURL", "@webRequest",
    "@license", "@compatible", "@incompatible", "@sandbox",
    "@inject-into", "@unwrap", "@antifeature"
  ];

  // @grant values
  var grantValues = [
    "none", "unsafeWindow",
    "window.close", "window.focus", "window.onurlchange",
    "GM_getValue", "GM_setValue", "GM_deleteValue", "GM_listValues",
    "GM_getValues", "GM_setValues", "GM_deleteValues",
    "GM_addValueChangeListener", "GM_removeValueChangeListener",
    "GM_getResourceText", "GM_getResourceURL",
    "GM_addStyle", "GM_addElement", "GM_openInTab",
    "GM_registerMenuCommand", "GM_unregisterMenuCommand", "GM_getMenuCommands",
    "GM_notification", "GM_setClipboard",
    "GM_xmlhttpRequest", "GM_download", "GM_log", "GM_info",
    "GM_getTab", "GM_saveTab", "GM_getTabs",
    "GM_cookie", "GM_focusTab", "GM_closeTab",
    "GM_audio", "GM_loadScript",
    "GM.getValue", "GM.setValue", "GM.deleteValue", "GM.listValues",
    "GM.getValues", "GM.setValues", "GM.deleteValues",
    "GM.xmlHttpRequest", "GM.notification", "GM.openInTab",
    "GM.setClipboard", "GM.addStyle", "GM.addElement", "GM.info",
    "GM.getResourceText", "GM.getResourceUrl",
    "GM.registerMenuCommand", "GM.unregisterMenuCommand",
    "GM.download", "GM.getTab", "GM.saveTab", "GM.getTabs", "GM.cookies"
  ];

  // @run-at values
  var runAtValues = [
    "document-start", "document-body", "document-end",
    "document-idle", "context-menu"
  ];

  // @sandbox values
  var sandboxValues = ["raw", "JavaScript", "DOM"];

  // @inject-into values
  var injectIntoValues = ["auto", "page", "content"];

  CodeMirror.registerHelper("hint", "userscript", function(cm) {
    var cur = cm.getCursor();
    var token = cm.getTokenAt(cur);
    var line = cm.getLine(cur.line);
    var start = token.start;
    var end = cur.ch;
    var word = token.string.slice(0, end - start);

    // Check if we're in a metadata block comment
    var inMeta = false;
    for (var i = cur.line; i >= 0; i--) {
      var l = cm.getLine(i).trim();
      if (l === "// ==UserScript==") { inMeta = true; break; }
      if (l === "// ==/UserScript==") break;
      if (i < cur.line && !l.startsWith("//")) break;
    }

    if (inMeta) {
      var trimmed = line.trimStart();
      // After @grant, suggest grant values
      var grantMatch = trimmed.match(/^\/\/\s*@grant\s+(\S*)$/);
      if (grantMatch) {
        var prefix = grantMatch[1];
        var found = grantValues.filter(function(v) { return v.indexOf(prefix) === 0; });
        if (found.length) {
          var grantStart = line.lastIndexOf(prefix);
          return { list: found, from: CodeMirror.Pos(cur.line, grantStart), to: cur };
        }
      }
      // After @run-at, suggest run-at values
      var runAtMatch = trimmed.match(/^\/\/\s*@run-at\s+(\S*)$/);
      if (runAtMatch) {
        var prefix = runAtMatch[1];
        var found = runAtValues.filter(function(v) { return v.indexOf(prefix) === 0; });
        if (found.length) {
          var raStart = line.lastIndexOf(prefix);
          return { list: found, from: CodeMirror.Pos(cur.line, raStart), to: cur };
        }
      }
      // After @sandbox, suggest sandbox values
      var sandboxMatch = trimmed.match(/^\/\/\s*@sandbox\s+(\S*)$/);
      if (sandboxMatch) {
        var prefix = sandboxMatch[1];
        var found = sandboxValues.filter(function(v) { return v.indexOf(prefix) === 0; });
        if (found.length) {
          var sbStart = line.lastIndexOf(prefix);
          return { list: found, from: CodeMirror.Pos(cur.line, sbStart), to: cur };
        }
      }
      // After @inject-into, suggest inject-into values
      var injectMatch = trimmed.match(/^\/\/\s*@inject-into\s+(\S*)$/);
      if (injectMatch) {
        var prefix = injectMatch[1];
        var found = injectIntoValues.filter(function(v) { return v.indexOf(prefix) === 0; });
        if (found.length) {
          var ijStart = line.lastIndexOf(prefix);
          return { list: found, from: CodeMirror.Pos(cur.line, ijStart), to: cur };
        }
      }
      // Suggest metadata directives
      var atMatch = trimmed.match(/^\/\/\s*(@\S*)$/);
      if (atMatch) {
        var prefix = atMatch[1];
        var found = metaDirectives.filter(function(d) { return d.indexOf(prefix) === 0; });
        if (found.length) {
          var atStart = line.lastIndexOf(prefix);
          return { list: found, from: CodeMirror.Pos(cur.line, atStart), to: cur };
        }
      }
      return null;
    }

    // In code: suggest GM_* / GM.* APIs
    // Expand token to include dots (for GM.xxx)
    var lineUpToCursor = line.slice(0, end);
    var match = lineUpToCursor.match(/(GM[_.][\w.]*)$/);
    if (match) {
      var prefix = match[1];
      var fromCh = end - prefix.length;
      var found = gmApis.filter(function(api) {
        return api.text.indexOf(prefix) === 0;
      });
      if (found.length) {
        return { list: found, from: CodeMirror.Pos(cur.line, fromCh), to: cur };
      }
    }

    // Also trigger on just "GM" typed
    var gmOnly = lineUpToCursor.match(/\bGM$/);
    if (gmOnly) {
      var fromCh = end - 2;
      return { list: gmApis, from: CodeMirror.Pos(cur.line, fromCh), to: cur };
    }

    return null;
  });
});
