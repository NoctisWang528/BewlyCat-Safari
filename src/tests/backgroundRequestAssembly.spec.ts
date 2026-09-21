import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SEARCH_API from '~/background/messageListeners/api/search'
import USER_API from '~/background/messageListeners/api/user'
import { AHS, apiListenerFactory } from '~/background/utils'

describe('background request assembly', () => {
  let originalFetch: typeof globalThis.fetch
  let fetchSpy: ReturnType<typeof vi.fn>
  let debugSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ code: 0, data: null }),
      { headers: { 'Content-Type': 'application/json' } },
    ))
    globalThis.fetch = fetchSpy as any
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    debugSpy.mockRestore()
    globalThis.fetch = originalFetch
  })

  it('keeps the cached default search recommendation anonymous', () => {
    expect(SEARCH_API.getDefaultSearchRecommendation.cacheMaxAge).toBeGreaterThan(0)
    expect(SEARCH_API.getDefaultSearchRecommendation._fetch.credentials).toBe('omit')
  })

  it('uses the custom query serializer without appending an empty query', async () => {
    const handleMessage = apiListenerFactory({ getRelations: USER_API.getRelations })

    await handleMessage({ contentScriptQuery: 'getRelations', fids: '1,2' })
    await handleMessage({ contentScriptQuery: 'getRelations' })

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.bilibili.com/x/relation/relations?fids=1,2')
    expect(fetchSpy.mock.calls[1][0]).toBe('https://api.bilibili.com/x/relation/relations')
  })

  it('puts optional watch-later identifiers in the form body and omits empty defaults', async () => {
    const handleMessage = apiListenerFactory({
      saveToWatchLater: {
        url: 'https://api.bilibili.com/x/v2/history/toview/add',
        _fetch: {
          method: 'post',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: {
            aid: undefined as number | undefined,
            bvid: undefined as string | undefined,
            csrf: '',
          },
        },
        afterHandle: AHS.J_D,
      },
    })

    await handleMessage({
      contentScriptQuery: 'saveToWatchLater',
      bvid: 'BV1test',
      csrf: 'token',
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview/add')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    expect(init.body.toString()).toBe('bvid=BV1test&csrf=token')
    expect(init.body.toString()).not.toContain('aid=')
  })

  it('omits the default removal aid and keeps a supplied aid in query params', async () => {
    const handleMessage = apiListenerFactory({
      removeFromWatchLater: {
        url: 'https://api.bilibili.com/x/v2/history/toview/del',
        _fetch: {
          method: 'post',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: {
            viewed: false,
            csrf: '',
          },
        },
        params: {
          aid: undefined as number | undefined,
        },
        afterHandle: AHS.J_D,
      },
    })

    await handleMessage({
      contentScriptQuery: 'removeFromWatchLater',
      csrf: 'token',
    })

    const [firstUrl, firstInit] = fetchSpy.mock.calls[0]
    expect(firstUrl).toBe('https://api.bilibili.com/x/v2/history/toview/del')
    expect(firstInit.body.toString()).toBe('viewed=false&csrf=token')

    await handleMessage({
      contentScriptQuery: 'removeFromWatchLater',
      aid: 123,
      csrf: 'token',
    })

    const [secondUrl, secondInit] = fetchSpy.mock.calls[1]
    expect(secondUrl).toBe('https://api.bilibili.com/x/v2/history/toview/del?aid=123')
    expect(secondInit.body.toString()).toBe('viewed=false&csrf=token')
    expect(secondInit.body.toString()).not.toContain('aid=')
  })
})
