# Safari 适配与历史踩坑交接

本文供新会话接手、排查 Safari 回归和合并上游冲突时使用，记录当前实现、
保留理由、源码入口、测试边界和历史证据。操作步骤见
[上游同步与维护手册](./UPSTREAM-MAINTENANCE-cmn_CN.md)，构建细节见
[SAFARI.md](./SAFARI.md)，仓库约束见 [AGENTS.md](../AGENTS.md)。

核对日期：2026-10-23；核对源码基线：`236b2b9b`（`v1.8.2-safari.1` 发布提交），
`package.json` 为 `1.8.2` / `safariRevision: 1`。最近发布记录为
[v1.8.2](./compose/spec/sync-upstream-v1.8.2.md)，已完成合并、全量自动校验、
发布构建与 GitHub Release；安装应用与发布 zip 逐文件一致。接手时应重新读取当前 Git 状态和版本；本文不代表已重新检查远端
Release、本机证书或 Applications 中应用的现状。

## 新会话先做什么

1. 读根目录 `AGENTS.md`、本文和维护手册，再读最近一次交付记录。
2. 检查工作树、当前分支、最近提交、版本与工具链；保留已有修改。
3. 明确当前任务是诊断、修复、上游同步还是已验收后的发布。旧版本的发布
   确认不能授权新版本；构建候选交用户手测后，等待该版本明确验收通过。
4. 按下表找到源码和测试，理解当前实现再处理冲突。生成 bundle 不作为源码。
5. 交接时记录提交 SHA、检查结果、`.app` 绝对路径、签名/版本/架构、资源
   一致性、用户验收状态和下一步。只记命令通过，不等于 Safari 实机通过。

起手只读命令：

```bash
git status --short --branch
git log --first-parent --oneline -12
node --version
pnpm --version
node -e 'const p=require("./package.json"); console.log({version:p.version,safariRevision:p.safariRevision,packageManager:p.packageManager})'
```

本机工作路径是 `/Users/baixu/Documents/BewlyCat-Safari`。Node 跟随 CI 的
LTS 要求，包管理器固定 `pnpm@10.21.0`；历史记录里出现过的具体 Node
版本、模型名称和测试数量不是永久配置。

## 现有适配索引

下表路径相对仓库根目录。测试位于 `src/tests/`；可用
`pnpm test --run src/tests/<文件名>` 定向运行，代码变更仍须满足 AGENTS 的全量要求。

| 适配 | 关键源码入口 | 回归测试 |
| --- | --- | --- |
| Safari-only 构建、manifest、版本与品牌 | `package.json`、`src/manifest.ts`、`scripts/manifest.ts`、`scripts/utils.ts`、`vite.config*.ts`、`tsup.config.ts`、`src/constants/release.ts` | `manifest.spec.ts`、`releaseMetadata.spec.ts`、`about.spec.ts` |
| isolated 脚本恢复与版本诊断 | `src/constants/contentScript.ts`、`src/contentScripts/pageLoading.ts`、`src/contentScripts/index.ts`、`src/background/contentScriptRecovery.ts`、`src/background/contentScriptRefreshPrompt.ts` | `contentScript.spec.ts`、`contentScriptRecovery.spec.ts`、`messaging.spec.ts` |
| MAIN-world 注入、握手、幂等与失败状态 | `src/contentScripts/pageWorldInjection.ts`、`src/constants/pageWorld.ts`、`src/inject/index.ts`、`src/inject/pageWorldLifecycle.ts` | `pageWorld.spec.ts` |
| 深色评论配色与 Lit 主题同步 | `src/contentScripts/commentThemeTokens.ts`、`src/inject/commentShadowDarkMode.ts`、`src/inject/index.ts`、`src/styles/adaptedStyles/common/comments.scss` | `commentThemeTokens.spec.ts`、`commentShadowDarkMode.spec.ts`、`commentStyles.spec.ts` |
| 稍后再看页面请求桥与动态卡片 ID | `src/utils/api.ts`、`src/utils/pageWatchLater.ts`、`src/inject/pageWatchLater.ts`、`src/utils/momentVideoIdentifier.ts`、`src/utils/watchLaterActions.ts`、`src/logic/watchLaterState.ts`、`src/background/watchLaterStateBroker.ts` | `api.spec.ts`、`pageWatchLater.spec.ts`、`momentVideoIdentifier.spec.ts`、`momentsWatchLater.spec.ts`、`watchLaterActions.spec.ts`、`openTabsWatchLater.spec.ts` |
| 消息响应、断连重试和可取消读取 | `src/utils/messaging.ts`、`src/background/messageListeners/api/index.ts`、`src/background/requestTimeout.ts` | `messaging.spec.ts`、`api.spec.ts` |
| DNR、APP 鉴权、WBI、匿名搜索和请求缓存 | `assets/rules.json`、`src/background/requestWithSafariCompat.ts`、`src/background/appClient.ts`、`src/background/utils.ts`、`src/background/appAuthScheduler.ts`、`src/background/wbiSign.ts`、`src/background/apiResponseCache.ts` | `requestWithSafariCompat.spec.ts`、`backgroundRequestAssembly.spec.ts`、`authApi.spec.ts`、`appAuthScheduler.spec.ts`、`appClientRules.spec.ts` |
| local-only 设置、写入守卫与壁纸事务 | `src/background/platformFeatures.ts`、`src/background/settingsStorageCoordinator.ts`、`src/composables/useStorageLocal.ts`、`src/utils/storageWriteQueue.ts`、`src/utils/localWallpaper.ts` | `platformFeatures.spec.ts`、`settingsStorageCoordinator.spec.ts`、`storageWriteQueue.spec.ts`、`localWallpaper.spec.ts` |
| 动态页经常访问的 UP 主横幅 | `src/contentScripts/views/Moments/Moments.vue`、`src/background/messageListeners/api/moment.ts`、`src/logic/storage.ts`、`src/components/Settings/PluginComponentsAndPages/Moments/Moments.vue` | `momentsUpList.spec.ts` |
| Xcode 资源快照、签名与分发 | `scripts/package-safari.mjs`、`scripts/sync-safari-xcode-resources.mjs`、`scripts/validate-safari-build.mjs`、`scripts/release-macos.sh` | `validate-safari`、`check-safari-xcode-sync`、严格 codesign、解压复检与人工验收 |

