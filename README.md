<p align="center">
  <img width="260" alt="BewlyCat Logo" src="./assets/icon-512.png">
</p>

<h1 align="center">BewlyCat-Safari</h1>

<p align="center">
  为 macOS Safari 适配的 Bilibili 首页增强扩展。
</p>

<p align="center">
  <a href="https://github.com/NoctisWang528/BewlyCat-Safari/releases/latest">
    <img alt="GitHub Release" src="https://img.shields.io/github/v/release/NoctisWang528/BewlyCat-Safari?display_name=tag&label=Release">
  </a>
  <a href="https://github.com/NoctisWang528/BewlyCat-Safari/actions/workflows/ci.yml">
    <img alt="Safari CI" src="https://img.shields.io/github/actions/workflow/status/NoctisWang528/BewlyCat-Safari/ci.yml?branch=main&label=Safari%20CI">
  </a>
  <img alt="Platform macOS" src="https://img.shields.io/badge/platform-macOS-black?logo=apple">
  <img alt="Browser Safari" src="https://img.shields.io/badge/browser-Safari-147EFB?logo=safari&logoColor=white">
  <a href="./LICENSE">
    <img alt="Custom License" src="https://img.shields.io/badge/license-Custom-orange">
  </a>
</p>

基于 [keleus/BewlyCat](https://github.com/keleus/BewlyCat)，为 macOS Safari 适配
Bilibili 首页、视频播放与个性化设置体验。本仓库专注 Safari，随 macOS 应用分发。

[下载 Safari 版](https://github.com/NoctisWang528/BewlyCat-Safari/releases/latest) ·
[反馈问题](https://github.com/NoctisWang528/BewlyCat-Safari/issues)

![BewlyCat-Safari 首页](./docs/images/bewlycat-safari-home.png)

## 主要适配路径

- **扩展与后台**：使用 Safari MV3 的非持久后台页，通过 `alarms` 和持久化状态处理定时任务与后台唤醒。
- **页面脚本桥接**：通过 `<script src>` 注入页面脚本，以受限消息协议连接页面与扩展，适配 MAIN world 注入及登录态请求。
- **网络请求**：结合 DNR 固定 endpoint 规则与请求兼容层，处理 Bilibili API 的 Cookie、CSRF 和请求头差异。
- **模块构建**：后台与页面加载入口输出 IIFE；听视频控制模块单独输出 ESM，保留动态导入所需的导出。
- **首页滚动**：在 Shadow DOM 内部视口与文档之间同步滚动位置，优先响应原生输入，同时兼容文档滚动快捷键。
- **原生包装与校验**：通过 Xcode 打包 Safari Web Extension，保留现有签名配置同步资源，并逐文件核对构建产物、Xcode 资源与应用内扩展。

构建和实现细节见 [Safari 适配文档](./docs/SAFARI.md)；
维护流程见 [维护手册](./docs/UPSTREAM-MAINTENANCE-cmn_CN.md)。

## Contributors

<a href="https://github.com/GuZhengSVT">
  <img src="https://avatars.githubusercontent.com/u/88896100?v=4&amp;s=96" width="64" height="64" alt="GuZhengSVT" title="GuZhengSVT：问题报告、排查与首页滚动修复贡献">
</a>

## 致谢

- [keleus/BewlyCat](https://github.com/keleus/BewlyCat)：本项目的上游基础
- [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly)：原始项目与历史贡献者
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved)
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
- [vitesse-webext](https://github.com/antfu/vitesse-webext)
- [PiliPlus](https://github.com/bggRGjQaUbCoE/PiliPlus)

本项目遵循上游 [Custom License](./LICENSE)，使用、修改与分发时请遵守其中的限制。
