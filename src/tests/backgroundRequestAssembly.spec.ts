import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
