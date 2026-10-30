---
feature: fix-safari-home-scroll
status: candidate-preparation
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

待冻结源码提交后填写实测结果。复用现有 Xcode 工程，通过 sync-safari-xcode
同步资源，Xcode Beta Release arm64、Team W5J4JBH2BR、Apple Development 签名。
安装前检查严格签名、版本、架构与三方资源一致性，失败即停止。
唯一候选安装到 /Applications/BewlyCat Safari.app；按用户明确要求删除旧完整
应用与构建目录中的完整应用副本，保留中间缓存、Xcode 工程与历史 release 资产。

## 验收与发布边界

待用户在自适应、单列和双列首页验证连续滚轮、反向滚动、触控板惯性、停顿后
文档快捷键、到底加载及回到顶部，并确认控制台无错误。
本次仅本地提交、构建与安装，不推送、不打 tag、不创建 Release、不发 GitHub 评论。
