import { beforeEach, describe, expect, it, vi } from 'vitest'
import browser from 'webextension-polyfill'

import api from '~/utils/api'

describe('apiClient response validation', () => {
  beforeEach(() => {
    vi.mocked(browser.runtime.sendMessage).mockReset()
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
})
