# BewlyCat

> [!IMPORTANT]
> ## BewlyCat Safari — 仅限 macOS Safari
>
> 本仓库是 [keleus/BewlyCat](https://github.com/keleus/BewlyCat) 的
> **Safari-only** 分支。Chrome、Edge 和 Firefox 由上游项目维护，
> 本仓库不承担这些浏览器的兼容性或回归测试。
>
> 本仓库的正式构建、CI、验证、文档和发行流程**仅支持 macOS Safari**。
> 上游 Chromium/Firefox 源码分支被保留以减少合并冲突，但不会在本仓库中
> 构建或发布。
>
> Safari 版本的功能迁移现已完成。后台生命周期、网络请求、MAIN-world
> 注入、权限、登录状态、设置存储等核心功能已经过实际测试，目前均可正常
> 使用，暂未发现影响日常使用的已知问题。
>
> 原项目的问题、功能说明及其他浏览器版本请以上游仓库为准；
> 本仓库的 Safari 适配问题则应在本仓库中跟踪。

Safari 构建、Xcode 打包和测试方法见
[Safari 开发文档](./docs/SAFARI.md)。

## Safari 迁移状态

**已完成。** BewlyCat 的现有功能已迁移至 macOS Safari Web Extension，
并已完成安装、页面注入、登录状态、网络请求、设置持久化和主要功能流程测试。
当前版本可以正常使用；后续工作以跟进上游功能和处理实际使用中发现的问题为主。

## 上游项目资料

以下内容保留自 BewlyCat 上游，仅用于说明功能来源，不代表本仓库支持或发布
Chrome、Edge、Firefox 版本。

![GitHub Release](https://img.shields.io/github/v/release/keleus/BewlyCat?label=Github) ![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/oopkfefbgecikmfbbapnlpjidoomhjpl?label=Chrome) ![Edge Addons Version](https://img.shields.io/badge/dynamic/json?color=blue&label=Edge&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Faaammfjdfifgnfnbflolojihjfhdploj&prefix=v) ![Firefox Version](https://img.shields.io/amo/v/bewlycat?label=Firefox)

![Github Downloads](https://img.shields.io/github/downloads/keleus/BewlyCat/total?label=Github%20Downloads) ![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/oopkfefbgecikmfbbapnlpjidoomhjpl?label=Chrome%20Users) ![Edge Addons Users](https://img.shields.io/badge/dynamic/json?label=Edge%20Users&query=%24.activeInstallCount&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Faaammfjdfifgnfnbflolojihjfhdploj) ![Firefox Users](https://img.shields.io/amo/users/bewlycat?label=Firefox%20Users)

此项目基于[BewlyBewly](https://github.com/BewlyBewly/BewlyBewly)开发，并在其基础上进行功能扩充和调整，并合并了一些其他拓展的功能。

<p align="center" style="margin-bottom: 0px !important;">
<img width="300" alt="BewlyCat icon" src="./assets/icon-512.png"><br/>
</p>

<p align="center">只需对您的 Bilibili 主页进行一些小更改即可。</p>

## 👋 介绍

> [!IMPORTANT]
> 本插件及Fork代码禁止以任何形式的客户端封装！！！插件的目的是仅优化B站官方网站的使用体验。
>
> 该项目面向我个人使用习惯修改。当然，欢迎功能建议与bug反馈。
>
> 浏览器拓展商店上架均同时提交审核，实际更新速度取决于各个商店审核速度。请勿在issue中催促审核，商店异常行为由商店导致！
>
> 本项目由MIT许可在原项目基础上开发，并亦与原作者联系取得了授权，包括上架Chrome应用商店等权利。

> [!CAUTION]
> 为了本项目能够在Github中直接被搜索到，项目将脱离BewlyBewly的Fork网络，成为一个独立的项目。但项目基于BewlyBewly是不变的～项目不会移除历史贡献者和原项目信息。
>
> B站于2026年1月调整了首页推荐API，请更新至`1.5.6`版本及以上，以适配新的首页推荐，排行榜和分区。

## 主要功能异同

### 新增功能

1. 新增视频卡片、顶栏链接后台打开的能力。
2. 新增默认播放器样式设置，当播放器样式是默认和宽屏的时候会自动滚动到弹幕框与底部平齐。
3. 新增用户面板大会员权益领取入口。
4. 新增首页推荐前进后退的能力。
5. 新增合集播放自动关闭功能（需要在设置里开启），方便挂合集听歌。
6. 新增web模式推荐按照点赞/播放比例过滤视频的能力（需要设置里开启）
7. 参考了`Extension for Bilibili Player`插件的快捷键，支持了其中大部分功能的自定义快捷键。
8. 音量均衡功能，可以自定义每个UP的音量相比基准音量增减
9. 记住倍速比例功能，开启后会记住上次倍速
10. 合集视频随机播放功能
11. 视频详情页稍后再看外置
12. 自定义暗色基准色，开启后会根据基准色调整暗黑模式的显示
13. 新增合集视频保持默认播放模式功能

### 删除功能

1. ~~删除了原插件广东话翻译~~广东话翻译由BewlyBewly插件原作者维护（缺少翻译情况下默认显示英文翻译结果）
2. 删除了内置字体，减少打包体积（14.4M -> 600K）
3. 删除了旧版顶栏（减少开发成本），并重构了原项目的顶栏组件（功能无差异）
4. 删除了部分影响功能正常使用的动画（如抽屉打开关闭的动画）

## ⬇️ 安装

### macOS Safari（本仓库 Release）

本仓库的 [Releases](https://github.com/NoctisWang528/BewlyCat-Safari/releases)
只提供 macOS Safari 版本。下载
`BewlyCat-Safari-v版本号-macOS.zip` 后：

1. 按 Release 附带的 `SHA256SUMS.txt` 校验文件并解压。
2. 将解压得到的 `.app` 移入“应用程序”（`/Applications`）并打开。
3. 前往 Safari → 设置 → 扩展，启用 BewlyCat。
4. 按提示授予 Bilibili 及相关域名的网站访问权限。

Safari Web Extension 必须包含在 macOS 宿主 app 中，不能像 Chrome 的
`extension.zip` 一样拖入浏览器安装。如果 Release 未签名或未经过 Apple
notarization，macOS 可能阻止或警告打开；本项目不承诺自动绕过 Gatekeeper。
详细说明见 [Safari 开发与分发文档](./docs/SAFARI.md#release-distribution)。

### Chrome、Edge 和 Firefox（上游项目）

这些浏览器不属于本仓库的构建和发布范围。请使用
[上游 keleus/BewlyCat 的安装渠道和 Releases](https://github.com/keleus/BewlyCat#%EF%B8%8F-%E5%AE%89%E8%A3%85)；
其中的商店版本和 `extension.zip` 仅适用于 Chrome、Edge 或 Firefox，
不适用于本仓库的 Safari Release。

## 🤝 构建项目参考

查看 [CONTRIBUTING.md](docs/CONTRIBUTING-cmn_CN.md)

### BewlyCat&BewlyBewly贡献者

[![Contributors](https://contrib.rocks/image?repo=keleus/BewlyCat)](https://github.com/keleus/BewlyCat/graphs/contributors)

## ❤️ 鸣谢

- [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) - 该项目的基础
- [vitesse-webext](https://github.com/antfu/vitesse-webext) - 该项目使用的模板
- [UserScripts/bilibiliHome](https://github.com/indefined/UserScripts/tree/master/bilibiliHome),
[bilibili-app-recommend](https://github.com/magicdawn/bilibili-app-recommend) - 获取访问密钥的参考来源
- [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) - 部分功能实现
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=keleus/BewlyCat&type=Date)](https://www.star-history.com/#keleus/BewlyCat&Date)
