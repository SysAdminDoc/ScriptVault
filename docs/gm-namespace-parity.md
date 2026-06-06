# GM Namespace Parity

Status: active compatibility contract for callback `GM_*` APIs and
Greasemonkey-style `GM.*` promise aliases.

ScriptVault exposes the shipped callback APIs on `window.GM_*` and the promise
namespace on `window.GM`. The namespace now includes direct aliases for
previously callback-only wrapper helpers where the behavior is already backed by
existing runtime policy:

- `GM.addElement`
- `GM.audio`
- `GM.cookie` and `GM.cookies`
- `GM.focusTab`
- `GM.getMenuCommands`
- `GM.head`
- `GM.log`
- `GM.webRequest`

`GM.webRequest` remains declarativeNetRequest-backed in Manifest V3. It accepts
the same rule input as `GM_webRequest`, but runtime match callbacks are still
not supported by Chrome MV3 DNR.

`GM.fetch` remains deferred. A fetch-shaped API must reuse the existing
`GM_xmlhttpRequest` host-scope checks, `@connect` enforcement, abort behavior,
redirect handling, and internal-host guard before it can ship without widening
network access.
