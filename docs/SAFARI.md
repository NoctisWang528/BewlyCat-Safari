# Safari Web Extension — Build & Maintenance Guide

This document covers how to build, validate, package, and troubleshoot the
Safari Web Extension variant of BewlyCat.

## Prerequisites

- Node.js LTS
- pnpm 10.21.0 (repository-pinned)
- Xcode 27 Beta at `/Applications/Xcode-beta.app` with developer directory selected
- `safari-web-extension-packager` (included with Xcode)

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

This generates the `extension-safari/` directory containing the MV3 WebExtension
bundle with a non-persistent script-based background page.

`pnpm build` and `pnpm build-safari` are equivalent; both target Safari.

## Validate

```bash
pnpm validate-safari
```

Checks manifest structure, bundle existence, background script format, MAIN
world injection via `web_accessible_resources`, and more. This runs in CI on
every push and PR.

## Package as Xcode Project

```bash
pnpm package-safari
```

Uses `safari-web-extension-packager` with a fixed developer directory
(`/Applications/Xcode-beta.app/Contents/Developer`) to generate an Xcode
project at `extension-safari-macos/`.

`pnpm convert-safari` is a compatibility alias for `pnpm package-safari`.

The script:
1. Checks Xcode Beta and packager existence.
2. Builds and validates `extension-safari/`.
3. Cleans old ignored Xcode output.
4. Invokes the packager with fixed `DEVELOPER_DIR`.
5. Fails on non-zero exit or unsupported manifest key warnings.
6. Verifies the generated `.xcodeproj` exists.

## Run in Safari

1. Open the generated `.xcodeproj` in Xcode
2. Configure signing (Team, Bundle Identifier)
3. Build and Run the host app (Cmd+R)
4. In Safari → Settings → Extensions, enable BewlyCat
5. Grant website access for Bilibili domains

## Release Distribution

GitHub Releases distribute the macOS host app, not a Chrome, Edge, or Firefox
`extension.zip`. A Safari Web Extension must be embedded in its containing
macOS app and cannot be installed by dragging a WebExtension zip into Safari.

### Build the release app

1. Run `pnpm package-safari` to generate the Xcode project.
2. Open the generated project and configure the release Team, bundle
   identifiers, version, and signing settings.
3. Build or archive the Release configuration in Xcode and export the macOS
   host `.app`.
4. Test the exported app and its embedded Safari extension on the supported
   macOS and Safari versions.

`pnpm package-safari` regenerates `extension-safari-macos/`; do not run it after
making deliberate changes to that generated project unless those changes have
been preserved elsewhere.

### Create GitHub Release assets

Pass the version and the built host app path to the release script:

```bash
pnpm release:macos -- v1.6.7 "/path/to/BewlyCat Safari.app"
```

The app path can instead be supplied through `BEWLYCAT_APP_PATH`. If omitted,
the script uses the app only when exactly one `.app` exists under
`extension-safari-macos/`. Xcode normally stores build products in DerivedData,
so an explicit path is recommended.

The script:

1. Runs `pnpm build` and `pnpm validate-safari`.
2. validates the supplied app bundle path;
3. creates `release/BewlyCat-Safari-v1.6.7-macOS.zip` with
   `ditto -c -k --keepParent`;
4. creates `release/SHA256SUMS.txt`; and
5. reports basic code-signature verification status and prints the manual
   tag/Release steps.

Upload both the zip and `SHA256SUMS.txt` to the matching GitHub Release. The
script does not create tags, upload assets, sign code, or access Apple
credentials.

### Install from a GitHub Release

