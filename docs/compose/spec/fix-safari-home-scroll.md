---
feature: fix-safari-home-scroll
status: released
updated: 2026-10-30
branch: codex/fix-safari-home-scroll
---

# 首页滚动修复与唯一 Safari 候选

基于 v1.8.2 当前 main，参考 GuZhengSVT 的 PR #2（ccfc49c2），本地实现原生
视口优先，定时器仅释放控制权，并补齐迟到文档事件的单向镜像修正。
源码接口和首页启用条件保持不变。版本为 1.8.2-safari.2，manifest 1.8.2.2，
父 App 与扩展均为 1.8.2 (2)；此前 safari.1 已发布，不能复用其版本号。

## 回归证据

新增 10 项滚动桥测试：旧实现 8 失败 / 2 通过，PR #2 3 失败 / 7 通过，
最终实现 10 通过。PR 遗留问题的关键序列为视口停在 1050，文档迟到到 1200，
空闲后相对 +100；最终修复结果为 1150，PR 原实现为 1300。
测试为 jsdom 模拟事件，不等同于 Safari 实机验收。

自动检查已通过：pnpm lint、typecheck、knip、test（27 文件 / 215 项）、build、
validate-safari。Node 24.19.0、pnpm 10.21.0；macOS 27.2 (26B123)、Safari 27.2、
Xcode Beta 27.0 (27A5209h)。

## 构建与安装

源码/构建提交为 `69cae920d2e71c32bdf5110628524637fcc507c8`。复用现有 Xcode 工程，通过 sync-safari-xcode
同步资源，Xcode Beta Release arm64、Team W5J4JBH2BR、Apple Development 签名。
Release arm64 构建成功，安装前后父 App 与扩展的严格 codesign、版本 1.8.2 (2)、
arm64 架构均通过；签名团队 W5J4JBH2BR，Apple Development，未 notarize。
25 个资源在 extension-safari、Xcode Resources 与安装应用中一致，聚合 SHA-256：
`5ac7ccc3271820e7ff73c5a06e1bf7e455e8bb06c0b6ef1a39826fbd08cfae6e`。
候选在上述源码提交冻结后构建；后续交付记录提交仅修改文档，不重建或更换候选。
唯一候选已安装到 `/Applications/BewlyCat Safari.app`。安装前正常退出 Safari 和
BewlyCat，删除旧安装应用；新应用复核通过后注销并删除
`~/Library/Developer/Xcode/DerivedData/BewlyCat_Safari-v182-scroll/Build/Products/Release/BewlyCat Safari.app`。
保留该 DerivedData 的中间缓存、现有 Xcode 工程及历史 release 资产。
工程两 target 的 CURRENT_PROJECT_VERSION 同步为 2，签名和 bundle ID 不变。
mdfind、find /Applications 与 DerivedData、pluginkit 复核仅余安装路径的完整应用
和一个注册扩展副本。未启动 Safari 执行用户验收流程。

## 验收与发布

2026-10-30 用户明确确认自适应、单列、双列首页滚动均正常，并授权发布及回复关闭 Issue #1。

- main 已快进到 cc9a5a74 并推送 origin；CI run 41016671866 全部通过。
- 注释 tag `v1.8.2-safari.2` 指向已验收的源码/构建提交 `69cae920`，main 额外保留文档记录。
- [GitHub Release](https://github.com/NoctisWang528/BewlyCat-Safari/releases/tag/v1.8.2-safari.2) 已发布。
- zip 直接封装已验收安装应用，解压后逐文件一致，严格签名、版本、arm64 复检通过。
- zip 大小 2,481,732 字节，SHA-256：`d8b893f33238e99ff0869d3926bb85ab498fa21640a355fc0991dfe12abfdf80`。
- GitHub zip 与 SHA256SUMS.txt 的大小和 digest 已回读，与本地一致。
- Release notes、README 的 Safari 贡献者列表明确感谢 GuZhengSVT 的问题报告、排查与 PR #2 修复思路和测试。
- 发布成功后将 BewlyCat_Safari-v182-scroll DerivedData 移至废纸篓的
  `BewlyCat-post-v1.8.2-safari.2-20261030`，删除本次解压校验与 PR 检查临时目录。
- 保留 `/Applications/BewlyCat Safari.app`、`extension-safari-macos/` 和 `release/` 资产；未替换用户已验收应用。
