import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PAGE_WATCH_LATER_REQUEST,
  PAGE_WATCH_LATER_RESPONSE,
} from '~/constants/api'
import {
  BEWLY_PAGE_WORLD_FALLBACK_ATTR,
  BEWLY_PAGE_WORLD_SOURCE,
} from '~/constants/pageWorld'
import {
  executePageWatchLaterRequest,
  installPageWatchLaterBridge,
} from '~/inject/pageWatchLater'
import { requestPageWatchLater } from '~/utils/pageWatchLater'

describe('page watch-later request client', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    document.documentElement.removeAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)
    postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  })

  afterEach(() => {
    postMessageSpy.mockRestore()
    vi.useRealTimers()
  })

  it('resolves only the matching trusted response', async () => {
    const resultPromise = requestPageWatchLater('saveToWatchLater', {
      aid: 123,
      csrf: 'must-not-be-posted',
    })
    const request = postMessageSpy.mock.calls[0][0] as any

    expect(request).toMatchObject({
      type: PAGE_WATCH_LATER_REQUEST,
      source: BEWLY_PAGE_WORLD_SOURCE,
      data: {
        method: 'saveToWatchLater',
        params: {
          aid: 123,
        },
      },
    })
    expect(request.data.params).not.toHaveProperty('csrf')

    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: PAGE_WATCH_LATER_RESPONSE,
        source: 'untrusted',
        data: { id: request.data.id, response: { code: -1 } },
      },
    }))
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: PAGE_WATCH_LATER_RESPONSE,
        source: BEWLY_PAGE_WORLD_SOURCE,
        data: { id: 'wrong-id', response: { code: -1 } },
      },
    }))
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: PAGE_WATCH_LATER_RESPONSE,
        source: BEWLY_PAGE_WORLD_SOURCE,
        data: { id: request.data.id, response: { code: 0 } },
      },
    }))

    await expect(resultPromise).resolves.toEqual({ code: 0 })
  })

  it('reconstructs structured bridge errors', async () => {
    const resultPromise = requestPageWatchLater('removeFromWatchLater', { aid: 123 })
    const request = postMessageSpy.mock.calls[0][0] as any

    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: PAGE_WATCH_LATER_RESPONSE,
        source: BEWLY_PAGE_WORLD_SOURCE,
        data: {
          id: request.data.id,
          error: {
            name: 'ApiRiskControlError',
            message: 'risk control',
            code: -412,
            isRiskControl: true,
          },
        },
      },
    }))

    await expect(resultPromise).rejects.toMatchObject({
      name: 'ApiRiskControlError',
      message: 'risk control',
      code: -412,
      isRiskControl: true,
    })
  })

  it('times out without falling back to another request path', async () => {
    vi.useFakeTimers()
    const resultPromise = requestPageWatchLater('saveToWatchLater', { aid: 123 })
    const rejection = expect(resultPromise).rejects.toMatchObject({
      code: 'ERR_PAGE_WATCH_LATER_TIMEOUT',
    })

    await vi.advanceTimersByTimeAsync(15000)
    await rejection
    expect(postMessageSpy).toHaveBeenCalledOnce()
  })

  it('fails immediately when MAIN-world injection is unavailable', async () => {
    document.documentElement.setAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR, 'failed')

    await expect(requestPageWatchLater('saveToWatchLater', { aid: 123 }))
      .rejects
      .toMatchObject({ code: 'ERR_PAGE_WORLD_UNAVAILABLE' })
    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

describe('page watch-later MAIN-world handler', () => {
  it('builds an add request from allowlisted fields and the page CSRF cookie', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response(
      JSON.stringify({ code: 0 }),
      { headers: { 'Content-Type': 'application/json' } },
    ))

    const result = await executePageWatchLaterRequest({
      id: 'request-1',
      method: 'saveToWatchLater',
      params: {
        aid: 123,
        bvid: 'BV1abcdefg',
      },
    }, {
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: 'foo=bar; bili_jct=csrf%20token' },
    })

    expect(result).toEqual({ code: 0 })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview/add')
    expect(init.credentials).toBe('include')
    expect(init).not.toHaveProperty('referrer')
    expect(init.headers).not.toHaveProperty('Origin')
    expect(init.headers).not.toHaveProperty('Referer')
    expect((init.body as URLSearchParams).toString()).toBe('csrf=csrf+token&aid=123&bvid=BV1abcdefg')
  })

  it('builds remove requests without accepting an arbitrary URL', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response(
      JSON.stringify({ code: 0 }),
      { headers: { 'Content-Type': 'application/json' } },
    ))

    await executePageWatchLaterRequest({
      id: 'request-2',
      method: 'removeFromWatchLater',
      params: { aid: 456 },
    }, {
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview/del?aid=456')
    expect((init.body as URLSearchParams).toString()).toBe('csrf=token&viewed=false')

    await expect(executePageWatchLaterRequest({
      id: 'request-3',
      method: 'arbitraryMethod' as any,
      params: {},
    }, {
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })).rejects.toMatchObject({ code: 'ERR_UNSUPPORTED_WATCH_LATER_METHOD' })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('supports the remove-viewed operation without an aid', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response(
      JSON.stringify({ code: 0 }),
      { headers: { 'Content-Type': 'application/json' } },
    ))

    await executePageWatchLaterRequest({
      id: 'request-4',
      method: 'removeFromWatchLater',
      params: { viewed: true },
    }, {
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview/del')
    expect((init.body as URLSearchParams).toString()).toBe('csrf=token&viewed=true')
  })

  it('rejects missing credentials and invalid identifiers before fetch', async () => {
    const fetchImpl = vi.fn()
    const baseRequest = {
      id: 'request-5',
      method: 'saveToWatchLater' as const,
      params: { aid: 123 },
    }

    await expect(executePageWatchLaterRequest(baseRequest, {
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: '' },
    })).rejects.toMatchObject({ code: 'ERR_BILI_CSRF_MISSING' })

    await expect(executePageWatchLaterRequest({
      ...baseRequest,
      params: { aid: 0, bvid: 'invalid' },
    }, {
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })).rejects.toMatchObject({ code: 'ERR_INVALID_VIDEO_ID' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('converts HTML and invalid JSON responses to structured errors', async () => {
    const request = {
      id: 'request-6',
      method: 'saveToWatchLater' as const,
      params: { aid: 123 },
    }

    await expect(executePageWatchLaterRequest(request, {
      fetchImpl: vi.fn(async () => new Response('<html>risk</html>', {
        headers: { 'Content-Type': 'text/html' },
      })) as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })).rejects.toMatchObject({ code: -412, isRiskControl: true })

    await expect(executePageWatchLaterRequest(request, {
      fetchImpl: vi.fn(async () => new Response('not-json', {
        headers: { 'Content-Type': 'text/plain' },
      })) as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })).rejects.toMatchObject({ code: 'ERR_INVALID_API_RESPONSE' })
  })

  it('ignores untrusted bridge events', async () => {
    const fetchImpl = vi.fn()
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    const uninstall = installPageWatchLaterBridge({
      target: window,
      fetchImpl: fetchImpl as any,
      cookieSource: { cookie: 'bili_jct=token' },
    })

    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: {
        type: PAGE_WATCH_LATER_REQUEST,
        source: 'untrusted',
        data: {
          id: 'request-7',
          method: 'saveToWatchLater',
          params: { aid: 123 },
        },
      },
    }))
    await Promise.resolve()

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()

    uninstall()
    postMessage.mockRestore()
  })
})
