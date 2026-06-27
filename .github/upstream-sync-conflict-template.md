---
title: "sync: upstream rebase conflict"
labels: upstream-sync
---

The automated upstream sync encountered a rebase conflict.

## Manual steps

```bash
git remote add upstream https://github.com/keleus/BewlyCat.git || true
git fetch upstream
git checkout main
git rebase upstream/main

# Resolve conflicts, then:
git add .
git rebase --continue
git push --force-with-lease origin main
```

After resolving, run validation:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build-safari && pnpm validate-safari
```
