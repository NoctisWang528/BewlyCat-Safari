import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isDnrCoveredRequest, requestWithSafariCompat } from '~/background/requestWithSafariCompat'

describe('isDnrCoveredRequest', () => {
  it('covers api.bilibili.com POST', () => {
    expect(isDnrCoveredRequest('https://api.bilibili.com/x/web-interface/nav', 'POST')).toBe(true)
  })

  it('covers passport.bilibili.com POST', () => {
    expect(isDnrCoveredRequest('https://passport.bilibili.com/x/passport-login/web/login', 'POST')).toBe(true)
  })

  it('does not cover api.bilibili.com GET', () => {
    expect(isDnrCoveredRequest('https://api.bilibili.com/x/web-interface/nav', 'GET')).toBe(false)
  })

  it('does not cover passport.bilibili.com GET', () => {
    expect(isDnrCoveredRequest('https://passport.bilibili.com/x/passport-login/web/login', 'GET')).toBe(false)
  })

  it('does not cover other Bilibili hosts POST', () => {
    expect(isDnrCoveredRequest('https://www.bilibili.com/x/web-interface/nav', 'POST')).toBe(false)
    expect(isDnrCoveredRequest('https://space.bilibili.com/x/web-interface/nav', 'POST')).toBe(false)
  })

  it('does not cover malicious similar hostname', () => {
    expect(isDnrCoveredRequest('https://evil-api.bilibili.com.example.com/api', 'POST')).toBe(false)
    expect(isDnrCoveredRequest('https://api.bilibili.com.evil.com/api', 'POST')).toBe(false)
  })

  it('returns false for invalid URL', () => {
    expect(isDnrCoveredRequest('not-a-url', 'POST')).toBe(false)
    expect(isDnrCoveredRequest('', 'POST')).toBe(false)
  })

  it('handles case-insensitive method', () => {
    expect(isDnrCoveredRequest('https://api.bilibili.com/x/nav', 'post')).toBe(true)
    expect(isDnrCoveredRequest('https://api.bilibili.com/x/nav', 'Post')).toBe(true)
  })
})

describe('requestWithSafariCompat', () => {
  let originalFetch: typeof globalThis.fetch
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }))
    globalThis.fetch = fetchSpy as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('dNR POST removes Origin and Referer from caller headers', async () => {
    await requestWithSafariCompat({
      url: 'https://api.bilibili.com/x/web-interface/nav',
      method: 'POST',
      headers: {
        Origin: 'https://www.bilibili.com',
        Referer: 'https://www.bilibili.com/',
        'Content-Type': 'application/json',
      },
      body: '{"test":1}',
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]
    // Headers API normalizes keys to lowercase
    expect(init.headers).not.toHaveProperty('origin')
    expect(init.headers).not.toHaveProperty('referer')
    expect(init.headers).toHaveProperty('content-type', 'application/json')
  })

  it('non-DNR GET preserves Referer but removes Origin', async () => {
    await requestWithSafariCompat({
      url: 'https://www.bilibili.com/x/web-interface/nav',
      method: 'GET',
      headers: {
        Origin: 'https://www.bilibili.com',
        Referer: 'https://www.bilibili.com/',
      },
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers).not.toHaveProperty('origin')
    expect(init.headers).toHaveProperty('referer', 'https://www.bilibili.com/')
  })

  it('non-covered GET does not get misclassified', async () => {
    await requestWithSafariCompat({
      url: 'https://api.bilibili.com/x/web-interface/nav',
      method: 'GET',
      headers: {
        Referer: 'https://www.bilibili.com/',
      },
    })

    const [, init] = fetchSpy.mock.calls[0]
    // GET to api.bilibili.com is NOT covered by DNR (only POST is)
    expect(init.headers).toHaveProperty('referer', 'https://www.bilibili.com/')
  })

  it('method, body, and credentials pass through unchanged', async () => {
    await requestWithSafariCompat({
      url: 'https://api.bilibili.com/x/web-interface/nav',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"foo":"bar"}',
      credentials: 'omit',
    })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.bilibili.com/x/web-interface/nav')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"foo":"bar"}')
    expect(init.credentials).toBe('omit')
  })

  it('malicious suffix hostname is not matched', async () => {
    await requestWithSafariCompat({
      url: 'https://api.bilibili.com.evil.com/api',
      method: 'POST',
      headers: {
        Origin: 'https://evil.com',
        Referer: 'https://evil.com/',
      },
    })

    const [, init] = fetchSpy.mock.calls[0]
    // Not DNR-covered, so Referer preserved but Origin removed
    expect(init.headers).not.toHaveProperty('origin')
    expect(init.headers).toHaveProperty('referer', 'https://evil.com/')
  })

  it('case-insensitive header normalization', async () => {
    await requestWithSafariCompat({
      url: 'https://api.bilibili.com/x/nav',
      method: 'POST',
      headers: {
        'origin': 'https://www.bilibili.com',
        'referer': 'https://www.bilibili.com/',
        'content-type': 'text/plain',
      },
    })

    const [, init] = fetchSpy.mock.calls[0]
    // DNR-covered POST: origin and referer removed
    expect(init.headers).not.toHaveProperty('origin')
    expect(init.headers).not.toHaveProperty('Origin')
    expect(init.headers).not.toHaveProperty('referer')
    expect(init.headers).not.toHaveProperty('Referer')
    // content-type should survive
    expect(init.headers).toHaveProperty('content-type', 'text/plain')
  })
})
