---
feature: sync-upstream-v1.8.0
status: designed
updated: 2026-09-25
branch: codex/sync-upstream-v1.8.0
commits:
---

# 同步 BewlyCat 上游 v1.8.0 并发布 Safari 版

## Report

## [S1] Problem

上游 [`keleus/BewlyCat`](https://github.com/keleus/BewlyCat) 已发布正式 Release
`v1.8.0`（tag 提交 `7d160db6`）。本仓库当前停在 `v1.7.10-safari.1`
（`e743b983`）。需要把上游正式 tag 合入 Safari 分支，完成 Safari 兼容适配与
版本发布准备，交付可在本机 Safari 验收的签名 `.app`；用户确认后再推送、打
tag、创建 GitHub Release，并清理 Xcode 临时产物、安装到 `/Applications`。

## [S2] Design

### 同步边界

- 仅合并上游正式 tag `v1.8.0`（`7d160db6`），不合并 `upstream/main` 上
  Release 之后的未发布提交。
- 从 `origin/main`（`e743b983`）创建分支 `codex/sync-upstream-v1.8.0`。
- 提交历史保持两笔清晰提交：
  1. `chore: merge upstream v1.8.0`（`--no-ff` merge commit）
  2. `fix(safari): adapt upstream v1.8.0`（Safari 兼容与发布准备）
- 工作流文档更新以独立 docs 提交并入本分支。

### 版本号

| 位置 | 值 |
| --- | --- |
| 发布 tag | `v1.8.0-safari.1` |
| `package.json#version` | `1.8.0` |
| `package.json#safariRevision` | `1` |
| 生成 manifest `version` | `1.8.0.1` |
| Xcode `MARKETING_VERSION` | `1.8.0` |
| Xcode `CURRENT_PROJECT_VERSION` | `1` |
| 版本提醒 / Release 链接 | 显示 `v1.8.0-safari.1`，指向本仓库 Release |

### Safari 必须保留的适配

- MV3 脚本式 background、`declarativeNetRequest` + `assets/rules.json`
- MAIN-world 通过 `<script src="browser.runtime.getURL(...)">` + postMessage 桥注入
- 认证请求兼容层、非持久后台生命周期、Safari 仓库品牌
- 不扩大 host permissions；不引入 `persistent` / `world` / `match_about_blank`
- 上游若引入 Safari 不支持的 API（如 `scripting.executeScript` 的
  `frameIds` / `injectImmediately` / `world`），做参数裁剪并走既有 bridge

### 上游 v1.8.0 变更面（需重点审查）

约 99 个文件、+6021/-1342。主要功能：稍后再看状态共享与动态页标识、本地
音量均衡、播放器清晰度记忆、历史日期网格、本地观看进度、弹幕精简跳过、
动态视频弹窗显示模式、多标签页登录合并、设置读写队列、搜索取消、收藏弹窗
与合集缓存、评论回复树、宽屏侧栏与播放控件等。

重点冲突/兼容文件：

- `package.json`：上游 `packageManager` 变为 `pnpm@11.17.0`，本仓库固定
  保留 `pnpm@10.21.0`，不升级包管理器
- `src/manifest.ts`、`src/inject/`、`src/background/`、`src/contentScripts/`
- `src/logic/storage.ts`、`src/utils/messaging.ts`、`src/utils/api.ts`
- `src/inject/audio/`（新增 localLoudness，检查 page-world 边界）
- 四套 locale

### 两阶段交付

**阶段一（本地，不推送）**

1. 解决冲突，完成 Safari 适配提交
2. Node 24 LTS + `pnpm@10.21.0` + `pnpm install --frozen-lockfile`
3. 全量校验：`lint` / `typecheck` / `knip` / `test` / `build` / `validate-safari`
4. 检查生成 manifest：MV3、`1.8.0.1`、DNR + `scripting`、无禁用字段
5. `pnpm package-safari` 重新生成 Xcode 工程
6. Xcode 27 Beta、Release、arm64、现有 Apple Development 身份（Team
   `W5J4JBH2BR`）构建
7. `codesign --verify --deep --strict` + `pnpm check-safari-xcode-sync`
8. 交付 `.app` 路径与验收清单，停止

**用户验收通过后，阶段二**

1. 复核工作树干净、候选提交未变、tag/Release 尚不存在
2. `git switch main && git merge --ff-only codex/sync-upstream-v1.8.0 && git push origin main`
3. `pnpm release:macos -- v1.8.0-safari.1 "<app-path>"` 生成 zip + `SHA256SUMS.txt`
4. 解压复检签名/版本/架构，撰写并提交 Release notes
5. 创建注释 tag `v1.8.0-safari.1` 并推送
6. `gh release create` 上传 zip 与 `SHA256SUMS.txt`，回读核对资产 digest
7. 清除 BewlyCat 的 Xcode DerivedData 与临时校验目录（移入废纸篓，可恢复）
8. 将打包好的 `BewlyCat Safari.app` 安装到 `/Applications`（旧版移入废纸篓）
9. 最终复核 `/Applications` 中应用的版本、架构、签名与资源一致性

### 签名与产物边界

- 沿用 Apple Development 签名；不执行 Developer ID 签名或 Apple notarization
- Release notes 明确标注：Apple Silicon、Apple Development 签名、未公证
- 产物为 arm64；生成的 `extension-safari/`、Xcode 工程、DerivedData、
  release 资产不纳入 Git

## [S3] Out of Scope

- 不合并 `upstream/main` 未发布提交
- 不构建/发布 Chromium 或 Firefox 产物
- 不做 Developer ID 签名与 Apple notarization
- 不创建 PR；确认后直接快进推送 `main`
- 不修改上游 Chromium/Firefox 分支逻辑以“顺便清理”

## Tasks

- [ ] T1: 将端到端工作流写入 `docs/UPSTREAM-MAINTENANCE-cmn_CN.md` — acceptance: 文档覆盖两阶段交付、版本号约定、清理与安装到 Applications (covers: S2)
- [ ] T2: 合并上游 `v1.8.0` 并解决冲突 — acceptance: merge commit 存在，保留全部 Safari 适配 (covers: S2)
- [ ] T3: 完成 Safari 适配与版本号更新 — acceptance: `fix(safari): adapt upstream v1.8.0` 提交，manifest/版本/Release 链接正确 (covers: S2; depends: T2)
- [ ] T4: 全量校验与签名 `.app` 构建 — acceptance: lint/typecheck/knip/test/build/validate-safari 通过，Xcode Release arm64 构建与签名/资源一致性通过 (covers: S2; depends: T3)
- [ ] T5: 用户验收后发布并清理安装 — acceptance: main/tag/Release 一致，DerivedData 已清理，`.app` 已安装至 `/Applications` (covers: S2; depends: T4)