这些测试有些使用 mock 或源码文本断言，并非全部执行真实浏览器行为。
例如 `manifest.spec.ts` 的版本是受控 mock；当前版本必须另看实际生成的
`extension-safari/manifest.json`。不得仅凭旧测试中的版本字面量判断仓库版本。

## 适配原理与不能丢失的约束

### 1. 构建与 manifest

- `pnpm build` / `build-safari` 都设置 `SAFARI=true`，仅产出
  `extension-safari/`。上游其他浏览器分支保留以减少合并冲突，不从本仓库构建。
- Safari 使用 MV3 `background.scripts`，后台由 tsup 输出 IIFE；不要改回
  Chromium 的 module service worker，或留下后台 ESM import/export。
- 权限包含 `storage`、`alarms`、`cookies`、`scripting` 和
  `declarativeNetRequestWithHostAccess`；host permissions 限定 Bilibili / hdslb。
  `assets/rules.json` 仍须注册。不要因 packager 警告直接删掉功能或扩大域名。
- 不生成 `persistent`、`world`、`match_about_blank`。保留 `all_frames` 与现有
  URL 排除规则，包括 `match/game`、`toy` 和 B 站隐藏顶栏框架的
  `*://message.bilibili.com/pages/nav/*`、`*://t.bilibili.com/pages/nav/*`（避免每个
  标签页多一套存储监听与后台请求）；iframe drawer 与沉浸式 iframe 另做 Safari 验收。
- content scripts 顺序是 `pageLoading.js` → `index.global.js`，在
  `document_start` 执行；MAIN-world bundle 通过可访问资源单独加载。
- 当前 Vite shared config 与 tsup 都定义了 `process.env.SAFARI`；新增构建
  入口要确认继承对应 define，不能在页面世界导入 Node 侧 `scripts/utils.ts`。
- `listenVideoControl.js` 由 `listenVideoFeature.ts` 动态 `import()` 并读取
  `initListenVideoControl`，必须单独输出 ESM；不能将 Safari 的所有 tsup 入口
  一律设为 IIFE。后台与 `pageLoading.js` 仍为 IIFE。两个任务均 `clean: false`，
  由 `clear-safari` 统一清理，避免互删产物。validator 实际导入听视频产物并
  断言导出函数，同时检查它在 web-accessible resources 中。
- 后台依赖可能间接引入 Vue；tsup 的 Vue 编译期 feature flags 也需保留。
  仅给 Vite 配置 flag 不覆盖后台 bundle，需检查最终产物没有未替换的常量。
- 第三方依赖许可由 `scripts/thirdPartyLicenses.ts` 在 content/inject/background
  三处分别生成 `assets/third-party-licenses.*.json`；`assets/*` 已在
  web-accessible resources 中，Safari 资源数由 22 增至 25。缺文件时 About 只提示
  加载失败，不应让设置页崩溃，也不要为此放宽 host permissions。

