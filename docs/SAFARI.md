# Safari Web Extension — Build & Maintenance Guide

This document covers how to build, validate, convert, and troubleshoot the
Safari Web Extension variant of BewlyCat.

## Prerequisites

- Node.js LTS
- pnpm 10.21.0 (repository-pinned)
- Xcode (full install, not just Command Line Tools) for `safari-web-extension-converter`

## Build

```bash
pnpm install --frozen-lockfile
pnpm build-safari
```

This generates the `extension-safari/` directory containing the MV3 WebExtension
bundle with a non-persistent script-based background page.

## Validate

```bash
pnpm validate-safari
```

Checks manifest structure, bundle existence, background script format, MAIN
world entry, web-accessible resources scope, and more. This runs in CI on every
push and PR.

## Convert to Xcode Project

```bash
pnpm convert-safari
```

Runs `xcrun safari-web-extension-converter ./extension-safari --project-location ./extension-safari-macos --macos-only`.

To rebuild the Xcode project after manifest changes:

```bash
xcrun safari-web-extension-converter ./extension-safari --project-location ./extension-safari-macos --macos-only --rebuild-project
```

## Run in Safari

1. Open the generated `.xcodeproj` in Xcode
2. Configure signing (Team, Bundle Identifier)
3. Build and Run the host app (Cmd+R)
4. In Safari → Settings → Extensions, enable BewlyCat
5. Grant website access for Bilibili domains

## Architecture Notes

### Background Lifecycle

Safari uses a non-persistent background page (`persistent: false`). The
extension uses `browser.alarms` for periodic token refresh, falling back to
`setInterval` if alarms API is unavailable. On `runtime.onInstalled` and
`runtime.onStartup`, the alarm is recreated and an immediate token check runs.

### MAIN World Injection

Content scripts inject into the page's MAIN world via manifest `world: "MAIN"`.
A handshake mechanism (`BEWLY_PAGE_WORLD_READY` postMessage) detects whether
the page-world script loaded. If the handshake times out (150ms), a script-tag
fallback injects `inject.global.js` via `runtime.getURL`.

### Messaging

`sendMessage` / `onMessage` use `return true` + `sendResponse` internally for
Safari compatibility. The response format is `{ ok: boolean, data?, error? }`;
`sendMessage` unwraps this transparently for callers.

### Network Requests

`requestWithSafariCompat` checks for `declarativeNetRequest` availability. When
DNR is present and the request is POST, Origin/Referer headers are set by
browser rules. Otherwise, the background fetch sets them directly.

### Storage

Local wallpapers are stored in `browser.storage.local` with size and count
limits (1.5MB per image, 8 max). Storage quota errors are normalized to
`ERR_STORAGE_QUOTA` for consistent UI handling.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `xcrun: error: unable to find utility "safari-web-extension-converter"` | Xcode not installed or developer directory not selected | Install Xcode, run `xcode-select -s /Applications/Xcode.app` |
| Converter reports unsupported manifest keys | Safari doesn't support some manifest fields | Update `src/manifest.ts` to conditionally exclude fields for Safari |
| Extension installs but doesn't work on sites | Site permissions not granted | Enable extension in Safari Settings and grant Bilibili domain access |
| Background script errors on startup | ESM syntax in IIFE bundle | Run `pnpm validate-safari` to check; ensure `tsup.config.ts` outputs IIFE for Safari |
| Token refresh fails after idle | `setInterval` lost in non-persistent page | Should use `alarms`; check `appAuthScheduler.ts` |

## Upstream Sync

See `.github/workflows/upstream-sync.yml`. The workflow runs weekly (Monday
03:00 UTC) or on manual trigger. It rebases onto `keleus/BewlyCat/main`, runs
CI, and creates a PR. If rebase conflicts occur, an issue is created instead.

Manual sync:

```bash
git fetch upstream
git checkout main
git rebase upstream/main
# resolve conflicts if any
git push --force-with-lease origin main
```
