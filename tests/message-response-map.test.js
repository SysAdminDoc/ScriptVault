// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/types/messages.ts"), "utf8");

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

describe("message response map coverage", () => {
  it("maps every BackgroundMessage action literal to a response type", () => {
    const actions = extractActionLiterals();
    const responseKeys = new Set(extractResponseMapKeys());

    expect(actions.filter((action) => !responseKeys.has(action))).toEqual([]);
  });
});