版本由 `package.json#version` + `safariRevision` 生成：展示/tag 为
`vX.Y.Z-safari.N`，manifest 为 `X.Y.Z.N`，Xcode 两个 target 为
`MARKETING_VERSION=X.Y.Z` / `CURRENT_PROJECT_VERSION=N`。
About、版本提醒、更新检查统一使用 `src/constants/release.ts` 中的 Safari
仓库链接；Bilibili 链接保持 `https://space.bilibili.com/34234421`。

### 2. 会话恢复与页面世界生命周期是两层机制

后台恢复检查活动、加载完成、未 discarded 且 URL 合法的标签页。PING 返回
的名称、runtime URL、完整 manifest 版本和构建 commit 都相符才视为当前脚本。
缺失时等待 100ms 再检查；旧版提示刷新，避免在同页叠加新旧实例。

Safari 恢复只用 `{ target: { tabId }, files: [...] }`：先 CSS，再
`pageLoading.js`，再 isolated 主脚本。不传 `frameIds`、`world`、
`injectImmediately`。注意 PING 的 `tabs.sendMessage` 第三个参数中的
`frameId: 0` 属于另一 API，不能因裁剪 scripting 参数而一起误删。

content 入口用 `__BEWLYCAT_CONTENT_SCRIPT_INITIALIZED__` 防重复。版本身份读取
`browser.runtime.getManifest().version`，不能把上游 `X.Y.Z` 与 Safari
`X.Y.Z.N` 比较。Vue 宿主替换会释放旧 App，保持单一 `#bewly`，以免 watcher
落在旧宿主、布局变量失效。

MAIN-world 则用 `<script src="browser.runtime.getURL(...) 生成的地址">`：
先监听 READY/FAILED，发送 PING，300ms 内无 READY 才插入脚本；加载后还需等
READY，`onload` 本身不算初始化成功。DOM 属性
`data-bewly-main-world-fallback` 标记 `pending` / `loaded` / `failed`，当前
实现遇到已有标记不会再插入，失败后应刷新并排查，不能承诺自动无限重试。
页面全局 `__bewlyPageWorldState` 防止重复装 history/fetch/custom element 等
hook，仅 `ready` 回复成功握手；失败发 FAILED。

page world 只能用网页能力与受限消息协议，不得导入 extension API、读取扩展
storage 或暴露任意请求代理。设置经 `createPageSettingsPayload` 精简后传入。

### 3. 评论深色主题：变量与组件状态都要同步

历史表现是深色背景下正文/图标接近黑色、输入框发白，浅色模式正常。B 站
组件初始化的浅色状态与 BewlyCat 主题时序不一致；普通 DOM 的
`CustomEvent('global.themeChange', { detail: ... })` 不能替代组件内部主题协议。

当前分工：

- content world 的 `installCommentThemeTokens()` 在 `html.dark.bewly-design`
  下解析实际 BewlyCat 颜色，以 `!important` 内联写入 `bili-comments` 根宿主的
  B 站原生变量。包含 `--text1`～`--text4`、背景、边框、图形、链接和
  `--bg1_rgb`，嵌套 Shadow DOM 通过原生变量继承；解析失败使用深色 fallback。
- 观察 html 的 class/style、深色基准色事件及新评论根节点。切浅色或停用适配
  时，删除带所有权标记 `data-bewly-comment-theme` 的覆盖属性。
- page world 的 `installCommentShadowDarkMode()` 同步 `bili-comments.theme`。
  原始 `update()` 返回后用微任务校正，WeakSet 合并同实例连续更新，保留原始
  返回值并隔离补丁异常。处理已渲染、延迟定义、替换的根节点和主题切换。
- 释放主题控制时尊重 B 站自己的 `bili_dark`，避免误改独立深色页面。

不要恢复旧的递归配色 `<style id="bewly-comment-dark-style">`、浅色 fallback，
也不要把 `:host()` 放回普通文档样式表期望它穿透 Shadow DOM。
`src/inject/index.ts` 中评论树/分页/按钮的结构样式仍需保留，它们与旧递归
配色补丁不是一回事。当前通用评论增强在 Lit 生命周期后异步执行并等待渲染，
应避免把 DOM 改动塞回 B 站同步 render。

