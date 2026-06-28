# BewlyCat Safari 上游同步与维护手册

本文供仓库维护者和后续 Agent 使用，说明上游代码更新后，本仓库会发生什么，
以及如何安全地更新、构建、验证和发布 Safari 版本。

本仓库只维护 macOS Safari 版本。Chrome、Edge 和 Firefox 由上游
[`keleus/BewlyCat`](https://github.com/keleus/BewlyCat) 维护，不应从本仓库构建或发布。

## 快速结论

- GitHub Actions 每周检查并合并上游更新。
- 自动同步只更新 GitHub 上的 `origin/main`，不会更新维护者的本地仓库。
- CI 只能构建和验证 Safari WebExtension，不能运行真实 Safari 或 Xcode。
- 日常源码更新应使用 `pnpm sync-safari-xcode` 刷新现有 Xcode 工程。
- 不要为普通源码更新运行 `pnpm package-safari`，它会重新生成整个 Xcode 工程。
- Xcode 编译、签名、运行、Safari 登录态测试、Apple 公证和 GitHub Release 仍需人工完成。

## 固定环境

在仓库根目录工作：

```bash
cd /Users/baixu/Documents/BewlyCat-Safari
```

工具链要求：

- Node.js LTS，与 `.github/workflows/ci.yml` 一致；
- `pnpm@10.21.0`；
- 使用 `pnpm install --frozen-lockfile` 安装依赖；
- Xcode 27 Beta 位于 `/Applications/Xcode-beta.app`；
- 不切换包管理器，不无故改写 `pnpm-lock.yaml`。

开始操作前始终检查：

```bash
git status --short
git branch --show-current
node --version
pnpm --version
```

如果工作树存在未提交修改，先确认其归属。不要覆盖、还原或提交不属于当前任务的修改。

## 自动上游同步会做什么

工作流位于 `.github/workflows/upstream-sync.yml`。

触发方式：

- 每周一 UTC 03:00，即北京时间周一 11:00；
- 在 GitHub Actions 页面手动触发 `Upstream Sync`。

工作流执行以下操作：

1. 获取 `origin/main` 和 `keleus/BewlyCat` 的 `upstream/main`。
2. 检查 `upstream/main` 是否已经包含在 `origin/main` 历史中。
3. 如有新提交，从当前 `origin/main` 创建临时分支。
4. 使用非 fast-forward merge 合并 `upstream/main`。
5. 安装锁定依赖。
6. 运行 Safari CI：

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm knip
   pnpm test
   pnpm build
   pnpm validate-safari
   ```

7. 再次确认同步期间 `origin/main` 没有被其他提交改变。
8. 全部通过后，将临时分支直接推送到 `origin/main`。

工作流不会：

- 向 `keleus/BewlyCat` 推送；
- 自动修改维护者 Mac 上的本地仓库；
- 自动生成或编译 Xcode App；
- 自动安装或重启 Safari 扩展；
- 自动进行真实 Bilibili 账号测试；
- 自动创建 macOS Release。

## 自动同步的失败行为

以下任一情况发生时，`origin/main` 不会被同步工作流修改：

- 合并冲突；
- 依赖安装失败；
- lint、typecheck、knip 或测试失败；
- Safari WebExtension 构建或验证失败；
- 同步期间 `origin/main` 被其他提交更新。

发生合并冲突时，工作流会中止 merge，并在 GitHub Actions 的 step summary 中列出冲突文件。
需要人工创建分支解决，禁止使用 `git reset --hard` 或直接丢弃 Safari 兼容代码。

## 上游同步成功后的本地更新

确认 GitHub Actions 中的 `Upstream Sync` 成功后执行：

```bash
cd /Users/baixu/Documents/BewlyCat-Safari
git status --short
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm sync-safari-xcode
```

说明：

- `git pull --ff-only` 防止在不知情的情况下产生本地 merge commit；
- 如果该命令失败，停止操作并检查本地提交与 `origin/main` 的分叉，不要强制重置；
- 即使 `package.json` 看起来没有变化，也建议在上游同步后执行一次锁定依赖安装；
- `pnpm sync-safari-xcode` 会构建、验证并刷新现有 Xcode 工程中的 WebExtension 资源。

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
- packager 或 Xcode 工程结构发生了明确变化。

普通 TypeScript、Vue、CSS、manifest 或 WebExtension 资源更新不需要重新生成工程。

注意：`pnpm package-safari` 会删除旧的 `extension-safari-macos/` 并重新生成，因此可能覆盖：

- Development Team；
- 自定义 bundle identifier；
- Signing 配置；
- Xcode 中人工调整的工程设置。

运行前应记录这些配置。生成后需要重新检查父 App 和 Extension target。

## 人工解决上游冲突

推荐在独立分支中处理：

```bash
git status --short
git fetch origin
git remote get-url upstream >/dev/null 2>&1 \
  || git remote add upstream https://github.com/keleus/BewlyCat.git
git fetch upstream
git switch -c fix/upstream-sync-YYYYMMDD origin/main
git merge --no-ff upstream/main
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

6. 在 macOS 上同步 Xcode、重新构建并完成 Safari 手测。
7. 审查 merge diff 后再提交和推送。

如果合并方向错误或无法安全解决，可在尚未提交 merge 时使用：

```bash
git merge --abort
```

## 上游更新后的重点审查区域

上游合并后优先检查：

- `src/manifest.ts`：Safari 权限、background、DNR、web accessible resources；
- `src/inject/`：页面 MAIN-world 脚本及 `window.postMessage` 桥；
- `src/contentScripts/`：Safari 注入方式和初始化顺序；
- `src/background/`：MV3 非持久后台生命周期；
- `src/utils/api.ts` 及请求组装：Cookie、CSRF、Origin、Referer；
- `assets/rules.json`：Safari DNR resource type 和请求头修改；
- `vite.config*.ts`、`tsup.config.ts`、`scripts/`：Safari 构建输出；
- `src/_locales/`：用户可见文本是否同步更新四个 locale；
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
- 稍后再看添加与移除；
- 历史记录、通知和设置持久化；
- 后台标签页打开；
- iframe drawer；
- MAIN-world READY/FAILED handshake；
- 后台页终止后的 token 刷新；
- DNR 对 API POST 请求的请求头处理；
- Safari 页面控制台和扩展后台控制台无新增错误。

记录：

- macOS 版本；
- Safari 版本；
- Xcode 版本；
- 测试使用的提交 SHA；
- 已知限制和未测试项目。

## 发布 Safari App

发布前：

1. 更新 `package.json` 版本；
2. 同步父 App 和 Extension target 的 Xcode 版本；
3. 完成完整 CI 命令；
4. 构建并验证 Safari WebExtension；
5. 同步 Xcode Resources；
6. 在 Xcode 中 Archive/Export；
7. 对最终 App 执行资源一致性检查；
8. 完成 Developer ID 签名和 Apple notarization（如正式公开发布）；
9. 在干净 macOS 用户或机器上测试。

生成发布压缩包：

```bash
pnpm release:macos -- vX.Y.Z "/absolute/path/to/BewlyCat Safari.app"
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

这些步骤必须人工完成。

## 给后续 Agent 的执行清单

收到“同步上游并更新 Safari”任务时，Agent 应：

1. 阅读根目录 `AGENTS.md` 和本文；
2. 检查 `git status`、当前分支、Node 与 pnpm 版本；
3. 保留所有已有未提交修改；
4. 获取并审查 `origin/main` 与 `upstream/main` 的差异；
5. 在独立分支处理冲突，不直接破坏 `main`；
6. 保留 Safari 专用兼容逻辑，不启用 Chrome/Firefox 构建；
7. 修改用户可见文本时同步四个 locale；
8. 运行完整 CI；
9. 使用 `pnpm sync-safari-xcode`，不要为普通更新重新生成工程；
10. 在 Xcode clean build 后运行 `pnpm check-safari-xcode-sync`；
11. 明确报告哪些真实 Safari 流程已测试、哪些需要维护者手测；
12. 未经明确要求，不提交、不推送、不创建 tag 或 Release。

禁止事项：

- 不使用 `git reset --hard` 或 `git checkout --` 丢弃现有修改；
- 不编辑 `extension-safari/` 中的生成 bundle 实现源码修复；
- 不提交 `extension-safari/`、`extension-safari-macos/`、依赖目录或签名材料；
- 不扩大 host permissions 而不说明原因；
- 不记录 Cookie、CSRF、access token、refresh token 或完整认证请求头；
- 不将 Linux CI 通过描述成“Safari 实机验证通过”。

## 常用命令速查

```bash
# 查看状态
git status --short
git log --oneline --decorate -10

# 获取 GitHub 上已自动合并的更新
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

# 首次或明确需要时重新生成 Xcode 工程
pnpm package-safari

# 打包已构建的最终 App
pnpm release:macos -- vX.Y.Z "/absolute/path/to/BewlyCat Safari.app"
```

