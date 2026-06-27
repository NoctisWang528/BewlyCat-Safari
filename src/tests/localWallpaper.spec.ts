import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const storageMocks = vi.hoisted(() => {
  const values: Record<string, unknown> = {}
  return {
    values,
    get: vi.fn(async (key: string) => key in values ? { [key]: values[key] } : {}),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items)
    }),
    remove: vi.fn(async (key: string) => {
      delete values[key]
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }
})

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: storageMocks.get,
        set: storageMocks.set,
        remove: storageMocks.remove,
      },
      onChanged: {
        addListener: storageMocks.addListener,
        removeListener: storageMocks.removeListener,
      },
    },
  },
}))

function wallpaper(id: string, timestamp = Date.now()) {
  return {
    id,
    name: `${id}.jpg`,
    base64: `data:image/jpeg;base64,${id}`,
    size: 10,
    type: 'image/jpeg',
    lastModified: 1,
    timestamp,
  }
}

async function loadModule(initial: Record<string, ReturnType<typeof wallpaper>> = {}) {
  storageMocks.values.localWallpapers = JSON.stringify(initial)
  return await import('~/utils/localWallpaper')
}

describe('localWallpaper persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const key of Object.keys(storageMocks.values))
      delete storageMocks.values[key]
    storageMocks.get.mockClear()
    storageMocks.set.mockClear()
    storageMocks.remove.mockClear()
    storageMocks.set.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(storageMocks.values, items)
    })
  })

  it('replaces the old wallpaper with exactly one storage write', async () => {
    const module = await loadModule({ old: wallpaper('old') })
    const file = new File(['new'], 'new.jpg', { type: 'image/jpeg', lastModified: 2 })

    const result = await module.replaceLocalWallpaper('old', file, 'data:image/jpeg;base64,new')
    await nextTick()
    await Promise.resolve()

    expect(storageMocks.set).toHaveBeenCalledOnce()
    const persisted = JSON.parse(storageMocks.set.mock.calls[0][0].localWallpapers as string)
    expect(persisted.old).toBeUndefined()
    expect(persisted[result.id].name).toBe('new.jpg')
    expect(module.resolveWallpaperUrl(`local-wallpaper:${result.id}`)).toBe('data:image/jpeg;base64,new')
  })

  it('preserves the old in-memory wallpaper when persistence fails', async () => {
    const module = await loadModule({ old: wallpaper('old') })
    storageMocks.set.mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'))
    const file = new File(['new'], 'new.jpg', { type: 'image/jpeg' })

    await expect(module.replaceLocalWallpaper('old', file, 'data:image/jpeg;base64,new'))
      .rejects
      .toMatchObject({ code: 'ERR_STORAGE_QUOTA' })
    expect(module.resolveWallpaperUrl('local-wallpaper:old')).toBe('data:image/jpeg;base64,old')
  })

  it('serializes concurrent additions without losing the first result', async () => {
    const module = await loadModule()
    const first = module.storeLocalWallpaper(new File(['a'], 'a.jpg'), 'data:image/jpeg;base64,a')
    const second = module.storeLocalWallpaper(new File(['b'], 'b.jpg'), 'data:image/jpeg;base64,b')
    const [firstRef, secondRef] = await Promise.all([first, second])

    const persisted = JSON.parse(storageMocks.values.localWallpapers as string)
    expect(persisted[firstRef.id]).toBeDefined()
    expect(persisted[secondRef.id]).toBeDefined()
    expect(storageMocks.set).toHaveBeenCalledTimes(2)
  })

  it('awaits remove, cleanup, and clear persistence', async () => {
    const module = await loadModule({
      current: wallpaper('current'),
      expired: wallpaper('expired', 1),
    })

    await module.removeLocalWallpaper('current')
    await module.cleanupExpiredWallpapers(1)
    await module.clearAllLocalWallpapers()

    expect(JSON.parse(storageMocks.values.localWallpapers as string)).toEqual({})
    expect(storageMocks.set).toHaveBeenCalledTimes(3)
  })
})