颜色问题不能只断言 CSS 字符串。Safari 中须看最终 computed color、变量和
Lit `theme`，同时验证正文、回复、图标 currentColor、输入框、分隔线、悬停/
激活态、深浅切换、展开、刷新和 SPA 导航。Chromium 截图只能辅助对照。

### 4. 稍后再看走页面 fetch，不能只补请求头

Safari 的添加/移除由 `APIClient` 统一分流到页面桥，使用页面原始 fetch、
`credentials: include` 和页面 `bili_jct`，由浏览器生成 Origin/Referer。
桥只接受固定的 `saveToWatchLater` / `removeFromWatchLater` 和受限参数，
内部固定 add/del URL；检查同一 window、source 和请求 ID。

桥失败或 15 秒超时就报错，不回退后台 POST，以免重复执行未知是否成功的写操作。
移除普通条目必须有有效 aid，不能只凭 bvid；动态卡片使用
`extractMomentVideoIdentifier` 识别 aid/bvid，必要时查询视频信息。
顶栏弹窗与视频卡片保留 pending、防连点、失败恢复及共享稍后再看状态。
上游共享状态逻辑可继续演进，但底层 Safari 页面请求路由必须保留。

`src/background/utils.ts` 的 `performApiRequest` 在 v1.8.2 增加了 undefined 守卫，
但字段归属仍按 body 模板键是否存在判断：Safari 的结构化克隆会保留
`aid: undefined` 这类占位键。若改成按值是否为 undefined 判断，`bvid`/`aid` 会被
挪到 query，而 add/del 接口要求 form body。当前保留
`Object.prototype.hasOwnProperty.call(body, key)` 语义，与上游守卫共存；改请求
组装时先跑 `backgroundRequestAssembly.spec.ts`。

回归至少检查首页卡片、顶栏动态、动态页、稍后再看列表、合集切集和播放后移除。
批量添加已打开标签页的 URL 解析另见 `src/utils/openTabsWatchLater.ts`。

### 5. 后台消息、认证与非持久生命周期

- `onMessage` 包装使用 `return true` + `sendResponse({ ok, data/error })`，
  `sendMessage` 解包；错误白名单保留 code/isRiskControl/originalError。
  不要整套改回直接返回 async listener Promise，或把业务错误当成功空响应。
- 暂时后台断连有有限重试；context invalidated 提示刷新。可取消读取使用独立
  Port，关闭后取消后台请求；请求超时、取消与写操作重试要分开理解。
- 非持久后台使用 `alarms` 每 5 分钟检查授权，缺失能力时才退回 interval；
  注册 installed/startup 路径，并在 setup 时做即时检查。仅 interval 不能保证
  后台被挂起后刷新。
- 扫码登录、token 刷新、HD 推荐流和不感兴趣都走 `appClient.ts` 的固定
  endpoint 白名单，由后台按 PiliPlus 的 APP 请求头签名；内容层只能提交受限
  参数，不能把任意 URL 变成后台代理。通用 `api` 请求不再注入 APP token。
- 定时器与按需刷新共用 refreshPromise，取后台内存中的最新 token。旧请求、
  撤销或重新授权会替换 token 快照，完成后的旧刷新不得恢复旧授权。
- `appClient.ts` 用会话 DNR 改写 APP 请求的 UA/Referer 并移除 Origin 与
  client hints。Chromium 用 `tabIds: [-1]` 限定为非标签页请求；Safari 不支持
  该字段，构建分支会省略它，仅保留固定接口的精确正则与 `xmlhttprequest`
  resource type。此前将后续拒绝误判为 `sec-ch-ua*` 请求头问题；本次确认
  根因是旧规则 `1002` 的 alternation（`|`）正则。现在拆为扫码前缀 `1002`
  和 v2/v3 token refresh `1005`，加上 feed `1003`、dislike `1004` 共四条
  无分支正则规则。移除列表含旧 `1002` 与新 `1005`，不触碰 `1001`。
  Safari 继续只设置 UA/Referer 并移除 Origin，不添加 `tabIds`/`sec-ch-ua*`；
  Chromium 仍带 `tabIds: [-1]` 和六项请求头操作。
  因此 Safari 的作用域是 URL 而非标签页，实机必须确认 B 站页面自己发出的
  同名接口请求没有被意外改写。
- `requestWithSafariCompat` 与静态 DNR 配合：api/passport 的 POST 覆盖
  `xmlhttprequest` / `other`。覆盖范围内移除脚本 Origin/Referer，交 DNR 设置；
  其他请求移除 Origin、保留调用方 Referer。主机必须精确匹配，不能用后缀误匹配。
