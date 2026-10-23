---
feature: sync-upstream-v1.8.2
status: released
updated: 2026-10-23
branch: codex/sync-upstream-v1.8.2
commits: 9d840cd1, a0e63ff7, f37c8241, 236b2b9b
---

# 同步 BewlyCat 上游 v1.8.2 并发布 Safari 版本

## Report

**What was built** — 将上游正式 tag `v1.8.2`（`697dd869`）合入 Safari 仓库，
保留 DNR、MAIN-world bridge、非持久 IIFE 后台、稍后再看页面请求桥、local-only
设置与 Safari 品牌，生成 `v1.8.2-safari.1` 候选。上游新增环境光、沉浸式模式、
动态页推荐模式/列数、About 开源协议与第三方依赖许可、后台 IndexedDB 缓存等；
Safari 构建继续排除 `persistent`、`world`、`match_about_blank`，听视频入口
保持独立 ESM。

**Verification** — 合并后全量 lint、typecheck、knip、test（26 文件 / 205 项）、
build、validate-safari 均通过；`pnpm package-safari` 重建 Xcode 工程，
Xcode Beta Release arm64 构建成功，严格 codesign 与 25 文件资源一致性检查通过。
用户确认后已推送 `main`（CI run `39892683040` 通过），按发布提交 `236b2b9b`
重建并安装签名 `.app`；注释 tag `v1.8.2-safari.1` 与
[GitHub Release](https://github.com/NoctisWang528/BewlyCat-Safari/releases/tag/v1.8.2-safari.1)
已发布，zip 的 SHA-256 为
`cd6e34435a8780e22007161ba9e39c1a632233d3f09facb4e1fc8a770f428a14`，Xcode 临时文件已清理。

**Journey log** — 合并冲突集中在 `package.json`、`tsup.config.ts`、
`src/background/{index,utils}.ts`、`src/contentScripts/index.ts`、
`src/utils/localWallpaper.ts` 和 `About.vue`。上游在 `performApiRequest` 增加
undefined 守卫，但仍按值判断字段是否属于 body；Safari 的结构化克隆会保留
`aid: undefined` 占位键，照搬会把稍后再看的 `bvid`/`aid` 挪到 query。合并时保留
Safari 的 `hasOwnProperty` 键归属判断。另发现基线 `background/index.ts` 丢失了
`GET_BROWSER_INFO_MESSAGE` 注册，About 的浏览器信息会静默回退页面 UA；本次恢复。
第三方许可 JSON 由构建插件生成到 `extension-safari/assets/`，资源数 22 → 25。

## [S1] Problem

上游 [`keleus/BewlyCat`](https://github.com/keleus/BewlyCat) 已发布正式 Release
`v1.8.2`（tag 提交 `697dd869b2c273a5bb63519a6bc1c52deffd1070`，
2026-10-21T14:48:50Z，非 draft、非 prerelease）。本仓库需要从 `origin/main`
（`be93fd97`）合并该正式 tag，完成 Safari 适配并交付可验收的签名 `.app`。
用户确认前不得推送、创建 tag 或 Release；`upstream/main` 上 Release 之后的
提交不在本次同步范围。

## [S2] Design

### 同步边界

- 仅合并正式 tag `v1.8.2`，不合并 `upstream/main` 未发布提交。
- 分支为 `codex/sync-upstream-v1.8.2`。
- 合并提交：`9d840cd1`（`chore: 合并上游 v1.8.2`）。
- Safari 适配提交：`a0e63ff7`（`fix(safari): 适配上游 v1.8.2`）。
- 不修改、推送或向上游仓库创建 PR。

### 版本号

| 位置 | 值 |
| --- | --- |
| 候选 / 发布 tag | `v1.8.2-safari.1` |
| `package.json#version` | `1.8.2` |
| `package.json#safariRevision` | `1` |
| 生成 manifest `version` | `1.8.2.1` |
| Xcode `MARKETING_VERSION` | `1.8.2` |
| Xcode `CURRENT_PROJECT_VERSION` | `1` |

### Safari 适配重点

- `package.json` 保留 `pnpm@10.21.0`、Safari scripts、`safariRevision`、
  本仓库 homepage 以及测试所需的 `jsdom`/`vitest`；不采纳上游的
  `pnpm@11`、pack/submit 脚本和 devDependencies 删除。
- `tsup.config.ts` 同时保留第三方许可 esbuild 插件与上游 ESM 听视频入口；
  后台与 `pageLoading` 继续 IIFE，两个构建任务 `clean: false`。
- `src/background/utils.ts` 保留
  `Object.prototype.hasOwnProperty.call(body, key)` 的字段归属判断，与上游
  undefined 守卫共存，确保 `saveToWatchLater` 的 `bvid`/`aid` 仍在 form body。
- `src/background/index.ts` 恢复 `onMessage(GET_BROWSER_INFO_MESSAGE,
  getExtensionBrowserInfo)`，并按 Safari 能力设置
  `cloudSyncAvailable: !isSafariBuild`、`setupOptionalBackgroundFeatures`。
- `src/components/Settings/About/About.vue` 采用上游 Dialog、`LICENSE?raw`、
  第三方许可与后台浏览器信息，移除云同步入口；保留 Safari 品牌与链接。
- content script 新增排除 `*://message.bilibili.com/pages/nav/*` 与
  `*://t.bilibili.com/pages/nav/*`，避免隐藏顶栏框架重复注入。
- 新增 `scripts/thirdPartyLicenses.ts` 与 Vite/esbuild 插件，许可 JSON 落在
  `extension-safari/assets/`，复用既有 `assets/*` web-accessible 规则。
- `src/utils/localWallpaper.ts` 同时保留 `onError/onReady` 与壁纸写入队列。
- 测试更新：v1.8.2 发布标记、manifest 新增排除项、About 改用后台
  `getBrowserInfo` 消息并断言 1.8.2 文案。

### 上游 v1.8.2 功能摘要

- 视频环境光（Ambilight）与沉浸式模式（iframe 内推荐流、上一条/下一条）。
- 动态页列数、首页推荐模式（Web / Web 游客 / App 单列 / App 双列）。
- 听视频封面个性化与独立设置页；禁用 Dock 回到顶部。
- 关于页开源协议与第三方依赖许可。
- 后台 IndexedDB 动态推荐缓存、多标签页存储广播合并。
- 快捷键全屏限定、中英文间自动空隙及若干播放器/列表修复。

完整内容以上游 `v1.8.2` Release 为准：
<https://github.com/keleus/BewlyCat/releases/tag/v1.8.2>。

## [S3] Verification

环境：

- macOS `27.2`，build `26B118`
- Safari `27.2`
- Xcode Beta `27.0`，build `27A5209h`
- Apple silicon / arm64
- Node.js `v24.19.0`
- pnpm `10.21.0`

自动检查：

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm knip`
- `pnpm test`：26 个测试文件、205 个测试通过
- `pnpm build`
- `pnpm validate-safari`
- `pnpm package-safari`（重建 Xcode 工程，两 target 均为 `1.8.2 (1)`）
- Xcode Release arm64 构建成功
- `codesign --verify --deep --strict --verbose=2`
- `BEWLYCAT_APP_PATH=... pnpm check-safari-xcode-sync`

产物：

```text
/Applications/BewlyCat Safari.app
```

父 App 与扩展的 `CFBundleShortVersionString` 均为 `1.8.2`，
`CFBundleVersion` 均为 `1`，可执行文件均为 arm64；签名团队为
`W5J4JBH2BR`，使用 Apple Development 签名，未 notarize。
Xcode 工程、最终 `.appex` 与 `extension-safari/` 的 25 个资源文件一致，
聚合 SHA-256 为
`4035a73300b4f1dffe153373276dedf821ac22c54acea6934662e12155e2ca2b`。

生成的 Safari manifest 关键值：

- `version: 1.8.2.1`
- `background.scripts: ['./dist/background/index.js']`
- 无 `persistent` / `world` / `match_about_blank`
- `exclude_matches` 含 match/game、toy 与两条 nav 框架路径
- `web_accessible_resources` 含 `assets/*` 与 `dist/contentScripts/listenVideoControl.js`

### 发布构建与安装

安装前退出 Safari，将 `f37c8241` 候选移入
`/Users/baixu/.Trash/BewlyCat Safari-1.8.2-f37c8241-before-release.app`。由于
`236b2b9b` 仅新增文档，按该发布提交重新构建，使 tag、`extension-safari/`
与安装应用完全一致；25 个资源聚合 SHA-256 为
`4035a73300b4f1dffe153373276dedf821ac22c54acea6934662e12155e2ca2b`。
`pluginkit` 中只注册
`/Applications/BewlyCat Safari.app/Contents/PlugIns/BewlyCat Safari Extension.appex`
（1.8.2）。发布 zip 解压后与安装应用逐文件一致，严格 codesign 通过。

### 候选验收重点

候选交付时列出的 Safari 实机检查项，用户确认后进入发布阶段：

- 启动无 DNR/权限/后台消息错误；登录与未登录首页、视频播放、搜索、稍后再看。
- 环境光在普通/网页全屏/剧场模式的表现与关闭后清理。
- 沉浸式模式进入、连续切换、返回退出，iframe 内控制台无 CSP/跨域报错。
- 动态页列数、推荐模式（含 App 单列/双列）、听视频独立设置页。
- 关于页版本、浏览器信息、开源协议与第三方许可弹窗。
- 设置持久化、后台标签页打开、iframe drawer、会话恢复。

## [S4] Out of Scope

- 不合并 `upstream/main` 未发布提交。
- 不构建或发布 Chromium、Edge、Firefox 版本。
- 不做 Developer ID 签名与 Apple notarization。
- 阶段一（用户验收前）不推送、不打 tag、不创建 GitHub Release；本记录发布后此约束仅作历史范围说明。

## Tasks

- [x] T1: 合并上游 `v1.8.2` 并解决冲突 — acceptance: merge commit 保留全部 Safari 适配
- [x] T2: 完成 Safari 适配与版本号更新 — acceptance: manifest 1.8.2.1、测试与 lint/typecheck 通过
- [x] T3: 全量自动校验、签名构建与资源一致性检查 — acceptance: 上列命令全部通过
- [x] T4: 用户在 Safari 实机验收候选 `.app` — acceptance: 用户明确确认验收通过
- [x] T5: 验收后推送本仓库、创建 tag/Release 并清理临时文件

## [S5] Release

- `main` 从 `be93fd97` 快进到 `236b2b9b` 并推送；CI run `39892683040` 的 Test job 全部通过。
- `pnpm release:macos -- v1.8.2-safari.1 "/Applications/BewlyCat Safari.app"` 生成：
  - `release/BewlyCat-Safari-v1.8.2-safari.1-macOS.zip`（2,502,256 字节）
  - `release/SHA256SUMS.txt`（108 字节）
- zip SHA-256：`cd6e34435a8780e22007161ba9e39c1a632233d3f09facb4e1fc8a770f428a14`。
- 注释 tag `v1.8.2-safari.1` 指向 `236b2b9b`；GitHub Release 已发布并回读附件大小与 digest，与本地一致。
- 清理：三个 `BewlyCat*` DerivedData 目录移入废纸篓（名称含 `post-v1.8.2-safari.1-20261023`），删除 `/tmp/BewlyCat-v182-release-check`；保留 `extension-safari-macos/`、`release/` 资产与 `/Applications/BewlyCat Safari.app`。
