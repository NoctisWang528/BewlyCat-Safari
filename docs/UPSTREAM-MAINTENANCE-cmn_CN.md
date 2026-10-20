# BewlyCat Safari 上游同步与维护手册

本文供仓库维护者和后续 Agent 使用，说明上游代码更新后，本仓库会发生什么，
以及如何安全地更新、构建、验证、验收和发布 Safari 版本。

本仓库只维护 macOS Safari 版本。Chrome、Edge 和 Firefox 由上游
[`keleus/BewlyCat`](https://github.com/keleus/BewlyCat) 维护，不应从本仓库构建或发布。

新会话先读 [AGENTS.md](../AGENTS.md) 与
[Safari 适配与历史踩坑交接](./SAFARI-HANDOFF-cmn_CN.md)。后者提供每项适配的
源码、测试和历史证据；本文负责执行流程。文档中的版本示例不代替当前 Git 状态。

## 快速结论

- 上游更新仅由维护者在正式 Release 节点手动合并，不配置自动合并工作流。
- 一次上游同步采用**两阶段交付**：阶段一本地构建交验收，阶段二在用户明确
  确认后才推送、打 tag、创建 GitHub Release，并清理 Xcode 临时文件、把
  `.app` 安装到 `/Applications`。
- 只合并上游正式 tag，不合并 `upstream/main` 上尚未发布的提交。
- CI 只能构建和验证 Safari WebExtension，不能运行真实 Safari 或 Xcode。
- 日常源码更新应使用 `pnpm sync-safari-xcode` 刷新现有 Xcode 工程。
- 不要为普通源码更新运行 `pnpm package-safari`；上游版本同步、首次建工程
  或包装器结构变化时才重新生成 Xcode 工程。
- Xcode 编译、签名、Safari 实机验收、GitHub 推送与 Release 需要按阶段执行；
  当前不做 Developer ID 签名与 Apple notarization。

## 端到端工作流（上游版本同步）

以下是维护者实际使用的完整流水线。收到“上游更新了 vX.Y.Z，请同步并构建
Safari 版本”类任务时按此执行。

```text
阶段一（本地交付，禁止推送/tag/Release）
  读环境与上游正式 Release
    → 建分支 codex/sync-upstream-vX.Y.Z
    → --no-ff 合并正式 tag vX.Y.Z
    → 逐文件解决冲突，保留 Safari 适配
    → 提交 chore: merge upstream vX.Y.Z
    → 提交 fix(safari): adapt upstream vX.Y.Z
    → 冻结安装 + 全量校验
    → package-safari + Xcode Release/arm64 签名构建
    → codesign 深度校验 + 资源三方一致性
    → 交付 .app 路径与验收清单
    → 停止，等待用户验收

用户明确确认（例如「验收通过，可以发布」）
    ↓
阶段二（发布与清理）
  复核工作树/候选提交/tag/Release 不存在
    → 快进 main 并推送 origin/main
    → pnpm release:macos 生成 zip + SHA256SUMS.txt
    → 解压复检，撰写 Release notes
    → 创建并推送注释 tag vX.Y.Z-safari.N
    → gh release create 上传资产并回读 digest
    → 将 .app 安装到 /Applications（旧版移入废纸篓）
    → 最终复核版本 / 架构 / 签名 / 资源一致性
    → 清理 BewlyCat Xcode DerivedData 与临时校验目录（移入废纸篓）
```

### 版本号约定

以同步上游 `v1.8.1`、首次 Safari 修订为例：

| 位置 | 值 |
| --- | --- |
| 发布 tag / Release | `v1.8.1-safari.1` |
| `package.json#version` | `1.8.1` |
| `package.json#safariRevision` | `1` |
| 生成 manifest `version` | `1.8.1.1` |
| Xcode `MARKETING_VERSION` | `1.8.1` |
| Xcode `CURRENT_PROJECT_VERSION` | `1` |
| 版本提醒文案 / 链接 | `v1.8.1-safari.1`，指向本仓库 Release |

同上游基线的第二次及以后 Safari 修订：递增 `safariRevision` 与
`CURRENT_PROJECT_VERSION`，manifest 变为 `1.8.1.2`，tag 变为 `v1.8.1-safari.2`。

### 提交历史约定

一次上游版本同步在 `codex/sync-upstream-vX.Y.Z` 上保持清晰：

1. `chore: 合并上游 vX.Y.Z` —— 仅合并正式 tag 的 `--no-ff` merge commit
2. `fix(safari): 适配上游 vX.Y.Z` —— Safari 兼容、版本号、测试与发布准备
3. 如有独立文档更新，可用 `docs: ...` 单独提交

生成的 `extension-safari/`、`extension-safari-macos/`、DerivedData 和 release
资产不纳入 Git。

### 阶段一详细步骤

```bash
cd /Users/baixu/Documents/BewlyCat-Safari

# 1. 环境与基线（只读）
git status --short
git branch --show-current
git fetch origin --prune --tags
git fetch upstream --prune --tags
gh api repos/keleus/BewlyCat/releases/tags/vX.Y.Z \
  --jq '{tag_name,target_commitish,draft,prerelease,published_at,name}'
git rev-parse "vX.Y.Z^{}"
git log --oneline "vX.Y.Z..upstream/main"   # 未发布提交，本次不合并

# 2. 建分支并合并正式 tag
git switch -c codex/sync-upstream-vX.Y.Z origin/main
git merge --no-ff "vX.Y.Z^{}" -m "chore: merge upstream vX.Y.Z"
# 解决冲突：保留 Safari DNR / 非持久后台 / MAIN-world bridge / 认证兼容层 /
# 仓库品牌；不要整份选 ours 或 theirs

# 3. Safari 适配与版本号（完成后单独提交）
# fix(safari): adapt upstream vX.Y.Z

# 4. 依赖与全量校验（Node LTS，pnpm@10.21.0）
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm knip
pnpm test
pnpm build
pnpm validate-safari
# 检查 extension-safari/manifest.json

# 5. 重新生成 Xcode 工程并构建（上游版本同步场景）
pnpm package-safari
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  xcodebuild \
    -project 'extension-safari-macos/BewlyCat Safari/BewlyCat Safari.xcodeproj' \
    -scheme 'BewlyCat Safari' \
    -configuration Release \
    -destination 'platform=macOS,arch=arm64' \
    -derivedDataPath "$HOME/Library/Developer/Xcode/DerivedData/BewlyCat_Safari-vX.Y.Z" \
    DEVELOPMENT_TEAM=W5J4JBH2BR \
    CODE_SIGN_STYLE=Automatic \
    MARKETING_VERSION=X.Y.Z CURRENT_PROJECT_VERSION=N \
    ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
    build

# 6. 签名与资源一致性
APP="$HOME/Library/Developer/Xcode/DerivedData/BewlyCat_Safari-vX.Y.Z/Build/Products/Release/BewlyCat Safari.app"
codesign --verify --deep --strict --verbose=2 "$APP"
BEWLYCAT_APP_PATH="$APP" pnpm check-safari-xcode-sync
```

完成后向用户报告：

- 分支、merge commit、Safari 适配 commit
- 校验结果（命令与通过项）
- `.app` 绝对路径
- 验收清单（见下文）
- **明确尚未推送、打 tag、创建 Release**

### 用户验收清单

请用户在 Safari 中手动验证：

- 登录 / 未登录
- 首页、动态、搜索与搜索历史
- 视频播放、清晰度/音量相关新功能
- 收藏（新旧布局）、稍后再看、合集切集
- 历史记录、通知、设置持久化
- 评论区（含深色模式）
- 会话恢复、后台标签页、iframe drawer
- DNR / 认证请求、控制台无新增错误

验收期间发现问题：在同一分支修复 → 重跑全量校验 → 重新构建 `.app` →
再次交验收。**不推送、不打 tag、不创建 Release。**

### 阶段二详细步骤（仅在用户明确确认后）

```bash
cd /Users/baixu/Documents/BewlyCat-Safari

# 1. 发布前复核
git status --short --branch
git fetch origin --prune --tags
# 确认 origin/main 仍是建候选分支时的基线，且可快进到已验收提交；工作树干净；tag/Release 尚不存在

# 2. 快进 main 并推送
git switch main
git merge --ff-only codex/sync-upstream-vX.Y.Z
git push origin main

# 3. 生成发布资产（以最终安装或交付的 .app 为准）
pnpm release:macos -- vX.Y.Z-safari.N "/absolute/path/to/BewlyCat Safari.app"

# 4. 解压复检 zip 内 .app 的签名、版本、架构

# 5. 注释 tag
git tag -a vX.Y.Z-safari.N <head-sha> -m "vX.Y.Z-safari.N"
git push origin vX.Y.Z-safari.N

# 6. GitHub Release
gh release create vX.Y.Z-safari.N \
  release/BewlyCat-Safari-vX.Y.Z-safari.N-macOS.zip \
  release/SHA256SUMS.txt \
  --repo NoctisWang528/BewlyCat-Safari \
  --title "vX.Y.Z-safari.N" \
  --notes-file release/RELEASE_NOTES-vX.Y.Z-safari.N.md \
  --verify-tag

# 7. 回读核对 tag 指向、资产名/大小/digest 与本地一致

# 8. 安装到 Applications（候选已安装时复核同一 app 即可）
#    旧版 mv 到废纸篓（命名 BewlyCat Safari-vOLD-before-vNEW.app）
#    ditto 新 .app → /Applications/BewlyCat Safari.app
#    再跑 codesign + check-safari-xcode-sync + PlistBuddy 版本 + lipo 架构

# 9. 最终只读复核 Git 状态、Release 资产、/Applications 应用

# 10. 安装与复核通过后，清理 Xcode 临时文件（移入废纸篓，可恢复）
#     先列出并确认具体目标：BewlyCat* DerivedData 与本次临时校验目录
#     保留：extension-safari-macos/、release/ 资产、/Applications 中的 .app
#     不得先删除仍作为安装源的 DerivedData app
```

Release notes 必须写明：

- 上游 `vX.Y.Z` 功能摘要与 Safari 适配点
- 产物为 Apple Silicon（arm64）
- Apple Development 签名，**未 notarize**
- SHA-256（以附件 `SHA256SUMS.txt` 为准）

## 固定环境

在仓库根目录工作：

```bash
cd /Users/baixu/Documents/BewlyCat-Safari
```

工具链要求：

- Node.js LTS（与 `.github/workflows/ci.yml` 的 `lts/*` 一致；本机可用
  Homebrew `node@24` 显式 PATH，避免误用过新主版本）；
- `pnpm@10.21.0`（本仓库固定；即使上游改了 `packageManager` 字段也不升级）；
- 使用 `pnpm install --frozen-lockfile` 安装依赖；
- Xcode 27 Beta 位于 `/Applications/Xcode-beta.app`；
- Apple Development 签名身份与 Team `W5J4JBH2BR` 已配置；
- 不切换包管理器，不无故改写 `pnpm-lock.yaml`。

开始操作前始终检查：

```bash
git status --short
git branch --show-current
node --version
pnpm --version
```

如果工作树存在未提交修改，先确认其归属。不要覆盖、还原或提交不属于当前任务的修改。

## 手动同步上游 Release（命令速记）

只在确认需要跟进的上游正式 Release 后同步。不要自动跟踪 `upstream/main`。

```bash
cd /Users/baixu/Documents/BewlyCat-Safari
git status --short
git fetch origin --prune --tags
git remote get-url upstream >/dev/null 2>&1 \
  || git remote add upstream https://github.com/keleus/BewlyCat.git
git fetch upstream --prune --tags
git switch -c codex/sync-upstream-vX.Y.Z origin/main
git merge --no-ff "vX.Y.Z^{}" -m "chore: merge upstream vX.Y.Z"
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm knip
pnpm test
pnpm build
pnpm validate-safari
```

说明：

- 合并上游对应 Release tag，不合并 Release 之后尚未发布的提交；
- 冲突必须人工理解并解决，不要直接选择整份 `ours` 或 `theirs`；
- 验证通过后再同步 Xcode、构建签名 `.app` 并交用户验收；
- 如果无法安全解决，可在 merge 尚未提交时执行 `git merge --abort`。

## 刷新现有 Xcode 工程

日常更新使用：

```bash
pnpm sync-safari-xcode
```

该命令会：

1. 运行 Safari production build；
2. 运行 Safari bundle validator；
3. 将以下构建产物同步到现有 Xcode Extension Resources：
   - `dist/`
   - `assets/`
   - `manifest.json`
4. 保留 Xcode 工程中的 Team、bundle identifier 和签名配置；
5. 逐文件计算 SHA-256，并在内容不一致时失败。

该命令不会：

- 编译 macOS 父 App；
- 对 App 或 `.appex` 签名；
- 启动 App；
- 让已经运行的 Safari 页面自动加载新 bundle。

同步后在 Xcode 中执行：

1. 打开 `extension-safari-macos/BewlyCat Safari/BewlyCat Safari.xcodeproj`；
2. 确认父 App 和 Extension target 的 Team 与 bundle identifier；
3. Clean Build；
4. Build & Run 父 App；
5. 在 Safari 中确认扩展已启用并刷新 Bilibili 页面。

随后检查三处资源是否完全一致：

```bash
pnpm check-safari-xcode-sync
```

检查范围：

```text
extension-safari/
      =
extension-safari-macos/.../Extension/Resources/
      =
最终 BewlyCat Safari.app 内嵌的 .appex/Resources/
```

如果检查非默认位置的 App：

```bash
BEWLYCAT_APP_PATH="/absolute/path/to/BewlyCat Safari.app" \
  pnpm check-safari-xcode-sync
```

## 什么时候运行 package-safari

以下情况可以运行：

```bash
pnpm package-safari
```

- 第一次创建 Xcode 工程；
- `extension-safari-macos/` 不存在或已损坏；
- Safari 原生包装器结构需要重新生成；
- packager 或 Xcode 工程结构发生了明确变化；
- **上游版本同步需要以新版本号重建发布用 `.app` 时**。

普通 TypeScript、Vue、CSS、manifest 或 WebExtension 资源更新不需要重新生成工程。

注意：`pnpm package-safari` 会删除旧的 `extension-safari-macos/` 并重新生成，因此可能覆盖：

- Development Team；
- 自定义 bundle identifier；
- Signing 配置；
- Xcode 中人工调整的工程设置。

运行前应记录这些配置。生成后需要重新检查父 App 和 Extension target，并在
构建时显式传入：

```text
MARKETING_VERSION=X.Y.Z
CURRENT_PROJECT_VERSION=N
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer
DEVELOPMENT_TEAM=W5J4JBH2BR
CODE_SIGN_STYLE=Automatic
ARCHS=arm64 ONLY_ACTIVE_ARCH=YES
```

## 人工解决上游冲突

推荐在独立分支中处理：

```bash
git status --short
git fetch origin --prune --tags
git remote get-url upstream >/dev/null 2>&1 \
  || git remote add upstream https://github.com/keleus/BewlyCat.git
git fetch upstream --prune --tags
git switch -c codex/sync-upstream-vX.Y.Z origin/main
git merge --no-ff "vX.Y.Z^{}" -m "chore: merge upstream vX.Y.Z"
```

发生冲突后：

1. 列出冲突：

   ```bash
   git diff --name-only --diff-filter=U
   ```

2. 对每个文件同时理解：
   - 上游新增或修改了什么；
   - Safari 分支为什么与上游不同；
   - 是否涉及 manifest、后台生命周期、MAIN-world 注入、DNR 或 API 请求。
3. 不要简单选择整份 `ours` 或 `theirs`。
4. 不构建 Chrome 或 Firefox 版本。
5. 解决后运行完整 Safari 验证：

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm typecheck
   pnpm knip
   pnpm test
   pnpm build
   pnpm validate-safari
   ```

6. 在 macOS 上同步 Xcode、重新构建签名 `.app` 并完成 Safari 手测。
7. 审查 merge diff 后再提交和推送。

如果合并方向错误或无法安全解决，可在尚未提交 merge 时使用：

```bash
git merge --abort
```

## 上游更新后的重点审查区域

上游合并后优先检查：

- `src/manifest.ts`：Safari 权限、background、DNR、web accessible resources；
- `src/inject/`：页面 MAIN-world 脚本及 `window.postMessage` 桥
  （含新增 audio / player 相关 page-world 代码）；
- `src/contentScripts/`：Safari 注入方式和初始化顺序；
- `src/background/`：MV3 非持久后台生命周期、storage 协调器、token 刷新、
  `appClient.ts` 固定 APP 接口与 DNR 请求头规则；
- `src/utils/api.ts` 及请求组装：Cookie、CSRF、Origin、Referer；
- `src/logic/storage.ts`：新设置项与旧用户存储合并；
- `assets/rules.json`：Safari DNR resource type 和请求头修改；
- `vite.config*.ts`、`tsup.config.ts`、`scripts/`：Safari 构建输出；
- `src/_locales/`：用户可见文本是否同步更新四个 locale；
- `package.json#packageManager`：保持本仓库 `pnpm@10.21.0`；
- 依赖升级是否改变 Node、Vue、Vite、WebExtension 或 Safari 行为。

上游保留的 Chromium/Firefox 分支代码可以继续存在以减少冲突，但不得加入本仓库的 CI 或发布流程。

## CI 已覆盖的内容

推送到 `main`、`dev` 或针对这些分支的 PR 会在 Linux 上执行：

- 冻结锁文件安装；
- ESLint；
- TypeScript/Vue typecheck；
- knip；
- Vitest；
- Safari WebExtension production build；
- Safari bundle validator。

CI 证明源码可以通过自动检查和生成 Safari WebExtension，但不证明扩展能在真实 Safari 中正常运行。

## 必须人工验证的内容

每次重要上游同步至少检查：

- Safari 设置中扩展能安装、启用并获得网站权限；
- 登录和未登录状态；
- 首页、动态栏、搜索和视频播放；
- 上游新功能（本次例如：收藏夹整理、动态评论与富文本转发、常驻分区、
  听视频模式、自定义播放倍速、视频分区标签）；
- 稍后再看添加与移除；
- 历史记录、通知和设置持久化；
- 后台标签页打开；
- iframe drawer；
- MAIN-world READY/FAILED handshake；
- 后台页终止后的 token 刷新；
- DNR 对 API POST 与 APP 固定接口请求的请求头处理；Safari 的 APP 会话规则
  不含 `tabIds`，需确认页面自身请求未被意外改写；
- Safari 页面控制台和扩展后台控制台无新增错误。

记录：

- macOS 版本；
- Safari 版本；
- Xcode 版本；
- 测试使用的提交 SHA；
- 已知限制和未测试项目。

## 发布 Safari App

发布前：

1. 将 `package.json#version` 设为上游基线，并递增 `safariRevision`；
2. 将父 App 和 Extension target 的 `MARKETING_VERSION` 设为上游基线，并递增 `CURRENT_PROJECT_VERSION`；
3. 完成完整 CI 命令；
4. 构建并验证 Safari WebExtension；
5. 重新生成或同步 Xcode Resources；
6. 构建签名 arm64 `.app` 并完成用户验收；
7. 对最终 App 执行资源一致性检查；
8. （如正式公开发布且具备条件）完成 Developer ID 签名和 Apple notarization；
9. 在干净 macOS 用户或机器上测试。

生成发布压缩包：

```bash
pnpm release:macos -- vX.Y.Z-safari.N "/absolute/path/to/BewlyCat Safari.app"
```

该脚本会：

- 重新构建并验证 Safari WebExtension；
- 检查传入的 `.app`；
- 生成 macOS zip；
- 生成 `SHA256SUMS.txt`；
- 进行基础 `codesign --verify`。

该脚本不会：

- 编译 Xcode App；
- 配置证书；
- 完成 Apple notarization；
- 创建或推送 tag；
- 创建 GitHub Release；
- 上传 Release 附件。

tag、Release 与资产上传按「阶段二」执行；失败时不要清理 DerivedData，
以便用同一构建产物重试。

## 安装到 Applications

用户确认后的最终安装（或阶段一交验收前的候选安装）使用可恢复替换：

```bash
mv "/Applications/BewlyCat Safari.app" \
  "$HOME/.Trash/BewlyCat Safari-vOLD-before-vNEW.app"
ditto "/absolute/path/to/BewlyCat Safari.app" \
  "/Applications/BewlyCat Safari.app"
codesign --verify --deep --strict --verbose=2 "/Applications/BewlyCat Safari.app"
BEWLYCAT_APP_PATH="/Applications/BewlyCat Safari.app" pnpm check-safari-xcode-sync
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  "/Applications/BewlyCat Safari.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' \
  "/Applications/BewlyCat Safari.app/Contents/Info.plist"
lipo -archs "/Applications/BewlyCat Safari.app/Contents/MacOS/BewlyCat Safari"
```

旧版移入废纸篓以便回滚，不要直接 `rm`。

## 清理 Xcode 临时文件

**仅在 GitHub Release 成功且最终应用复核通过后**清理：

```bash
find "$HOME/Library/Developer/Xcode/DerivedData" -maxdepth 1 -type d -name 'BewlyCat*' -print
```

- 将匹配的 BewlyCat DerivedData 目录移入废纸篓（保留可恢复命名，
  如 `BewlyCat_Safari-v181-post-v1.8.1-release`）；
- 清理 `/tmp/BewlyCat-*` 校验解压目录；
- **保留**：`extension-safari-macos/`、`release/` 下的 zip 与 `SHA256SUMS.txt`、
  `/Applications/BewlyCat Safari.app`。

未发布成功前不要清理 DerivedData。

## 给后续 Agent 的执行清单

收到“同步上游并更新 Safari”任务时，Agent 应：

1. 阅读根目录 `AGENTS.md`、Safari 交接文档和本文；
2. 检查 `git status`、当前分支、Node 与 pnpm 版本；
3. 保留所有已有未提交修改；
4. 确认上游正式 Release tag，并排除 `upstream/main` 未发布提交；
5. 在 `codex/sync-upstream-vX.Y.Z` 分支处理合并，不直接改 `main`；
6. 保留 Safari 专用兼容逻辑，不启用 Chrome/Firefox 构建；
7. 保持 `packageManager` 为 `pnpm@10.21.0`；
8. 修改用户可见文本时同步四个 locale；
9. 运行完整 CI；
10. 上游版本同步时 `pnpm package-safari` 并以显式版本/签名参数构建 arm64 `.app`；
11. 执行 `codesign --verify --deep --strict` 与 `pnpm check-safari-xcode-sync`；
12. 交付 `.app` 路径与验收清单后**停止**；
13. 明确报告哪些真实 Safari 流程已测试、哪些需要维护者手测；
14. 未经用户明确确认，不提交到 `main`、不推送、不打 tag、不创建 Release；
15. 用户确认后按阶段二执行：推送 → 打包 → tag → Release → 安装到
    `/Applications` → 最终复核 → 清理 DerivedData；候选已安装时复核同一 app 即可。

禁止事项：

- 不使用 `git reset --hard` 或 `git checkout --` 丢弃现有修改；
- 不编辑 `extension-safari/` 中的生成 bundle 实现源码修复；
- 不提交 `extension-safari/`、`extension-safari-macos/`、依赖目录或签名材料；
- 不扩大 host permissions 而不说明原因；
- 不记录 Cookie、CSRF、access token、refresh token 或完整认证请求头；
- 不将 Linux CI 通过描述成“Safari 实机验证通过”；
- 不在用户验收前推送、打 tag 或创建 Release；
- 不在 Release 成功前清理 DerivedData；
- 不把未公证构建描述成已 notarize。

## 常用命令速查

```bash
# 查看状态
git status --short
git log --oneline --decorate -10

# 更新本地 main
git pull --ff-only origin main
pnpm install --frozen-lockfile

# 完整源码检查
pnpm lint
pnpm typecheck
pnpm knip
pnpm test
pnpm build
pnpm validate-safari

# 更新现有 Xcode 工程
pnpm sync-safari-xcode

# Xcode build 后检查三处 bundle
pnpm check-safari-xcode-sync

# 首次或上游版本同步时重新生成 Xcode 工程
pnpm package-safari

# 打包已构建的最终 App
pnpm release:macos -- vX.Y.Z-safari.N "/absolute/path/to/BewlyCat Safari.app"
```
