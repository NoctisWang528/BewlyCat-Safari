import { beforeEach, describe, expect, it, vi } from 'vitest'
import browser from 'webextension-polyfill'

import api, { APIClient, shouldUsePageWatchLater } from '~/utils/api'

const pageWatchLaterMocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('~/utils/pageWatchLater', async (importOriginal) => {
  const original = await importOriginal<typeof import('~/utils/pageWatchLater')>()
  return {
    ...original,
    requestPageWatchLater: pageWatchLaterMocks.request,
  }
})

describe('apiClient response validation', () => {
  beforeEach(() => {
    vi.mocked(browser.runtime.sendMessage).mockReset()
    pageWatchLaterMocks.request.mockReset()
  })

  it('returns response when it has code property', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: true, data: { code: 0, data: { mid: 123 } } })
    const result = await api.user.getUserInfo()
    expect(result).toEqual({ code: 0, data: { mid: 123 } })
  })

  it('throws ERR_INVALID_API_RESPONSE when background returns undefined', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(undefined as any)
    await expect(api.user.getUserInfo()).rejects.toThrow('No response from background')
  })

  it('throws ERR_INVALID_API_RESPONSE when response has no code', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: true, data: { data: 'test' } })
    const promise = api.user.getUserInfo()
    await expect(promise).rejects.toThrow('Invalid API response from')
    await expect(promise).rejects.toMatchObject({ code: 'ERR_INVALID_API_RESPONSE' })
  })

  it('throws ERR_INVALID_API_RESPONSE when response is a non-object', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: true, data: 'string-response' })
    await expect(api.user.getUserInfo()).rejects.toThrow('Invalid API response from')
  })

  it('passes through normal API responses with code', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: true, data: { code: 0, data: { items: [] } } })
    const result = await api.video.getAppRecommendVideos?.({}) ?? await api.user.getUserInfo()
    expect(result).toHaveProperty('code', 0)
  })

  it('passes through error codes from API', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: true, data: { code: -101, message: 'not logged in' } })
    const result = await api.user.getUserInfo()
    expect(result).toEqual({ code: -101, message: 'not logged in' })
  })

  it('routes Safari watch-later mutations through the page bridge', async () => {
    pageWatchLaterMocks.request.mockResolvedValueOnce({ code: 0 })
    const safariApi = new APIClient(true)

    const result = await safariApi.watchlater.saveToWatchLater({
      aid: 123,
      csrf: 'not-forwarded-by-the-bridge',
    })

    expect(result).toEqual({ code: 0 })
    expect(pageWatchLaterMocks.request).toHaveBeenCalledWith('saveToWatchLater', {
      aid: 123,
      csrf: 'not-forwarded-by-the-bridge',
    })
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('keeps non-Safari watch-later mutations on background messaging', async () => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({ ok: true, data: { code: 0 } })
    const nonSafariApi = new APIClient(false)

    await nonSafariApi.watchlater.removeFromWatchLater({
      aid: 123,
      csrf: 'token',
    })

    expect(pageWatchLaterMocks.request).not.toHaveBeenCalled()
    expect(browser.runtime.sendMessage).toHaveBeenCalledOnce()
  })

  it('limits the Safari page bridge to watch-later add and remove', () => {
    expect(shouldUsePageWatchLater('watchlater', 'saveToWatchLater', true)).toBe(true)
    expect(shouldUsePageWatchLater('watchlater', 'removeFromWatchLater', true)).toBe(true)
    expect(shouldUsePageWatchLater('watchlater', 'clearAllWatchLater', true)).toBe(false)
    expect(shouldUsePageWatchLater('video', 'saveToWatchLater', true)).toBe(false)
    expect(shouldUsePageWatchLater('watchlater', 'saveToWatchLater', false)).toBe(false)
  })
})
