---
feature: sync-upstream-v1.8.3
status: candidate-preparation
updated: 2026-10-31
branch: codex/sync-upstream-v1.8.3
---

# 同步上游 v1.8.3

从 main 4b42b176 合并上游正式 tag v1.8.3（f11de770），merge commit 为 807e42c7。
候选版本为 v1.8.3-safari.1，manifest 1.8.3.1，App 与扩展 1.8.3 (1)。
本次不推送、不打 tag、不发布；等待该版本用户验收。

## 合并与适配

- 保留 Safari 非持久 IIFE 后台、MAIN-world 桥、DNR 固定规则、local-only 设置、
  稍后再看页面请求桥、首页原生滚动优先修复，以及精简后的 README 和贡献者头像。
- 直播预览改为按需加载：hlsPlayer/flvPlayer 与听视频入口一起输出独立 ESM，
  将 hls.js/flv.js 打包进各自模块；manifest 仅新增现有网站范围内的资源项。
  validator 用 JavaScript AST 校验命名导出与无外部静态依赖，保留听视频实际导入校验。
- 顶栏动态加载重构为公共映射函数：保留 aid/bvid 解析、有效视频识别及兼容 rid，
  同时新增 dynId 类型字段支持上次阅读位置。普通加载与向上加载使用相同转换。
- 注入脚本采用上游精简的翻译虚拟模块，保留 Safari 生命周期与页面请求注册。
  shared Vite 配置同时定义 FIREFOX 与 SAFARI，避免 Firefox 专属滚动条在 Safari 启用。
- 保持 pnpm 10.21.0 和原锁文件；未新增依赖，未构建 Chromium/Firefox。

## 上游功能与验收重点

动态阅读位置恢复、向上加载、99+ 角标；画面旋转/镜像、音画同步、全屏滚轮音量；
直播悬停预览按需加载；取消稍后再看/收藏的卡片确认与还原；动态评论编辑器；
环境光、宽屏切集与滚动性能优化。
验收同时复查三种首页布局滚动、登录、听视频、稍后再看增删、设置持久化、
后台恢复及页面/扩展控制台。上游云同步限频代码保留，但 Safari 不初始化云同步。

## 验证与构建

冻结依赖安装、lint、typecheck、knip、test（27 文件 / 215 项）、build 和
validate-safari 均通过。生成 manifest 为 1.8.3.1，无新增 host 权限。
Node 24.19.0、pnpm 10.21.0、macOS 27.2 (26B123)、Safari 27.2、
Xcode Beta 27.0 (27A5209h)。待记录最终签名构建身份和安装结果。实机验收尚未进行。
