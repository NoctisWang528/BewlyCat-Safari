---
feature: sync-upstream-v1.8.4
status: awaiting-safari-acceptance
updated: 2026-11-19
branch: codex/sync-upstream-v1.8.4
---

# 同步上游 v1.8.4

从 `dd2c1f68` 合并上游正式 tag `v1.8.4`（`56b39599`），合并提交为
`7442ca43`。Safari 候选为 `v1.8.4-safari.1`，manifest 为 `1.8.4.1`，
父 App 与扩展版本为 `1.8.4 (1)`。

- 独立设置页加入 Safari 构建，工具栏和站内入口共用已打开的标签页。Safari
  设置继续使用本地存储，壁纸备份恢复沿用原子写入。
- 内容样式随 isolated 脚本加载，恢复流程直接注入脚本。页面世界沿用 Safari
  READY 握手，比对含修订号的版本，保留评论主题和稍后再看页面桥。
- 按上游移除听视频和 hls.js，保留自包含的 FLV 预览模块、Safari APP 扫码
  Origin 修复和首页滚动适配。

实机验收重点为工具栏与站内设置入口、模块开关、设置与壁纸备份、旧标签刷新，
以及登录、首页滚动、播放、稍后再看和评论区。候选须经 Safari 验收后发布。
