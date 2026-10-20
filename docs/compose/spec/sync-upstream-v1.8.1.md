---
feature: sync-upstream-v1.8.1
status: candidate
updated: 2026-10-20
branch: codex/sync-upstream-v1.8.1
commits: f8957dba, b24d7962, 7d052861, c6f24500
---

# 同步 BewlyCat 上游 v1.8.1 并构建 Safari 候选版

## Report

**What was built** — 将上游正式 tag `v1.8.1` 合入 Safari 仓库，保留 DNR、
MAIN-world bridge、非持久后台、认证兼容层与 Safari 品牌，生成
`v1.8.1-safari.1` 候选。上游新增的固定 APP client 使用了 Safari 不支持的
DNR `tabIds`，已按平台裁剪。后续规则拒绝曾误归因于 `sec-ch-ua*`，
实际根因是旧 `1002` 的 alternation 正则；本次拆为扫码和刷新两条无分支规则。
听视频入口也从 Safari IIFE 中拆出为独立 ESM，保留动态导入所需的命名导出。

**Verification** — 本次全量检查、重建与唯一候选安装均通过，详见 S3。历史候选的
`4675d8489a01cbd03f846dbee643b4b887f247886b66d7ca3393fdb7d8260fd9`
资源摘要已失效，不能用于核对本次修复。仍未经过用户实机验收，尚未发布。

**Journey log** — 上游将 APP 推荐、扫码、刷新和不感兴趣收敛到后台固定 endpoint。
Safari 不支持 `tabIds`，因此 APP DNR 依靠精确主机/路径范围限定作用域。
移除 client hints 后仍报 `Failed to update the APP client header rules`；
已确认被拒绝的是旧规则 `1002` 中的 `|` 分支，不能再把请求头白名单推测写为根因。
新规则保留扫码路径前缀，刷新限定 v2/v3 endpoint 与结尾/可选 query，未扩大权限。
听视频原本要求 ESM，但 Safari tsup 将所有入口输出 IIFE，导致动态导入拿不到
`initListenVideoControl`；现在仅该入口输出 ESM，后台和 pageLoading 继续 IIFE。

## [S1] Problem

上游 [`keleus/BewlyCat`](https://github.com/keleus/BewlyCat) 已发布正式 Release
`v1.8.1`（tag 提交 `321c09a4`）。本仓库需要从 `origin/main`（`810cb868`）
合并该正式 tag，完成 Safari 适配并交付可验收的签名 `.app`。用户确认前不得
推送、创建 tag 或 Release。本次用户明确要求修复后安装至 `/Applications`，
并删除旧应用与 DerivedData 完整应用副本；普通 Xcode 中间缓存留到发布后清理。

## [S2] Design

### 同步边界

- 仅合并正式 tag `v1.8.1`，不合并 `upstream/main` 上 Release 之后的提交。
- 分支为 `codex/sync-upstream-v1.8.1`。
- 合并提交：`f8957dba`（`chore: 合并上游 v1.8.1`）。
- Safari 适配提交：`b24d7962`（`fix(safari): 适配上游 v1.8.1`）。
- 早期 APP client DNR 请求头裁剪：`7d052861`（未解决后续正则拒绝）。
- 本次修复提交：`c6f24500`（`fix(safari): 修复 APP client 与听视频加载`）。
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
  后台签名；Safari 构建继续省略 DNR `tabIds` 和 `sec-ch-ua*`，保留
  `xmlhttprequest` resource type 及 UA/Referer/Origin。扫码 `1002`、刷新 `1005`、
  feed `1003`、dislike `1004` 均不含 alternation；移除列表覆盖旧/新规则并避开 `1001`。
- `src/tests/appClientRules.spec.ts` 同时断言 Chromium 的 `tabIds: [-1]` 与
  完整 client hint 清理，以及 Safari 的四条纯字符串无分支规则；两个构建分支
  覆盖扫码、poll、v2/v3 refresh、feed、dislike/cancel 与错误主机/路径/缺 query。
- `tsup.config.ts` 单独输出听视频 ESM，两个构建任务关闭自身 clean；validator
  检查资源可访问并实际导入 `initListenVideoControl`，继续拒绝后台裸 import/export。
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
- `pnpm test`：26 个测试文件、205 个测试通过（APP 规则 49 项）
- `pnpm build`
- `pnpm validate-safari`；附加故障注入检查确认缺文件、IIFE 无命名导出、
  缺 web-accessible resource 均被拒绝
- `pnpm sync-safari-xcode`（保留现有工程配置，不运行 package-safari）
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

本次从源码提交 `c6f245003e8ea7500ba1a8746de447e767a9236f` 构建，安装后
已从内嵌 content bundle 回读核对该完整 SHA。后续交付记录提交只修改文档，
不会改变已安装候选的源码身份。

22 个资源文件在 `extension-safari/`、现有 Xcode Resources 与最终 `.appex`
中完全一致，聚合 SHA-256：
`8abaa94df383d9b4d58da1f1a1a23e4018111257dd4e07cef9e3c25a60d74396`。

安装前退出 Safari 和 BewlyCat，删除旧 `/Applications/BewlyCat Safari.app`，
用通过校验的新构建替换；安装后再次通过严格 codesign、两个 bundle 的版本/
arm64/签名团队检查与 `BEWLYCAT_APP_PATH` 资源检查。随后注销并删除
`/Users/baixu/Library/Developer/Xcode/DerivedData/BewlyCat_Safari-v1.8.1/Build/Products/Release/BewlyCat Safari.app`，
重新注册 Applications 扩展。`find /Applications`、DerivedData 扫描与 `mdfind`
最终只发现 `/Applications/BewlyCat Safari.app`，`pluginkit -m -A -D -v`
仅返回该路径的一个已注册扩展；未保留旧应用副本。

保留 Xcode 工程、普通 DerivedData 中间缓存与本次验证日志，等待发布后再清理。
故障注入目录为
`/var/folders/pd/ljm0mlqj58dggfr9037xqn5m0000gn/T/BewlyCat-validator-2qqv7394`；
日志为 `/tmp/BewlyCat-safari-181-fix-{tests,build,sync,xcode}.log`。
未自动登录、扫码或进行 Safari 用户验收；未推送、打 tag、生成发布资产或创建
Release。用户自行完成实机验收。

优先检查本次修复：启动时无 APP DNR 更新报错；首页和视频页控制台无听视频
模块加载错误；扩展后台 `getSessionRules()` 中 APP 规则为 `1002`–`1005`，
不含 `tabIds` / `sec-ch-ua*`（独立的 `1001` 规则继续保留）。

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
