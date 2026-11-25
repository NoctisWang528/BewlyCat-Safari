---
feature: sync-upstream-v1.8.5
status: released
updated: 2026-11-25
branch: codex/sync-upstream-v1.8.5
---

# 同步上游 v1.8.5

从 `5035d3e3` 合并上游正式 tag `v1.8.5`（`646f35f4`），合并提交为
`563b6593`。Safari 发布版为 `v1.8.5-safari.1`，manifest 为 `1.8.5.1`，
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
页面设置客户端。错误报告现在由弹窗传入当前语言。用户重启 Safari 后确认报错未再出现，工具栏可打开独立设置页，并授权发布。

## 发布、安装与清理

- `v1.8.5-safari.1` 指向验收构建提交 `6638fe98416700d6a83a02e73069358739d4a1f8`。
  lint、typecheck、knip、现有 Vitest（27 文件、215 项）、Safari 构建和校验均通过。
  [GitHub CI](https://github.com/NoctisWang528/BewlyCat-Safari/actions/runs/45546212415) 通过。
- [GitHub Release](https://github.com/NoctisWang528/BewlyCat-Safari/releases/tag/v1.8.5-safari.1)
  的 ZIP 与 `SHA256SUMS.txt` 已核对大小和 SHA-256。ZIP 为 2,540,380 字节，SHA-256 为
  `0155ad39d36c996373fddc838a445946a11b7bcd06ddc60bcbd77c3e1049e728`。
  App 使用 Apple Development 签名，未经 Apple 公证。
- 验收版已移至 `/Applications/BewlyCat Safari.app`，与发布 ZIP 解压结果逐文件一致。
  App 与扩展均为 arm64 的 `1.8.5 (1)`，严格签名通过，71 个资源与 Xcode 工程及
  WebExtension 构建一致。系统从 Applications 注册了该扩展。
- 两个 BewlyCat DerivedData 目录和本次解压校验目录已移入废纸篓。主工作区 `release/`
  保留发布资产，独立工作树保留生成的 Xcode 工程。
