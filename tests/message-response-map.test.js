// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BACKGROUND_MESSAGE_ACTIONS,
  getBackgroundActionOrigin,
  isKnownBackgroundAction,
  resolveBackgroundAction,
} from "../src/background/message-router.ts";

const source = readFileSync(resolve(process.cwd(), "src/types/messages.ts"), "utf8");
const coreSource = readFileSync(resolve(process.cwd(), "src/background/core.ts"), "utf8");

function extractActionLiterals() {
  const actions = new Set();
  for (const match of source.matchAll(/\baction:\s*([^;]+);/g)) {
    for (const literal of match[1].matchAll(/'([^']+)'/g)) {
      actions.add(literal[1]);
    }
  }
  return [...actions].sort();
}

function extractResponseMapKeys() {
  const match = source.match(/export interface ResponseMap \{([\s\S]*?)\n\}/);
  if (!match) throw new Error("ResponseMap not found");
  return [...match[1].matchAll(/^\s*([A-Za-z0-9_]+):/gm)]
    .map((entry) => entry[1])
    .sort();
}

function extractHandleMessageActions() {
  const start = coreSource.indexOf("async function handleMessage");
  if (start === -1) throw new Error("handleMessage not found");

  const switchStart = coreSource.indexOf("switch (action)", start);
  if (switchStart === -1) throw new Error("handleMessage switch not found");

  let bodyStart = -1;
  let bodyEnd = -1;
  let depth = 0;
  for (let index = switchStart; index < coreSource.length; index += 1) {
    const char = coreSource[index];
    if (char === "{") {
      depth += 1;
      if (bodyStart === -1) bodyStart = index + 1;
    } else if (char === "}") {
      depth -= 1;
      if (bodyStart !== -1 && depth === 0) {
        bodyEnd = index;
        break;
      }
    }
  }

  if (bodyStart === -1 || bodyEnd === -1) throw new Error("handleMessage switch body not found");

  return [...new Set([...coreSource.slice(bodyStart, bodyEnd).matchAll(/case\s+'([^']+)'\s*:/g)]
    .map((match) => match[1]))]
    .sort();
}

describe("message response map coverage", () => {
  it("maps every BackgroundMessage action literal to a response type", () => {
    const actions = extractActionLiterals();
    const responseKeys = new Set(extractResponseMapKeys());

    expect(actions.filter((action) => !responseKeys.has(action))).toEqual([]);
  });

  it("declares every handleMessage action literal in BackgroundMessage", () => {
    expect(extractActionLiterals()).toEqual(extractHandleMessageActions());
  });

  it("keeps the generated router action table exhaustive", () => {
    expect([...BACKGROUND_MESSAGE_ACTIONS]).toEqual(extractActionLiterals());
    expect([...BACKGROUND_MESSAGE_ACTIONS]).toEqual(extractHandleMessageActions());
  });

  it("resolves known and unknown background actions", () => {
    expect(isKnownBackgroundAction("saveScript")).toBe(true);
    expect(isKnownBackgroundAction("GM_xmlhttpRequest")).toBe(true);
    expect(isKnownBackgroundAction("deleteEverything")).toBe(false);

    expect(getBackgroundActionOrigin("GM_xmlhttpRequest")).toBe("gm-api");
    expect(getBackgroundActionOrigin("publicApi_getAuditLog")).toBe("external-api");
    expect(getBackgroundActionOrigin("reportExecError")).toBe("telemetry");
    expect(getBackgroundActionOrigin("saveScript")).toBe("extension-ui");

    expect(resolveBackgroundAction("saveScript")).toEqual({
      known: true,
      action: "saveScript",
      origin: "extension-ui",
    });
    expect(resolveBackgroundAction("deleteEverything")).toEqual({
      known: false,
      action: "deleteEverything",
    });
  });
});
