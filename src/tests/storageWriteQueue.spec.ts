import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        set: mocks.set,
        remove: mocks.remove,
      },
    },
  },
}))

async function loadGuard() {
  vi.resetModules()
  const mod = await import('~/utils/storageWriteQueue')
  return mod
}

describe('storageWriteQueue', () => {
  beforeEach(() => {
    mocks.set.mockReset()
    mocks.remove.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('serializes concurrent set calls in one context', async () => {
    const order: string[] = []
    let releaseFirst!: () => void
    mocks.set.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseFirst = () => {
        order.push('first-done')
        resolve()
      }
    }))
    mocks.set.mockImplementationOnce(async () => {
      order.push('second-done')
    })

    await loadGuard()
    const { enqueueStorageSet } = await import('~/utils/storageWriteQueue')

    const first = enqueueStorageSet({ a: 1 }).then(() => order.push('first-returned'))
    const second = enqueueStorageSet({ b: 2 }).then(() => order.push('second-returned'))

    await Promise.resolve()
    expect(mocks.set).toHaveBeenCalledTimes(1)

    releaseFirst()
    await Promise.all([first, second])

    expect(mocks.set).toHaveBeenCalledTimes(2)
    expect(order).toEqual(['first-done', 'first-returned', 'second-done', 'second-returned'])
  })

  it('retries transient Safari Disk I/O errors', async () => {
    mocks.set
      .mockRejectedValueOnce(new Error('Invalid call to browser.storage.local.set(). Disk I/O error.'))
      .mockResolvedValueOnce(undefined)

    await loadGuard()
    const { enqueueStorageSet } = await import('~/utils/storageWriteQueue')

    await enqueueStorageSet({ key: 'value' })

    expect(mocks.set).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-transient errors', async () => {
    mocks.set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))

    await loadGuard()
    const { enqueueStorageSet } = await import('~/utils/storageWriteQueue')

    await expect(enqueueStorageSet({ key: 'value' })).rejects.toThrow('QUOTA_BYTES')
    expect(mocks.set).toHaveBeenCalledTimes(1)
  })

  it('installs the guard so patched set is used by callers', async () => {
    mocks.set.mockResolvedValue(undefined)
    const mod = await loadGuard()
    expect(typeof (mod as any)).toBe('object')

    const browser = (await import('webextension-polyfill')).default
    await browser.storage.local.set({ patched: true })
    expect(mocks.set).toHaveBeenCalledWith({ patched: true })
  })
})