1. Download the macOS zip from this repository's
   [Releases](https://github.com/NoctisWang528/BewlyCat-Safari/releases).
2. Verify its SHA-256 digest against `SHA256SUMS.txt`, then extract it.
3. Move the `.app` to `/Applications` and open it.
4. In Safari → Settings → Extensions, enable BewlyCat.
5. Grant access to the requested Bilibili and `hdslb` domains.

If a release is unsigned or has not been notarized, macOS Gatekeeper may block
or warn when opening it. Formal public distribution should use Developer ID
Application signing and Apple notarization. The project does not promise or
provide an automatic Gatekeeper bypass.

### Signing and notarization

For a notarized release:

1. Configure Developer ID Application signing for the host app and extension
   targets, then create a Release archive in Xcode.
2. Export the signed app with Xcode's Developer ID distribution workflow.
3. Store notarytool credentials in the local login keychain (or another secure
   CI secret store), never in this repository.
4. Submit the signed archive with `xcrun notarytool submit ... --wait`.
5. After Apple accepts it, staple the ticket to the app with
   `xcrun stapler staple "/path/to/BewlyCat Safari.app"`.
6. Verify the signature, staple, and Gatekeeper assessment with `codesign`,
   `xcrun stapler validate`, and `spctl`.
7. Run `pnpm release:macos` against the stapled app so the published zip and
   checksum contain the final notarized artifact.

Apple account identifiers, app-specific passwords, API keys, certificates,
private keys, and notarytool keychain profiles are local release credentials
and must not be committed.

See [Release checklist and notes template](./RELEASE.md) for the maintainer
workflow and the suggested GitHub Release description.

## Architecture Notes

### Background Lifecycle

Safari uses a non-persistent background page. The extension uses `browser.alarms`
for periodic token refresh, falling back to `setInterval` if alarms API is
unavailable. On `runtime.onInstalled` and `runtime.onStartup`, the alarm is
recreated and an immediate token check runs.

Token refresh uses a shared promise pattern: concurrent callers that detect
an expiring token all await the same refresh promise, so only one network
request is made.

### MAIN World Injection

Safari does not support `world: "MAIN"` in content_scripts. Instead, the
MAIN-world script (`inject.global.js`) is registered in `web_accessible_resources`
and injected by the isolated content script via:

```js
const script = document.createElement('script')
script.src = browser.runtime.getURL('dist/contentScripts/inject.global.js')
```

The inject script uses a global state guard (`__bewlyPageWorldState`) on
`window` to ensure hooks (history interception, custom element proxy, fetch
interception, clipboard interception) are installed exactly once. If the script
executes a second time, it sends a `BEWLY_PAGE_WORLD_READY` message with
`reason: 'already-loaded'` without re-installing hooks.

The content script uses a PING/READY handshake protocol:

1. Content script registers a READY listener (checking `source: 'bewlycat'`).
2. Content script sends a PING message.
3. If the page-world script is already loaded and in `ready` status, it
   responds with a READY message (`reason: 'ping'`).
4. If no READY is received within 300ms, the content script injects the
   script tag as Safari's canonical MAIN-world path.

The injection coordinator uses a DOM attribute (`data-bewly-main-world-fallback`) with
values `pending`, `loaded`, `failed` to prevent duplicate injection across
multiple calls.

Page-world state transitions: `initializing` → `ready` or `failed`.
Only `ready` state responds to PING or sends `already-loaded`.

### Messaging

`sendMessage` / `onMessage` use `return true` + `sendResponse` internally for
Safari compatibility. The response format is `{ ok: boolean, data?, error? }`;
`sendMessage` unwraps this transparently for callers.

Error serialization preserves structured fields (`code`, `isRiskControl`,
`originalError`) via a whitelist. This allows error codes like `-412` (risk
control) and `ERR_STORAGE_QUOTA` to round-trip through the messaging layer.

### Network Requests

`requestWithSafariCompat` provides a fetch wrapper that integrates with DNR
rules. The DNR rules in `assets/rules.json` cover POST `xmlhttprequest` and
`other` requests to `api.bilibili.com` and `passport.bilibili.com`. These rules
set `Origin` and `Referer` headers at the browser level.

Safari uses the `declarativeNetRequestWithHostAccess` permission because its
`modifyHeaders` action requires host-backed DNR access. The existing Bilibili
host permissions supply that access without broadening the allowed domains.

For DNR-covered requests, the wrapper removes caller-provided `Origin` and
`Referer` values and lets Safari set them through the static rules. For
non-DNR requests, only `Origin` is removed.

The `isDnrCoveredRequest(url, method)` pure function reflects the URL and method
portion of the DNR rule scope and is exported for testing. Safari assigns the
request resource type at runtime.

Safari watch-later add/remove operations do not depend on background header
rewriting. The content script sends a strictly typed request to the existing
MAIN-world bridge, which accepts only the fixed add/remove operations and uses
the page's original `window.fetch`. This lets Safari generate the page Origin,
Referer, and credentials naturally. The bridge never accepts arbitrary URLs and
does not fall back to a background POST after a timeout.

### Token Refresh (P1 fix)

`ensureFreshTokensOnDemand()` waits for the shared `refreshPromise` and returns
the latest access token from background memory. API definitions specify an
auth strategy:

- `none`: no APP auth
- `inject`: inject access token
- `inject+sign`: inject access token and re-sign with TV APP credentials

The background overwrites `access_key` after merging parameters. For signing
requests, the old `sign` from the content script is discarded and recomputed
from the actual outgoing parameters. If no token is available after refresh,
the request fails with `code: "ERR_APP_AUTH_REQUIRED"`.

### Storage

`setAndPersist()` serializes the value and enqueues a single write. The
in-memory ref is only updated after `storage.local.set()` succeeds, with the
sync watcher paused during the update. A serial write queue prevents
concurrent writes from overwriting each other.

Local wallpapers use `setAndPersist()` for atomic replacement: the old entry
is removed and the new entry is added in a single `storage.local.set` call.
If persistence fails, the in-memory state and storage remain unchanged.

Storage quota errors are normalized to `ERR_STORAGE_QUOTA`.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `xcrun: error: unable to find utility` | Xcode not installed or developer directory not selected | Install Xcode Beta, ensure `/Applications/Xcode-beta.app` exists |
| Converter reports unsupported manifest keys | Safari doesn't support some manifest fields | Update `src/manifest.ts` to conditionally exclude fields for Safari |
| Extension installs but doesn't work on sites | Site permissions not granted | Enable extension in Safari Settings and grant Bilibili domain access |
| Background script errors on startup | ESM syntax in IIFE bundle | Run `pnpm validate-safari` to check; ensure `tsup.config.ts` outputs IIFE for Safari |
| Token refresh fails after idle | `setInterval` lost in non-persistent page | Uses `alarms`; check `appAuthScheduler.ts` |

## Upstream Sync

See `.github/workflows/upstream-sync.yml`. The workflow runs weekly (Monday
03:00 UTC) or on manual trigger. It fetches `keleus/BewlyCat` (read-only),
merges into a temporary branch, runs Safari CI, and pushes to `origin/main`.

**Important:** The upstream remote is read-only. The workflow never pushes to
`keleus/BewlyCat`. If merge conflicts occur, the workflow fails and records
conflict files in the step summary.

## Still Requires Manual Safari Verification

The following items cannot be validated by CI and require testing in a real
Safari environment:

- Extension installs and activates in Safari Settings
- Bilibili pages load with BewlyCat UI
- Logged-in and logged-out states work correctly
- Video playback, search, history, watch-later, notifications
- Settings persistence across browser sessions
- Background tab opening
- iframe drawer flows
- MAIN world hooks (history, clipboard, custom elements)
- Script-tag MAIN-world injection and READY/FAILED handshake
- Token refresh after background page termination and restart
- DNR header modification for API/POST requests
- Wallpaper upload, replacement, and removal
