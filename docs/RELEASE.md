# macOS Safari Release Checklist

Use this checklist for a GitHub Release of the macOS Safari host app.

## Maintainer checklist

- [ ] Set the intended version in `package.json` and in both Xcode targets.
- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm knip`.
- [ ] Run `pnpm package-safari`.
- [ ] Configure the Release signing team and bundle identifiers in Xcode.
- [ ] Archive/export the macOS host app and test its embedded Safari extension.
- [ ] If notarizing, submit the signed app, wait for acceptance, staple the
      ticket, and verify the final app before packaging.
- [ ] Run `pnpm release:macos -- vX.Y.Z "/path/to/BewlyCat Safari.app"`.
- [ ] Verify the generated zip digest against `release/SHA256SUMS.txt`.
- [ ] Test installation from the generated zip on a clean macOS user or machine.
- [ ] Create and push the matching `vX.Y.Z` tag.
- [ ] Create the GitHub Release and upload the zip and `SHA256SUMS.txt`.
- [ ] Record the exact signing and notarization status in the notes.

Do not store certificates, private keys, Apple account passwords, app-specific
passwords, or notarytool keychain profiles in this repository.

## GitHub Release notes template

```markdown
# BewlyCat Safari vX.Y.Z

## 系统要求

- macOS：待填写
- Safari：待填写
- 架构：Apple silicon / Intel / Universal（按实际产物填写）

## 安装

1. 下载 `BewlyCat-Safari-vX.Y.Z-macOS.zip` 和 `SHA256SUMS.txt`。
2. 校验 SHA-256 后解压，将 `.app` 移入“应用程序”并打开。
3. 在 Safari → 设置 → 扩展中启用 BewlyCat。
4. 授予 Bilibili 相关域名的网站访问权限。

这不是 Chrome/Edge/Firefox 的 `extension.zip`，不能拖入浏览器安装。

## 更新内容

- 待填写

## 已知问题

- 待填写；如无则写“暂无已知问题”。

## 签名与 notarization 状态

- Developer ID 签名：是 / 否
- Apple notarization：是 / 否

未签名或未 notarize 的构建可能被 macOS Gatekeeper 阻止或警告。

## SHA-256

以本 Release 附件 `SHA256SUMS.txt` 为准：

`待粘贴校验值  BewlyCat-Safari-vX.Y.Z-macOS.zip`
```
