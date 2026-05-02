# Extension Interop — Cross-Extension Messaging Compatibility Matrix

**Status:** v3.9.0 — JSON serialization (Chrome default).
**Owner:** Phase 37.4. Gates Phase 36.1 (structured-clone opt-in).
**Last reviewed:** 2026 (Round 10 research).

---

## Why this document exists

Chrome 148 enforces matching serialization formats for `runtime.sendMessage` and
`runtime.connect` across extensions: a JSON-mode extension cannot directly
exchange payloads with a structured-clone-mode extension. The two formats are
not transparently bridged. Once ScriptVault opts into `"message_serialization":
"structured_clone"` (Phase 36.1), every extension that talks to it must either
also opt in or proxy through a JSON-only bridge.

This file is the living inventory we audit before flipping the switch.

Source: [Structured Clone Messaging — Extension-to-extension communication](https://developer.chrome.com/blog/structured-clone-messaging).

---

## Current state — v3.9.0 (JSON serialization)

ScriptVault is a **closed-loop extension** today. It does not declare
`externally_connectable` and does not register `chrome.runtime.onMessageExternal`
listeners. Audited as of v3.9.0:

```text
$ rg 'externally_connectable|onMessageExternal' .
(no matches)
```

Internal messaging surfaces (all in-extension, all governed by ScriptVault's
own serialization choice):

| Surface | Direction | Carrier | Payload shape |
|---|---|---|---|
| Background ↔ content scripts | Both | `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` | Plain objects, strings, numbers, arrays. No `Map`/`Set`/`Date`/`Blob`/`ArrayBuffer`/`File`. |
| Background ↔ dashboard / popup / sidepanel | Both | `chrome.runtime.sendMessage` | Same as above. JSON-safe. |
| Background ↔ MAIN-world wrapper | Both | `window.postMessage` (not `runtime.*`) | Already structured-clone — `postMessage` always was. Out of scope for this matrix. |
| `GM_xmlhttpRequest` response | Bg → content | `chrome.tabs.sendMessage` | Body is a string today. Phase 36.1 unlocks `Blob`/`ArrayBuffer` direct-pass. |

**Conclusion:** today the matrix has zero external rows. ScriptVault is its own
universe and the format choice has zero interop blast radius.

---

## Proposed external surfaces (Phase 12.14 vscode.dev companion)

Phase 12.14 adds a vscode.dev companion extension that talks to ScriptVault.
This is the first time the matrix gets a real row.

| External extension | Their format | Our format | Status | Strategy |
|---|---|---|---|---|
| vscode.dev companion (planned) | TBD — will ship under our control | structured-clone (target) | 🟡 Plan | Both extensions opt into structured-clone in lockstep at Phase 36.1 launch. |
| _(any future user-facing integration)_ | unknown | structured-clone | 🔴 Block | Document a JSON-bridge sub-extension in this file before exposing `externally_connectable`. |

**Cell legend:**
- 🟢 Compatible — both sides on same format, no bridge needed.
- 🟡 Planned compatible — landing under our control; gate the merge on both PRs being green.
- 🔴 Blocked — incompatible; needs a JSON-only bridge or a format flip on one side.
- ⚪ Proxied — going through a JSON bridge sub-extension.

---

## Cutover policy

1. **Stay on JSON until vscode.dev companion ships.** No reason to take the
   risk before we have a structured-clone consumer.
2. **Both extensions flip together.** ScriptVault's Phase 36.1 PR must merge
   simultaneously with the vscode.dev companion's matching opt-in PR — no
   intermediate state where ScriptVault is structured-clone and the companion
   is still JSON.
3. **Audit every payload before flip.** Phase 36.1's checklist enumerates every
   `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` call site and
   confirms no payload still depends on JSON's coercion of `undefined` →
   absent-key, `Date` → ISO string, or `NaN`/`Infinity` → `null`. Structured
   clone preserves all three; behavior changes silently if the consumer reads
   the old shape.
4. **Never expose `externally_connectable` without updating this matrix.** Add
   the new row, set the format cell, run the audit, then ship.

---

## Audit checklist (run before each Phase 36.x PR that touches messaging)

- [ ] `rg 'externally_connectable|onMessageExternal' .` — confirm zero matches OR every match is in this matrix.
- [ ] Search for `Map(`, `Set(`, `new Date(`, `Blob`, `ArrayBuffer`, `File` adjacent to `sendMessage(` calls — these are the payload shapes whose semantics differ between JSON and structured-clone.
- [ ] Confirm `manifest.json` `"message_serialization"` matches what this doc claims under "Current state".
- [ ] If a new external integration was added, append a row to the proposed-external-surfaces table above with format/status/strategy filled in.

---

## References

- [Structured Clone Messaging — Chrome for Developers blog](https://developer.chrome.com/blog/structured-clone-messaging)
- [Chrome 148 release notes](https://chromestatus.com/features) — search for "structured clone messaging".
- [`chrome.runtime` API reference — `sendMessage`](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage)
- ScriptVault [`ROADMAP.md`](../ROADMAP.md) Phase 36.1 (structured-clone opt-in) and Phase 37.4 (this matrix).
