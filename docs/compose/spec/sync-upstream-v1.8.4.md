---
feature: sync-upstream-v1.8.4
status: released
updated: 2026-11-19
branch: codex/sync-upstream-v1.8.4
---

# 同步上游 v1.8.4

从 `dd2c1f68` 合并上游正式 tag `v1.8.4`（`56b39599`），合并提交为
`7442ca43`。Safari 发布版为 `v1.8.4-safari.1`，manifest 为 `1.8.4.1`，
父 App 与扩展版本为 `1.8.4 (1)`。

- 独立设置页加入 Safari 构建，工具栏和站内入口共用已打开的标签页。Safari
  设置继续使用本地存储，壁纸备份恢复沿用原子写入。
- 内容样式随 isolated 脚本加载，恢复流程直接注入脚本。页面世界沿用 Safari
  READY 握手，比对含修订号的版本，保留评论主题和稍后再看页面桥。
- 按上游移除听视频和 hls.js，保留自包含的 FLV 预览模块、Safari APP 扫码
  Origin 修复和首页滚动适配。

## 验收与发布

- 2026-11-19 用户在 Safari 验收通过，确认工具栏可打开独立设置页并授权发布。
- 构建提交与注释 tag 均指向 `2c4b30286afa382814b8e6f26e8b1b44eab6fca3`。
  本地冻结安装、lint、typecheck、knip、Vitest（27 文件、215 项）、Safari 构建和校验均通过。
  [GitHub CI](https://github.com/NoctisWang528/BewlyCat-Safari/actions/runs/44448859225) 通过。
- 构建环境为 Node 24.19.0、pnpm 10.21.0、macOS 27.3 (26C5047e)、
  Safari 27.3 和 Xcode Beta 27.0 (27A5209h)。产物为 arm64，以 Apple Development 签名，未经 Apple 公证。
- [GitHub Release](https://github.com/NoctisWang528/BewlyCat-Safari/releases/tag/v1.8.4-safari.1)
  的 ZIP 与校验和附件已核对大小和 SHA-256。ZIP 为 2,462,606 字节，SHA-256 为
  `2a89845795046bfa2529d1cdf18f21770d79e0fbe8c23dcc7027858ee259b21d`。

## 安装与清理

验收版已移至 `/Applications/BewlyCat Safari.app`。安装包与 ZIP 解压结果逐文件一致，
父 App 与内嵌扩展均为 `1.8.4 (1)`，严格签名验证通过，26 个扩展资源与构建输出一致。
系统已从 Applications 注册 1.8.4 扩展。旧版 App、三个 BewlyCat DerivedData 目录
和本次解压校验目录已移入废纸篓。生成的 Xcode 工程和发布资产已保留。
