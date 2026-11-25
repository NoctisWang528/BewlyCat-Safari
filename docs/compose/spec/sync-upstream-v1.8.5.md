---
feature: sync-upstream-v1.8.5
status: awaiting-safari-acceptance
updated: 2026-11-25
branch: codex/sync-upstream-v1.8.5
---

# 同步上游 v1.8.5

从 `5035d3e3` 合并上游正式 tag `v1.8.5`（`646f35f4`），合并提交为
`563b6593`。Safari 候选为 `v1.8.5-safari.1`，manifest 为 `1.8.5.1`，
父 App 与扩展版本为 `1.8.5 (1)`。

- 深浅色壁纸加入已有的原子替换和备份恢复流程。
- 独立设置页改为 ESM 分包和外链样式，Safari 构建校验跟随新入口。保留 Safari
  的非持久后台、MAIN-world 注入、冷启动恢复、APP 鉴权和本地设置。
- 权限诊断沿用既有网站访问范围，后台消息保留权限错误详情。

Safari 实机验收重点为工具栏打开独立设置页和加载分包菜单、浅色与深色壁纸的上传及
恢复、竖屏放大、稍后再看撤销和站点权限提示。

## 构建环境

Node 26.13.1 LTS、pnpm 10.21.0、macOS 27.3 (26C5047e)、Safari 27.3、
Xcode Beta 27.0 (27A5209h)。候选构建位于独立工作树，保留主工作区的未跟踪文件。

## 验收修正

首轮候选 `886a5257` 的视频播放已获用户确认，Safari 扩展后台同时报告
`readSettingsStorage` 未收到响应。后台的 APP 鉴权依赖错误报告模块，原先会间接初始化
页面设置客户端。错误报告现在由弹窗传入当前语言。修订候选需在 Safari 复核后台报错和设置读取。
