# AGENTS.md

## Scope and objective

These instructions apply to the entire repository.

BewlyCat Safari is the Safari-only build of the BewlyCat browser extension for
Bilibili. This repository exclusively targets macOS Safari; Chrome, Edge, and
Firefox are maintained by the upstream project
[keleus/BewlyCat](https://github.com/keleus/BewlyCat) and are **not** supported
here.

Upstream Chromium/Firefox source branches are preserved to reduce merge
conflicts, but they are never built, tested, or released from this repository.

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
pnpm build            # alias for Safari build
pnpm build-safari
pnpm validate-safari
pnpm package-safari   # generates Xcode project
pnpm convert-safari   # compat alias for package-safari
```

`pnpm package-safari` requires Xcode 27 Beta at
`/Applications/Xcode-beta.app` with its developer directory selected.

Generated and ignored output directories are:

- `extension-safari/` for the Safari WebExtension input
- `extension-safari-macos/` for the generated Xcode project

The `extension/` (Chromium) and `extension-firefox/` directories are upstream
build artifacts and are never produced by this repository's CI.

Do not edit generated bundles to implement a source change. Update `src/`,
`scripts/`, or the build configuration and regenerate them. Native wrapper work
may require deliberate Xcode project changes; keep those separate from generated
WebExtension output and revisit `.gitignore` before deciding to version them.

## Build pipeline

The build always targets Safari (`SAFARI=true`). The `FIREFOX` and default
Chromium paths exist only in upstream source and are not invoked here.

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

## Safari compatibility

The Safari build:

- writes output to `extension-safari/`;
- emits an MV3 manifest with a non-persistent script-based background page;
- retains `declarativeNetRequest` and `assets/rules.json`;
- injects the MAIN-world script via `<script src="browser.runtime.getURL(...)">`
  rather than `world: "MAIN"` (unsupported in Safari);
- can be passed to Apple's packager with `pnpm package-safari`.

Key Safari manifest constraints:

- `persistent` is ignored (MV3 background is non-persistent by default);
- `world` is not supported;
- `match_about_blank` is not supported.

Review these hotspots when making Safari changes:

- background lifecycle behavior, especially scheduled auth refresh and WBI key
  initialization;
- `declarativeNetRequest` support for `modifyHeaders`, request methods, and
  resource-type matching;
- the MAIN-world injection and its `window.postMessage` bridge;
- `all_frames` and iframe behavior;
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

Also run the Safari build and validator:

```bash
pnpm build
pnpm validate-safari
```

CI runs `pnpm build`, `pnpm validate-safari`, lint, typecheck, knip, and test
on every push and PR. Chromium and Firefox builds are never run in CI.

For Safari-specific work:

1. Inspect `extension-safari/manifest.json` after generation.
2. Run `pnpm package-safari` with Xcode 27 Beta installed.
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

See `docs/SAFARI.md` for the full Safari build, conversion, and troubleshooting
reference.

## Change hygiene

Before editing, inspect `git status` and preserve unrelated work. Keep changes
small enough to attribute failures to one compatibility decision. Use the
repository's Conventional Commit-style prefixes (`feat`, `fix`, `docs`,
`refactor`, `test`, `chore`, `perf`, or `ci`) if asked to commit.
