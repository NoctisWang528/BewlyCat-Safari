# AGENTS.md

## Scope and objective

These instructions apply to the entire repository.

BewlyCat is a Vue 3 browser extension that modifies Bilibili pages. The upstream
project primarily ships Chromium and Firefox builds. This checkout is also being
used to make the extension work as a Safari Web Extension.

Treat Safari support as incomplete until behavior has been tested in Safari.
The presence of `build-safari` means that a Safari-shaped WebExtension bundle can
be produced; it does not prove API or runtime compatibility. Preserve Chromium
and Firefox behavior unless a task explicitly changes that requirement.

## Toolchain

- Use Node.js LTS, matching `.github/workflows/ci.yml`.
- Use the repository-pinned package manager, `pnpm@10.21.0`.
- Install dependencies with `pnpm install --frozen-lockfile`.
- Do not switch package managers or rewrite `pnpm-lock.yaml` incidentally.
- The codebase uses Vue 3, TypeScript, Vite, tsup, Pinia, UnoCSS, SCSS,
  `webextension-polyfill`, Vitest, and ESLint.

Useful commands, run from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm build
pnpm build-firefox
pnpm build-safari
pnpm convert-safari
```

`pnpm convert-safari` requires a full Xcode installation with its developer
directory selected. Command Line Tools alone do not contain
`safari-web-extension-converter`.

Generated and ignored output directories are:

- `extension/` for Chromium
- `extension-firefox/` for Firefox
- `extension-safari/` for the Safari WebExtension input
- `extension-safari-macos/` for the converted Xcode project

Do not edit generated bundles to implement a source change. Update `src/`,
`scripts/`, or the build configuration and regenerate them. Native wrapper work
may require deliberate Xcode project changes; keep those separate from generated
WebExtension output and revisit `.gitignore` before deciding to version them.

## Build pipeline

The platform is selected at build time:

- default: Chromium
- `FIREFOX=true`: Firefox
- `SAFARI=true`: Safari

`scripts/utils.ts` exposes `isFirefox` and `isSafari`. Platform output selection
is repeated in `scripts/prepare.ts`, `scripts/manifest.ts`, `vite.config.ts`,
`vite.config.content.ts`, `vite.config.inject.ts`, and `tsup.config.ts`.

The build has four relevant stages:

1. `scripts/prepare.ts` copies `assets/` and generates `manifest.json`.
2. `vite.config.content.ts` builds the isolated content script and CSS.
3. `vite.config.inject.ts` builds the script that runs in the page's main world.
4. `tsup.config.ts` builds the background script.

`src/manifest.ts` is the source of truth for all generated manifests.

## Runtime architecture

- `src/contentScripts/index.ts` is the main Bilibili-page entry point. It mounts
  the UI, applies page/player enhancements, and coordinates page navigation.
- `src/contentScripts/views/` contains the main Vue application and page views.
- `src/inject/index.ts` runs in the web page's JavaScript world. It may use page
  globals and `window.postMessage`, but it must not import or call extension APIs.
- `src/background/index.ts` registers background services and message handlers.
- `src/background/messageListeners/api/` defines Bilibili API operations executed
  through the background context.
- `src/utils/messaging.ts` is the typed content/background message boundary.
- `src/logic/storage.ts` defines persisted settings and authentication state.
- `src/composables/useStorageLocal.ts` synchronizes values with
  `browser.storage.local`.
- `src/stores/` contains Pinia stores for UI state.
- `src/components/` contains shared UI; major feature areas include `TopBar`,
  `Dock`, `Settings`, and `VideoCard`.
- `src/_locales/` contains the manually maintained Vue i18n YAML files.
- `assets/rules.json` contains declarative network request rules used to set
  Bilibili request headers.

The options and popup Vue entries exist, but their manifest declarations are
currently commented out in `src/manifest.ts`. Do not assume they are reachable
from Safari's extension UI without adding and testing manifest configuration.

## Safari compatibility work

The current Safari path does the following:

- writes output to `extension-safari/`;
- emits an MV3 manifest with a non-persistent script-based background page;
- retains `declarativeNetRequest` and `assets/rules.json`;
- can be passed to Apple's converter with `pnpm convert-safari`.

It has not established runtime compatibility. Review these hotspots when making
Safari changes:

- background lifecycle behavior, especially scheduled auth refresh and WBI key
  initialization;
- `declarativeNetRequest` support for `modifyHeaders`, request methods, and
  resource-type matching;
- the `world: "MAIN"` content script and its `window.postMessage` bridge;
- `match_about_blank`, `all_frames`, and iframe behavior;
- async values returned from `browser.runtime.onMessage` listeners;
- `browser.tabs.create`, inactive-tab creation, and tab placement;
- `browser.storage.local` persistence and migration;
- host-access prompts for all Bilibili and hdslb domains;
- cookie/authenticated fetch behavior and Bilibili origin/referer handling;
- CSP and web-accessible-resource differences;
- large content bundles and early `document_start` injection.

Prefer capability checks or a centralized Safari build flag over user-agent
sniffing. If runtime source code needs a compile-time Safari branch, add the
define explicitly to the relevant Vite/tsup configuration; `isSafari` currently
exists only in Node-side build configuration.

Do not silently remove functionality to make conversion pass. If Safari cannot
support a feature, isolate the fallback, document the user-visible limitation,
and keep other browser targets unchanged.

## Coding conventions

- Follow the existing TypeScript and Vue Composition API patterns.
- Use the `~/` alias for imports from `src/`.
- Vite entry points use auto-imports configured in `vite.config.ts`. Background
  files commonly import `webextension-polyfill` explicitly; follow the local
  file's established pattern.
- Keep content-script, page-world, and background responsibilities separated.
- Route privileged network requests and tab operations through background
  messaging rather than leaking extension capabilities into page code.
- Avoid unrelated formatting or broad refactors during compatibility changes.
- Never commit generated extension bundles, dependency directories, browser
  profiles, signing material, or local Xcode build products.
- Do not log or expose cookies, access tokens, refresh tokens, or other
  authentication data.
- Do not broaden host permissions without explaining why they are required.

When changing user-facing text, update all locale files:

- `src/_locales/cmn-CN.yml`
- `src/_locales/cmn-TW.yml`
- `src/_locales/en.yml`
- `src/_locales/jyut.yml`

Maintain these files manually as required by `docs/CONTRIBUTING-cmn_CN.md`.

## Validation

For every code change, run at least:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Also run the builds affected by the change. For shared extension code, validate
all three targets:

```bash
pnpm build
pnpm build-firefox
pnpm build-safari
```

For Safari-specific work:

1. Inspect `extension-safari/manifest.json` after generation.
2. Run `pnpm convert-safari` with full Xcode installed.
3. Build and run the containing app from Xcode.
4. Enable the extension in Safari and grant the requested website access.
5. Test logged-out and logged-in Bilibili use.
6. Exercise the homepage, video playback, search, history, watch-later,
   notifications, settings persistence, background-tab opening, and an iframe
   drawer flow.
7. Check Safari's extension and page consoles for permission, CSP, messaging,
   request-header, and background-lifecycle errors.
8. Record the exact macOS, Safari, and Xcode versions used.

Unit tests are under `src/tests/`. Add focused tests for platform-independent
logic. Safari API behavior still requires integration or manual testing in
Safari; a successful bundle build is not sufficient evidence.

## Change hygiene

Before editing, inspect `git status` and preserve unrelated work. Keep changes
small enough to attribute failures to one compatibility decision. Use the
repository's Conventional Commit-style prefixes (`feat`, `fix`, `docs`,
`refactor`, `test`, `chore`, `perf`, or `ci`) if asked to commit.
