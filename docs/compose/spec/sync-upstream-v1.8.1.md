---
feature: sync-upstream-v1.8.1
status: candidate
updated: 2026-10-20
branch: codex/sync-upstream-v1.8.1
commits: f8957dba, b24d7962, 7d052861
---

# 同步 BewlyCat 上游 v1.8.1 并构建 Safari 候选版

## Report

**What was built** — 将上游正式 tag `v1.8.1` 合入 Safari 仓库，保留 DNR、
MAIN-world bridge、非持久后台、认证兼容层与 Safari 品牌，生成
`v1.8.1-safari.1` 候选。上游新增的固定 APP client 使用了 Safari 不支持的
DNR `tabIds`，随后实机又发现 WebKit 不接受 `sec-ch-ua*` 请求头操作；两者均已
按构建平台裁剪，并用测试固定 Chromium/Safari 两种规则。

**Verification** — `pnpm lint` / `typecheck` / `knip` / `test`（158）/
`sync-safari-xcode` / Xcode Release arm64 构建、严格 codesign、版本/架构检查
通过；Xcode 工程与最终 `.appex` 的 22 个资源文件均与 `extension-safari/`
一致，SHA-256 为
`4675d8489a01cbd03f846dbee643b4b887f247886b66d7ca3393fdb7d8260fd9`。
旧版和 DerivedData 副本已删除，`/Applications` 仅保留一个已注册扩展。

**Journey log** — 上游把 APP 推荐从 TV 接口迁移到 HD 接口，并把扫码、刷新与
不感兴趣收敛到后台固定 endpoint。Chromium 的会话 DNR 用 `tabIds: [-1]`
排除标签页请求；Safari 不支持该字段，不能整条规则照搬。Safari 候选最终以
固定接口正则限制作用域，仍需实机确认页面自身请求未受影响。首次候选启动时，
Safari 报错 `Failed to update the APP client header rules`；WebKit 的 DNR
请求头白名单不接受 `sec-ch-ua*`，只要一条规则含这些头就会拒绝整批更新。
Safari 不发送这些头，因此 Safari 规则只保留 UA/Referer/Origin 操作。

## [S1] Problem