- 去个性化搜索仍走后台 `bewlyNoCookie`、匿名 WBI key、`qv_id`；不能重新加入
  已移除的无 Cookie 页面搜索桥，也不能删掉匿名签名只做 credentials omit。
- 当前缓存只复用标记可缓存的匿名 GET，带凭据请求直接执行，避免跨账号复用；
  session storage 缺失/失败时退化为进程内缓存，不假设其始终可用。
- About 页的浏览器信息通过 `GET_BROWSER_INFO_MESSAGE` 由后台读取，注册在
  `src/background/index.ts`。历史上合并曾丢失该注册，消息失败会静默回退页面 UA；
  Safari 的页面 UA 可能被防移动端逻辑改写，显示结果会错误。调整后台 setup 顺序时
  保留这条注册，并用 `about.spec.ts` 覆盖消息路径。

响应返回 HTML 可能是风控，不能当普通 JSON。日志和交接证据不得包含 Cookie、
CSRF、token、完整认证头或带密钥的请求 URL。

### 6. local-only 设置与 Safari Disk I/O

Safari 的 `setupSettingsStorageCoordinator({ cloudSyncAvailable: false })`
限制比“隐藏开关”更重要：即使旧存储残留云同步偏好或冲突元数据，也不能访问
`storage.sync`。`platformFeatures.ts` 同时不初始化云同步与 Cookie change
登录监听；保留其他登录/认证读取路径，不要理解成移除登录能力。

`useStorageLocal` 合并默认值，`setAndPersist()` 持久化成功后更新内存。
本地壁纸替换在一次写入里同时处理新旧条目，失败不能先丢旧壁纸；配额错误
规范为 `ERR_STORAGE_QUOTA`，不能被泛化成可无限重试的错误。

v1.8.0 验收实际遇到：

```text
Invalid call to browser.storage.local.set(). Disk I/O error.
```

`src/utils/storageWriteQueue.ts` 模块加载即幂等包装 set/remove，content、
background 和 `useStorageLocal` 都导入它。同一 JS 上下文内串行，失败不会卡死
后续队列；对 Disk I/O / 对应 Invalid call 做有限重试，最多 4 次。该模块没有
跨进程全局锁，也不保证所有并发读改写具有事务性；跨标签页竞争通过瞬态重试
缓解，不能把它写成“全局串行化”或“任意错误都会自动修好”。

### 7. 动态页 UP 横幅：先确认源码基线与数据链

历史 Safari 截图连“显示经常访问的 UP 主”设置都没有，不能只推断是 Safari
CSS 隐藏。先确认候选 bundle 是预期版本，再顺着设置 → portal 请求 →
返回结构 → 归一化 → 显示条件定位。

当前默认 `momentsShowUpList: true`；portal 参数包含 `up_list_more: 1`、
`web_location: '333.1365'`，`Moments.vue` 支持列表/对象结构并归一化数据。
显示条件还取决于加载态、列表、置顶用户和想看筛选；接口失败会清空 portal
状态。Bilibili 原版动态页的横幅设置与 Bewly 动态页设置是不同入口。
`momentsUpList.spec.ts` 只覆盖请求参数/默认值，真实账号数据、横向滚动、点击
筛选、设置持久化仍需手测；不要把缺组件一概记为浏览器 API 不支持。

### 8. UI 样式快照与 Xcode 三方资源

`vite.config.content.ts` 将生成 CSS 内嵌到 isolated JS 的
`__BEWLYCAT_BUNDLED_STYLE_TEXT__`，挂载时插入 BewlyCat ShadowRoot；manifest
仍提供普通页面 CSS。排查无样式先看入口、宿主和打包 CSS，不要直接改生成文件。

Xcode packager 用 `--copy-resources`，所以 `pnpm build` 只更新第一份：

```text
extension-safari/ → Xcode Extension/Resources/ → .app 内 .appex/Contents/Resources/
```

普通源码更新用 `pnpm sync-safari-xcode`，再 Xcode 构建；上游版本同步或重建
包装器用 `pnpm package-safari`。后者会清掉旧生成工程，需记录并重新指定 Team、
bundle ID、Release 版本与签名配置。不能为每个 CSS 修改反复重建工程。

对最终 app 用 `BEWLYCAT_APP_PATH="<绝对路径>" pnpm check-safari-xcode-sync`
逐文件核对三份内容与 SHA-256。仅 codesign 成功不能证明内嵌的是最新 bundle。
保留 Apple 默认 Embed 的 `RemoveHeadersOnCopy`；不要随手加 `CodeSignOnCopy`。

