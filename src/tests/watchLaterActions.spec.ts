import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toggleWatchLaterTarget } from '~/utils/watchLaterActions'

const mocks = vi.hoisted(() => ({
  getCSRF: vi.fn(() => 'csrf-token'),
  getVideoInfo: vi.fn(),
  markWatchLater: vi.fn(),
  removeFromWatchLater: vi.fn(),
  saveToWatchLater: vi.fn(),
  syncWatchLaterState: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  entries: undefined as Map<string, boolean> | undefined,
  setWatchLater(target: { aid?: number | string, bvid?: string }, added: boolean) {
    const key = target.bvid || `aid:${Number(target.aid || 0)}`
    if (!mocks.entries)
      throw new Error('watchLaterState mock not ready')
    if (added)
      mocks.entries.set(key, true)
    else
      mocks.entries.delete(key)
  },
}))

vi.mock('~/logic/watchLaterState', async () => {
  const { reactive } = await import('vue')
  const entries = reactive(new Map<string, boolean>())
  mocks.entries = entries
  const toKey = (target?: { aid?: number | string, bvid?: string }) =>
    target?.bvid || `aid:${Number(target?.aid || 0)}`
  return {
    getWatchLaterAid: (target?: { aid?: number | string }) => {
      const aid = Number(target?.aid || 0)
      return Number.isSafeInteger(aid) && aid > 0 ? aid : undefined
    },
    isInWatchLater: (target?: { aid?: number | string, bvid?: string }) =>
      entries.get(toKey(target)) ?? false,
    markWatchLater: (target: { aid?: number, bvid?: string }, added: boolean) => {
      const key = toKey(target)
      if (added)
        entries.set(key, true)
      else
        entries.delete(key)
      mocks.markWatchLater(target, added)
    },
  }
})

vi.mock('vue-toastification', () => ({
  useToast: () => ({
    error: mocks.toastError,
    warning: mocks.toastWarning,
  }),
}))

vi.mock('~/stores/topBarStore', () => ({
  useTopBarStore: () => ({
    syncWatchLaterState: mocks.syncWatchLaterState,
  }),
}))

vi.mock('~/utils/api', () => ({
  default: {
    video: {
      getVideoInfo: mocks.getVideoInfo,
    },
    watchlater: {
      removeFromWatchLater: mocks.removeFromWatchLater,
      saveToWatchLater: mocks.saveToWatchLater,
    },
  },
}))

vi.mock('~/utils/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('~/utils/main', () => ({
  getCSRF: mocks.getCSRF,
}))

vi.mock('~/utils/pgcEpisode', () => ({
  resolvePgcEpisodeVideoIds: vi.fn(),
}))

describe('watchLaterActions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.entries?.clear()
    mocks.getCSRF.mockReturnValue('csrf-token')
    mocks.syncWatchLaterState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('does not send a request without a CSRF token', async () => {
    mocks.getCSRF.mockReturnValueOnce('')

    await expect(toggleWatchLaterTarget({ aid: 123, bvid: 'BV1test' })).resolves.toBe(false)

    expect(mocks.saveToWatchLater).not.toHaveBeenCalled()
    expect(mocks.toastWarning).toHaveBeenCalledWith('common.please_log_in_first')
  })

  it('adds a video and refreshes the top bar state', async () => {
    mocks.saveToWatchLater.mockResolvedValueOnce({ code: 0 })

    await expect(toggleWatchLaterTarget({ aid: 123, bvid: 'BV1test' })).resolves.toBe(true)

    expect(mocks.saveToWatchLater).toHaveBeenCalledWith({
      aid: 123,
      bvid: 'BV1test',
      csrf: 'csrf-token',
    })
    expect(mocks.markWatchLater).toHaveBeenCalledWith(
      expect.objectContaining({ aid: 123, bvid: 'BV1test' }),
      true,
    )
    expect(mocks.syncWatchLaterState).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.syncWatchLaterState).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent requests for the same target', async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    mocks.saveToWatchLater.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))

    const firstRequest = toggleWatchLaterTarget({ aid: 123 })
    const secondRequest = toggleWatchLaterTarget({ aid: 123 })

    expect(mocks.saveToWatchLater).toHaveBeenCalledOnce()
    await expect(secondRequest).resolves.toBe(false)

    resolveRequest({ code: 0 })
    await expect(firstRequest).resolves.toBe(true)
  })

  it('resolves aid before removing a bvid-only target', async () => {
    mocks.setWatchLater({ bvid: 'BV1bvid000' }, true)
    mocks.getVideoInfo.mockResolvedValueOnce({ code: 0, data: { aid: 789 } })
    mocks.removeFromWatchLater.mockResolvedValueOnce({ code: 0 })

    await expect(toggleWatchLaterTarget({ bvid: 'BV1bvid000' })).resolves.toBe(true)

    expect(mocks.getVideoInfo).toHaveBeenCalledWith({ bvid: 'BV1bvid000' })
    expect(mocks.removeFromWatchLater).toHaveBeenCalledWith({
      aid: 789,
      csrf: 'csrf-token',
    })
    expect(mocks.markWatchLater).toHaveBeenCalledWith(
      expect.objectContaining({ aid: 789, bvid: 'BV1bvid000' }),
      false,
    )
  })

  it('reports a rejected mutation and releases the loading guard', async () => {
    mocks.saveToWatchLater
      .mockRejectedValueOnce(new Error('Bridge failed'))
      .mockResolvedValueOnce({ code: 0 })

    await expect(toggleWatchLaterTarget({ aid: 123 })).resolves.toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith('Bridge failed')

    await expect(toggleWatchLaterTarget({ aid: 123 })).resolves.toBe(true)
    expect(mocks.saveToWatchLater).toHaveBeenCalledTimes(2)
  })
})