上游 [`keleus/BewlyCat`](https://github.com/keleus/BewlyCat) 已发布正式 Release
`v1.8.1`（tag 提交 `321c09a4`）。本仓库需要从 `origin/main`（`810cb868`）
合并该正式 tag，完成 Safari 适配并交付可验收的签名 `.app`。用户确认前不得
推送、创建 tag 或 Release，也不得清理 Xcode 临时文件或把应用移入
`/Applications`。

## [S2] Design

### 同步边界

- 仅合并正式 tag `v1.8.1`，不合并 `upstream/main` 上 Release 之后的提交。
- 分支为 `codex/sync-upstream-v1.8.1`。
- 合并提交：`f8957dba`（`chore: 合并上游 v1.8.1`）。
- Safari 适配提交：`b24d7962`（`fix(safari): 适配上游 v1.8.1`）。
- APP client DNR 修复提交：`7d052861`（`fix(safari): 修复 APP client 请求头规则`）。
- 不修改、推送或向上游仓库创建 PR。

### 版本号

| 位置 | 值 |
| --- | --- |
| 候选 / 发布 tag | `v1.8.1-safari.1` |
| `package.json#version` | `1.8.1` |
| `package.json#safariRevision` | `1` |
| 生成 manifest `version` | `1.8.1.1` |
| Xcode `MARKETING_VERSION` | `1.8.1` |
| Xcode `CURRENT_PROJECT_VERSION` | `1` |

### Safari 适配重点

- `src/background/appClient.ts` 保留固定 APP endpoint 白名单、APP 请求头与
  后台签名；Safari 构建省略 DNR `tabIds` 和 WebKit 不接受的 `sec-ch-ua*`
  请求头操作，保留精确正则、`xmlhttprequest` resource type 及 UA/Referer/Origin。
- `src/tests/appClientRules.spec.ts` 同时断言 Chromium 的 `tabIds: [-1]` 与
  完整 client hint 清理，以及 Safari 的无 `tabIds`、无 client hint 分支。
- page-world 测试跟上上游的初始化标记、直播上下文隔离和已有状态保护。
- 动态稍后再看测试改用上游 `.bew-watch-later-cover__btn`，继续覆盖事件阻止、
  请求去重、错误后释放锁和 aid 定位。
- 删除通用 API 的旧 APP `auth` 注入测试，避免恢复已被上游移除的认证路径。
- 四套 locale、版本提醒、About 链接与 Safari 品牌由合并和适配测试共同保护。

### 上游 v1.8.1 功能摘要

- 新增收藏夹整理规则、三连自动同步与默认收藏夹批量整理。
- 动态页支持发表、回复、删除评论和图片上传，转发与评论共用富文本编辑器。
- 动态卡片增加更多菜单、删除/举报、键盘切换、过滤与评论动效。
- 顶栏常驻分区支持搜索、分类、排序、撤销与溢出收纳，并统一媒体卡样式。
- 播放器新增听视频模式、自定义倍速与快捷键调节幅度、预览续播。
- 视频卡片支持选择收藏夹、显示接口分区标签、稍后再看入口和菜单重排。
- 修复多语言路径、快捷键、合集连播、清晰度记忆、WBI 初始化、宽屏、
  iframe 遮挡、滚动、深色主题和通知抽屉等多项问题。

完整内容以上游 `v1.8.1` Release 为准：
<https://github.com/keleus/BewlyCat/releases/tag/v1.8.1>。

## [S3] Verification

环境：

- macOS `27.2`，build `26B118`
- Safari `27.2`
- Xcode Beta `27.0`，build `27A5209h`
- Apple silicon / arm64
- Node.js `v24.19.0`
- pnpm `10.21.0`

自动检查：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm knip`
- `pnpm test`：26 个测试文件、158 个测试通过
- `pnpm build`
- `pnpm validate-safari`
- `pnpm package-safari`
- Xcode Release arm64 构建成功
- `codesign --verify --deep --strict --verbose=2`
- `pnpm check-safari-xcode-sync`

产物：

```text
/Applications/BewlyCat Safari.app
```

父 App 与扩展的 `CFBundleShortVersionString` 均为 `1.8.1`，
`CFBundleVersion` 均为 `1`，可执行文件均为 arm64；签名团队为
`W5J4JBH2BR`，使用 Apple Development 签名，未 notarize。

### 待用户 Safari 实机验收

当前 `/Applications` 只有这一份完整 `.app`，`pluginkit` 只注册一个 1.8.1
扩展；用户将自行完成实机验收。

- 登录与未登录；APP 扫码授权、token 刷新、HD 推荐与不感兴趣请求。
- 首页、动态、搜索、视频播放、稍后再看、收藏夹整理与收藏选择。
- 视频分区标签、预览续播、听视频模式、自定义倍速与快捷键。
- 动态评论/转发/图片上传、键盘切换、举报和删除。
- 深色模式、通知抽屉、顶栏常驻分区、窄屏/宽屏和 iframe drawer。
- 设置持久化、后台标签页打开、会话恢复、扩展/页面控制台无新增错误。
- 检查 Safari APP 会话 DNR 的 URL 级作用域未影响页面自身请求。

## [S4] Out of Scope

- 不合并 `upstream/main` 未发布提交。
- 不构建或发布 Chromium、Edge、Firefox 版本。
- 不做 Developer ID 签名与 Apple notarization。
- 用户验收前不推送、不打 tag、不创建 GitHub Release。

## Tasks

- [x] T1: 合并上游 `v1.8.1` 并解决冲突 — acceptance: merge commit 保留全部 Safari 适配
- [x] T2: 完成 Safari 适配与版本号更新 — acceptance: APP client DNR 按平台裁剪，测试通过
- [x] T3: 全量自动校验、构建、签名与资源一致性检查 — acceptance: 上列命令全部通过
- [x] T4: 删除旧版与 DerivedData 副本并安装唯一候选 — acceptance: 仅存一个 `.app` 和一个已注册扩展
- [ ] T5: 用户在 Safari 实机验收 `/Applications/BewlyCat Safari.app` — waiting
- [ ] T6: 验收后推送本仓库、创建 tag/Release 并清理 Xcode 临时文件 — waiting