`release:macos` 会重新生成 WebExtension，却不会编译/同步 Xcode app，也不会
因签名校验失败自动阻止所有后续步骤。因此发布方需严格复核最终 app 和 zip，
尤其避免在源码/构建 commit 变化后压入旧 app。脚本会覆盖公共 `SHA256SUMS.txt`
及同名 zip，不能把它当多版本资产归档器。

### 9. v1.8.2 新增功能的 Safari 风险面

- 环境光 Ambilight：`src/utils/ambilight/ambilightEngine.ts` 把 `<video>` drawImage
  到 canvas 取色；跨域媒体可能使 canvas tainted 或抛异常，引擎已用 try/catch 降级为
  不绘制，不能当成崩溃。验收确认普通/网页全屏/剧场模式下是否出现环境光，关闭后
  宿主节点是否移除，以及性能与控制台异常。
- 沉浸式模式：`src/contentScripts/immersiveFeedFrame.ts` 在 iframe 内运行（content
  script 仍 `all_frames`），用 `window.name` 区分预加载帧、`postMessage` 与首页通信、
  IntersectionObserver 加载更多，并在原生播放器控制栏插入上一条/下一条。Safari
  手测覆盖从首页卡片进入、连续切换、预加载帧保持暂停、返回退出、iframe 内控制台
  无跨域/CSP 错误。
- 动态页推荐模式（Web / Web 游客 / App 单列 / App 双列）与动态列数：确认布局、
  滚动与设置持久化；App 模式仍依赖既有 APP endpoint 与 DNR 规则。
- 关于页开源协议与第三方依赖：按钮拉取 `assets/third-party-licenses.*.json`，缺文件
  只显示失败提示；`LICENSE?raw` 由 Vite 内联。浏览器信息改由后台读取（见第 5 节）。
- `src/background/extensionCacheStore.ts` 使用后台 IndexedDB 保存动态推荐缓存
  （`momentsFeedCache`）；Safari 后台 page 可用 IndexedDB，但重启/清缓存后应能重建，
  不依赖 `storage.session`。
- SO 快捷键仅播放器全屏生效、中英文间自动空隙、多标签存储广播合并均属纯前端
  逻辑，随对应页面一起手测。

## 历史记录与检索证据

以下 commit 是本地历史中的定位入口；部分修复被并入版本适配提交，未独立提交。
保留当前逻辑的理由以以上源码核对为准，不能将历史尝试误当现行方案。

| 提交 / 版本 | 记录的工作或踩坑 | 接手时的启示 |
| --- | --- | --- |
| `78da6b28`、`3d1a9932`（初始迁移） | Safari manifest、IIFE 后台、消息响应、alarms、注入握手、原子壁纸写入、Safari-only 构建 | 转换成功只表示结构可打包，生命周期、请求头和资源仍需验证 |
| `419c4500` → `346c8d32`（v1.6.7 阶段） | 页面稍后再看桥、随后修复动态栏 ID 与 pending/错误恢复；增加 Xcode 资源同步脚本 | 主页可用不等于所有入口可用；检查最终 app 资源快照 |
| `525159f8`（v1.6.9） | 评论根宿主颜色变量与 Lit 主题校正、会话恢复参数、完整 Safari 版本链接 | 仅注入 CSS 文本、同步 update 内改 DOM 或发送错误主题事件都不足以保证最终颜色 |
| `a4e43ff1` | 版本提醒作者地址改为维护者 Bilibili 空间 | 合并上游不能恢复上游作者链接 |
| `9d2b3e75`（v1.7.4） | UP 横幅回归测试、Safari 可选能力隔离 | 缺设置先对齐源码与产物；不要初始化不可用的云同步/Cookie change 功能 |
| `122cbb37`（v1.7.6） | local-only 协调器、匿名搜索与 Safari bridge 合并 | 旧云同步开关也不能越过能力边界；页面搜索桥不再是现行路径 |
| `a9531408`、`84afbc6e`（v1.7.8–v1.7.9） | 版本化 ping/构建标识、刷新提示、早期 pageLoading 与单一恢复生命周期 | 完整 manifest 版本与上游版本不同；旧脚本应提示刷新而非重复 mount |
| `e743b983`（v1.7.10） | 接收打开标签页批量加入稍后再看；保留 querySerializer 与空 query 不附加问号 | 上游请求组装扩展不能覆盖 Safari 认证兼容层 |
| `0ca3465f`、`aa3d2f70`（v1.8.0） | 上游超时/取消、共享状态及 Safari 验收中的 storage Disk I/O 修复 | 单个存储 ref 队列不能覆盖整个上下文，更不等于跨上下文锁 |
| `f8957dba`、`b24d7962`、`7d052861`（v1.8.1） | 合并 HD 推荐与固定 APP client；收窄 page-world 钩子并隔离补丁；Safari 会话 DNR 移除 `tabIds`，随后尝试移除 `sec-ch-ua*`，但后者未解决规则拒绝 | 已更正根因：旧 `1002` 的分支正则被 WebKit 拒绝，不能把请求头推测当成已验证结论 |
| `c6f24500`（v1.8.1 候选修复） | 拆分扫码/刷新 DNR 为无分支规则；听视频独立 ESM，后台/pageLoading 保持 IIFE | 不恢复旧 `1002` 的 alternation；动态 import 的命名导出必须检查实际产物；Safari 手测仍由用户完成 |
| `98ed387c` 交付记录 | 记录 macOS 同步产生的 `* 2` 副本干扰 knip / Git refs | 先辨认重复文件与来源；不要批量删除名字含空格/数字的正常文件或手改 Git refs |
| `9d840cd1`、`a0e63ff7`（v1.8.2） | 合并环境光、沉浸式 iframe、推荐模式、动态列数、About 许可与 IndexedDB 缓存；恢复后台 browser info 注册；请求组装保留 body 模板键语义 | 上游新增 undefined 守卫不能改变 Safari 的 form body 字段归属；iframe/画布/IndexedDB 需实机手测 |
| `236b2b9b`（v1.8.2 发布） | 按发布提交重建，tag `v1.8.2-safari.1` 与 GitHub Release 发布；zip 与安装应用逐文件一致 | 发布构建的 commit 必须与 tag 和 `extension-safari/` 一致；文档提交后重建会改变内嵌构建标识 |

