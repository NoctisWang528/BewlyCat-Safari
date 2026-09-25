import browser from 'webextension-polyfill'

/**
 * Safari 的 browser.storage.local 在并发 set/remove 时会抛出
 * “Invalid call to browser.storage.local.set(). Disk I/O error.”。
 * 内容脚本多标签页与 background 各自写入时尤其容易触发。
 *
 * 这里对 set/remove 做两层防护：
 * 1. 同一 JS 上下文内串行写入；
 * 2. 对瞬态 Disk I/O / Invalid call 错误做有限次退避重试（覆盖跨上下文竞争）。
 */

const MAX_ATTEMPTS = 4
const RETRY_DELAYS_MS = [0, 50, 150, 300]

type StorageSet = (items: Record<string, unknown>) => Promise<void>
type StorageRemove = (keys: string | string[]) => Promise<void>

class SerialQueue {
  private tail: Promise<void> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}

const writeQueue = new SerialQueue()
let installed = false
let originalSet: StorageSet | undefined
let originalRemove: StorageRemove | undefined

function isTransientStorageError(error: unknown): boolean {
  if (!error)
    return false
  const message = error instanceof Error ? error.message : String(error)
  return /disk i\/o|invalid call to browser\.storage\.local\.(?:set|remove)/i.test(message)
}

function delay(ms: number): Promise<void> {
  if (ms <= 0)
    return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await task()
    }
    catch (error) {
      lastError = error
      if (!isTransientStorageError(error) || attempt === MAX_ATTEMPTS - 1)
        throw error
      await delay(RETRY_DELAYS_MS[attempt] ?? 300)
    }
  }
  throw lastError
}

function resolveSet(): StorageSet {
  return originalSet ?? (items => browser.storage.local.set(items))
}

function resolveRemove(): StorageRemove {
  return originalRemove ?? (keys => browser.storage.local.remove(keys))
}

/** 同一上下文内串行 + 瞬态错误重试地执行 storage.local.set */
export function enqueueStorageSet(items: Record<string, unknown>): Promise<void> {
  return writeQueue.run(() => withRetry(() => resolveSet()(items)))
}

/** 同一上下文内串行 + 瞬态错误重试地执行 storage.local.remove */
export function enqueueStorageRemove(keys: string | string[]): Promise<void> {
  return writeQueue.run(() => withRetry(() => resolveRemove()(keys)))
}

/**
 * 将 browser.storage.local.set/remove 包装为串行+重试。
 * 在 content 与 background 入口各安装一次，覆盖未走队列的调用点。
 */
export function installStorageWriteGuard(): void {
  if (installed)
    return

  const local = browser.storage.local as {
    set: StorageSet
    remove: StorageRemove
  }
  // 仅在尚未包装时捕获原始实现，避免二次安装把包装函数当原件
  if (!originalSet)
    originalSet = local.set.bind(local)
  if (!originalRemove)
    originalRemove = local.remove.bind(local)

  local.set = items => enqueueStorageSet(items)
  local.remove = keys => enqueueStorageRemove(keys)
  installed = true
}

// 模块加载即安装，确保 content/background 在任何写入前完成包装
installStorageWriteGuard()
