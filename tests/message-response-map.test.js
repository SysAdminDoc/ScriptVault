// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
});