按文件追查即可，不需要重新依赖旧聊天：

```bash
git log --oneline -- src/contentScripts/commentThemeTokens.ts src/inject/commentShadowDarkMode.ts
git log --oneline -- src/utils/storageWriteQueue.ts
git show 525159f8 -- src/contentScripts/commentThemeTokens.ts src/inject/commentShadowDarkMode.ts
git show aa3d2f70 -- src/utils/storageWriteQueue.ts src/tests/storageWriteQueue.spec.ts
```

## 故障定位与交付边界

| 现象 | 优先检查 |
| --- | --- |
| 新源码构建成功，Safari 仍是旧界面 | 版本/commit、Xcode copied Resources、最终 `.appex`、安装路径、当前标签页是否刷新 |
| 深色评论正文黑、输入框白 | `html.dark.bewly-design`、根内联原生变量、Lit theme、原生/Shadow 两类评论、旧补丁残留 |
| 会话恢复后空白或重复 UI | PONG 身份、两层幂等标记、pageLoading 顺序、READY/FAILED、重复 `#bewly` |
| 稍后再看首页可用但动态失败 | aid/bvid 归一化、原始页面 fetch、CSRF 是否存在、pending/失败回滚、是否误走后台 POST |
| APP client 会话规则更新失败 | 旧 `1002` 是否仍含 `\|`、四条规则及清理 ID、Safari 无 `tabIds`/`sec-ch-ua*`、实际安装资源 |
| 听视频模块加载失败 / 缺少初始化函数 | `listenVideoControl.js` 是否为 ESM、命名导出与 web-accessible resources、最终 app 三方资源一致性 |
| 休眠后授权失败 | alarms、按需刷新、共享 promise、请求最终签名；只看设置页 token 存在不够 |
| 设置不持久、壁纸替换失败 | 配额 vs Disk I/O、入口是否导入守卫、local-only 协调器、原子提交成功后再更新内存 |
| 包签名通过但版本错误 | 父 App 与 Extension 的 Info.plist、最终 zip 内 app、资源一致性、实际 arm64 架构 |
| 环境光不显示 | 设置是否开启、页面是否受支持、video 跨域导致 canvas tainted（引擎已捕获降级）、最终 app 资源 |
| 沉浸式模式空白或重复 | iframe 是否加载、`window.name` 预加载状态、`postMessage` origin、`all_frames`、控制台 CSP/跨域错误 |
| 关于页浏览器信息错误或为空 | `GET_BROWSER_INFO_MESSAGE` 是否注册、后台上下文、消息失败后的页面 UA 回退 |

手测以真实 macOS Safari 为准，至少记录准确 macOS/Safari/Xcode 版本、提交和
未测项。Vitest/mock、Linux CI、Chromium 或自动化 WebKit 都不能代替 Safari
扩展权限、DNR、后台唤醒、隔离世界和安装注册行为的验证。

