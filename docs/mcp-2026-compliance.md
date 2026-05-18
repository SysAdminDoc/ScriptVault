# MCP 2026 Compliance Bar — `CAT.mcp.*` Client Design (If Phase 38.10 Ships)

**Phase:** 39.40 (gates 38.10 implementation).
**Status:** Design — speculative, not yet committed to ship.
**Owner:** TBD (Phase 38.10 is Under Consideration per Round 11/12).
**Last reviewed:** 2026-05-17.

---

## Context

ScriptCat v1.4 shipped a `CAT.agent.*` API that bundles an LLM-backed agent runtime plus an MCP (Model Context Protocol) client. Phase 38.10 captured the analysis: the agent surface contradicts ScriptVault's local-first / zero-telemetry positioning, but the **MCP client subset** (tools running on `localhost:<port>`, no cloud LLM dependency) is salvageable.

The decision deferred Phase 38.10 implementation pending clear user-request signal. If ScriptVault eventually ships an MCP client, **this document is the compliance bar** — the 2024-era MCP spec is no longer sufficient.

## What changed in MCP 2026

The [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) and the [auth update (June 2025)](https://auth0.com/blog/mcp-specs-update-all-about-auth/) introduced three load-bearing requirements:

### 1. `.well-known/mcp-discovery` capability discovery

Servers MUST publish a static `.well-known/mcp-discovery` document describing their capabilities (tools, resources, prompts) without requiring a live JSON-RPC connection.

- Format: JSON object with `serverInfo`, `capabilities`, and `discovery` keys.
- Cacheable: clients can preview a server's tool surface offline; reduces friction for "should I trust this server?" decisions.
- ScriptVault behavior: **fetch `.well-known/mcp-discovery` first**; refuse to connect to a server that doesn't publish one. This is non-negotiable for ScriptVault's local-first positioning — users should see the tool surface before connecting.

### 2. OAuth 2.1 + RFC 8707 Resource Indicators

Every authenticated MCP server connection MUST use OAuth 2.1 with [RFC 8707 Resource Indicators](https://www.rfc-editor.org/rfc/rfc8707). This has been mandatory since June 2025.

- Resource Indicators bind an access token to the specific MCP server URI (the "audience"). A token issued for `mcp://example.com/server-A` cannot be replayed against `mcp://example.com/server-B`.
- The `resource` parameter is included in the OAuth `/authorize` and `/token` requests; the issued token's `aud` claim must contain the resource URI.
- ScriptVault behavior: every OAuth request through the MCP client MUST include `resource=<server-uri>`. Tokens missing a matching `aud` claim are rejected before use.

### 3. Tasks primitive

Long-running tool calls now use a Tasks primitive with explicit retry/expiry semantics rather than long-held JSON-RPC connections.

- Task lifecycle: `initiated` → `running` → `succeeded` / `failed` / `expired`.
- Clients poll task status; servers can `Cancel` mid-flight.
- ScriptVault behavior: surface task status in the dashboard with cancel and retry affordances.

## Design

### Permission model

- `@grant CAT.mcp.*` is required for any script that wants to talk to an MCP server.
- The grant is **per-server**, not blanket: `@grant CAT.mcp.connect: ws://localhost:8765`.
- The install dialog (Phase 5 install flow) shows the explicit server URI in the permissions list.
- Users can revoke a per-server grant from the script settings panel.

### Locality enforcement

ScriptVault's positioning is **local-first**. The MCP client refuses connections that don't satisfy one of:

1. The server URI hostname resolves to a loopback address (`127.0.0.0/8`, `::1`, `localhost`).
2. The server URI hostname resolves to an RFC 1918 / RFC 4193 (private) address.
3. The user has explicitly added the server's origin to a non-default allowlist (Settings → MCP → Trusted Servers → "Add public server", with a clear warning about telemetry exposure).

Public-internet MCP servers are not blocked — they require deliberate opt-in. This mirrors the existing `_isInternalHost` classifier (Phase 5.5 / 39.1 webhook SSRF guard) but **inverted**: where the webhook code rejects internal hosts to prevent SSRF, the MCP client rejects external hosts by default to prevent telemetry exfiltration.

### Connection flow

1. **Discovery:** fetch `<server-url>/.well-known/mcp-discovery`. Cache for 1 hour.
2. **User consent:** if first connect, show a modal listing the server's declared capabilities. User confirms or rejects.
3. **OAuth (if required):** kick off OAuth 2.1 flow with `resource=<server-uri>` parameter. PKCE-secured. State validated.
4. **Open JSON-RPC channel:** `chrome.runtime.connect`-style long-lived port. Spec-compliant message framing.
5. **Tools available to the script:** the MCP client exposes `CAT.mcp.callTool(serverId, toolName, params)` returning a Promise that resolves with a Task handle. The script awaits the Task to completion.

### Audit log

Every MCP call is logged to the dashboard's audit log (Phase 17.2):
- Timestamp
- Script ID
- Server URI
- Tool name
- Parameter shape (not values — privacy)
- Outcome (success / failure / cancelled / expired)

### What is explicitly NOT in scope

- **Bundled LLM agent UI.** No conversation surface, no model-selection UI, no API-key entry. Scripts that want to drive an LLM can do so via `GM_xmlhttpRequest` to a local Ollama / llama.cpp endpoint — that's already supported and doesn't need MCP.
- **Sub-agent generation.** ScriptCat's auto-generated sub-agent flow is a moderation problem disguised as a feature; rejected in Round 12.
- **Skill marketplace.** Same rejection reason.
- **Cloud-hosted MCP defaults.** A user can opt-in to a public server, but ScriptVault ships zero default external servers.

## Testing requirements

Before any release containing the MCP client:

- 20+ unit tests covering: discovery fetch, capability parsing, OAuth flow with valid `resource`, OAuth rejection when `aud` mismatches, Task polling, Task cancel, Task expiry, locality classifier (allow loopback / reject public default / allow allowlisted public), audit-log emission.
- E2E test with a local MCP test server (Node-based reference impl, used only in tests). Round-trip: discover → consent → connect → call tool → receive result → disconnect.
- Threat-model walkthrough recorded in `docs/threat-model-mcp.md`.
- Security review by a non-author maintainer.

## Open questions

1. **OAuth refresh-token storage:** where? `chrome.storage.local` is already where sync tokens live (Phase 39.1 deprecates this). Tokens per-MCP-server are likely fine in `chrome.storage.local` for v1, since they're already short-lived under the 2026 spec.
2. **Tool-call performance:** JSON-RPC overhead for every tool invocation. Acceptable for the use cases that justify shipping an MCP client at all (debugging, IDE-style scripts) but a non-starter for hot loops.
3. **Discovery cache invalidation:** 1 hour is conservative. Servers can include `Cache-Control` in the discovery response; honor it up to 24 hours.
4. **Migration if 2027 MCP spec drops the well-known endpoint:** unlikely (spec authors are aligned on it as a foundational primitive) but a fallback "live capabilities query at handshake" path is trivial to add later.

## Decision gate

**Ship Phase 38.10 + 39.40 if:**

- 50+ GitHub issues request MCP support (currently zero; track via search).
- A maintained, popular MCP local-tool server emerges that ScriptVault users would benefit from.
- The 2026 spec stabilizes (`.well-known` discovery makes it into the v1 final RFC).

**Do NOT ship if:**

- The above signals are absent through 2026 Q4.
- The MCP ecosystem trends toward cloud-LLM-only servers (defeats local-first rationale).
- A simpler local-RPC pattern emerges (e.g., a standardized "Local Tools" Chrome API) that achieves the same outcome without an MCP client.

## Source citations

- [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [Auth0 MCP auth spec update (June 2025)](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [RFC 8707 — OAuth 2.0 Resource Indicators](https://www.rfc-editor.org/rfc/rfc8707)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
- ROADMAP.md Phase 38.10 (Under Consideration analysis)
- ROADMAP.md Round 12 sources 267–268