发布继续遵守两阶段确认；默认 Apple Silicon、现有 Apple Development 签名，
未 notarize。构建版本与签名身份每次现场确认；不得把 codesign 成功写成已公证。
用户确认后的流程是推送 → 打包 → tag → Release → 回读资产 digest →
安装/复核最终 app → 清理。若候选已装入 Applications，复核同一候选即可。

清理必须最后做。先安全保留最终 app 并复核，再将已列明的 BewlyCat DerivedData
和本次临时解压目录移入废纸篓；不要先清掉仍作为安装源的 app。保留生成 Xcode
工程、最终 zip/校验和和 Applications 应用。通常旧 app 移入废纸篓后再替换；
本次用户明确要求仅保留一个完整应用，
因此在新候选通过签名/资源校验后删除旧应用与 DerivedData 中完整 `.app`，
不保留旧应用副本。普通 Xcode 中间缓存待发布成功后清理。

本次 `c6f24500` 已通过 lint、typecheck、knip、26 文件 / 205 项测试、build、
validator（含听视频 ESM 实际导入与三个故障反例）、现有工程资源同步、Xcode
Release arm64、严格签名与最终资源检查。唯一候选在
`/Applications/BewlyCat Safari.app`，版本 `1.8.1 (1)`、Apple Development
Team `W5J4JBH2BR`，未 notarize，已发布；22 个资源的摘要与单副本注册证据见
[本次交付记录](./compose/spec/sync-upstream-v1.8.1.md)。macOS `27.2 (26B118)`、
Safari `27.2`、Xcode `27.0 (27A5209h)`；用户已明确验收通过，确认 APP DNR
与听视频正常。发布 zip 与安装应用逐文件一致，GitHub 两个附件 digest 已回读核对。
BewlyCat DerivedData 与本次临时校验目录/日志已清理，保留已安装应用、Xcode 工程
与 `release/` 发布资产；具体清理路径见交付记录的阶段二。

后续新增 Safari 修复时，将“症状 → 根因证据 → 当前方案 → 不应恢复的旧方案 →
源码/测试 → Safari 验收结果”追加到对应条目；每次交付记录具体版本和提交。

## v1.8.2-safari.2 首页滚动修复（已发布）

Issue #1 与已关闭、未合并的 PR #2 指出自定义首页滚动桥竞争：文档驱动时
丢弃内部视口的新滚动，150ms 定时器再写入旧位置，引发滚轮卡顿和回拉。
当前 v1.8.2 基线仍有此逻辑。修复入口为 `src/contentScripts/features/scrollBridge.ts`，
唯一调用处为 `App.vue` 的自定义首页视口监听。

本地修复参考 PR #2 的原生输入优先与定时器仅释放控制权，同时修复 PR 遗留的
文档镜像过期：视口驱动时，迟到文档事件只将文档同步至当前视口；该判断先于
旧镜像标记过滤。禁止恢复定时器位置回写，或直接忽略不一致的文档位置。
保留空闲时文档快捷键兼容、1px 差异阈值与卸载清理，不扩大网站权限。

`src/tests/scrollBridge.spec.ts` 的 10 项测试覆盖滚轮/触摸接管、交错与反向滚动、
相对文档滚动、旧镜像标记、回声去重和卸载。旧实现 8 项失败，PR #2 原实现
3 项失败，最终修复 10 项通过。其中视口 1050 / 文档 1200 的交错事件后，
文档恢复 1050，空闲后相对滚动 +100 的正确结果为 1150。
模拟事件不能替代 Safari 惯性滚动实机验证；2026-10-30 用户确认三种首页布局滚动均正常，
随后已发布 v1.8.2-safari.2。感谢 GuZhengSVT 的问题报告、排查与 PR #2 修复思路。
构建与安装结果见 `docs/compose/spec/fix-safari-home-scroll.md`。

## v1.8.3 同步候选

最新本地同步记录见 [v1.8.3](./compose/spec/sync-upstream-v1.8.3.md)，尚未发布。
直播预览的 hlsPlayer/flvPlayer 与听视频一样依赖动态 import 的命名导出，必须为
自包含 ESM，不能合入 Safari 后台 IIFE 任务。validator 已覆盖导出与资源可访问性。
顶栏动态公共映射需保留 Safari 的 aid/bvid/isVideo，并包含阅读位置所需 dynId。
本次继续保留 v1.8.2-safari.2 的滚动桥修复；新版本仍需单独实机验收。
