import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  appAuthTokens: {
    value: {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: Date.now() - 1000,
      refreshTokenExpiresAt: Date.now() + 86_400_000,
      mid: 12345,
      lastUpdatedAt: Date.now(),
    },
  },
  refreshAppAccessToken: vi.fn<() => Promise<boolean>>(),
  resetAppAuthTokens: vi.fn(),
  getTvSign: vi.fn((params: Record<string, unknown>) => JSON.stringify(params)),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    alarms: {
      create: vi.fn(),
      clear: vi.fn(() => Promise.resolve()),
      onAlarm: { addListener: vi.fn() },
    },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
  },
}))

vi.mock('~/logic', () => ({
  appAuthTokens: authMocks.appAuthTokens,
  resetAppAuthTokens: authMocks.resetAppAuthTokens,
}))

vi.mock('~/utils/authProvider', () => ({
  refreshAppAccessToken: authMocks.refreshAppAccessToken,
  TVAppKey: {
    appkey: 'test-app-key',
    appsec: 'test-app-secret',
  },
  getTvSign: authMocks.getTvSign,
}))

describe('appAuthScheduler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.resetModules()
    authMocks.appAuthTokens.value = {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: Date.now() - 1000,
      refreshTokenExpiresAt: Date.now() + 86_400_000,
      mid: 12345,
      lastUpdatedAt: Date.now(),
    }
    authMocks.refreshAppAccessToken.mockReset()
    authMocks.resetAppAuthTokens.mockReset()
    authMocks.resetAppAuthTokens.mockImplementation(() => {
      authMocks.appAuthTokens.value.accessToken = ''
      authMocks.appAuthTokens.value.refreshToken = ''
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shares one refresh and returns the refreshed token to concurrent callers', async () => {
    let resolveRefresh!: (value: boolean) => void
    authMocks.refreshAppAccessToken.mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveRefresh = (value) => {
        if (value)
          authMocks.appAuthTokens.value.accessToken = 'new-token'
        resolve(value)
      }
    }))

    const { ensureFreshTokensOnDemand } = await import('~/background/appAuthScheduler')
    const first = ensureFreshTokensOnDemand()
    const second = ensureFreshTokensOnDemand()

    expect(authMocks.refreshAppAccessToken).toHaveBeenCalledTimes(1)
    resolveRefresh(true)
    await expect(Promise.all([first, second])).resolves.toEqual(['new-token', 'new-token'])
  })

  it('returns no token when refresh fails instead of reusing the stale token', async () => {
    authMocks.refreshAppAccessToken.mockResolvedValue(false)
    const { ensureFreshTokensOnDemand } = await import('~/background/appAuthScheduler')
    await expect(ensureFreshTokensOnDemand()).resolves.toBe('')
  })

  it('clears expired refresh credentials and returns no access token', async () => {
    authMocks.appAuthTokens.value.refreshTokenExpiresAt = Date.now() - 1
    const { ensureFreshTokensOnDemand } = await import('~/background/appAuthScheduler')

    await expect(ensureFreshTokensOnDemand()).resolves.toBe('')
    expect(authMocks.resetAppAuthTokens).toHaveBeenCalledOnce()
    expect(authMocks.refreshAppAccessToken).not.toHaveBeenCalled()
  })
})

describe('aPP request authentication', () => {
  beforeEach(() => {
    authMocks.getTvSign.mockClear()
  })

  it('overwrites stale credentials and signs exactly the outgoing non-empty parameters', async () => {
    const { applyAppAuthToParams } = await import('~/background/utils')
    const result = await applyAppAuthToParams({
      access_key: 'stale-token',
      sign: 'stale-sign',
      id: 42,
      reason_id: undefined,
      feedback_id: null,
      goto: '',
    }, 'inject+sign', 'fresh-token', () => 1_700_000_000_000)

    expect(result.access_key).toBe('fresh-token')
    expect(result.appkey).toBe('test-app-key')
    expect(result.ts).toBe('1700000000')
    expect(result.sign).not.toBe('stale-sign')
    expect(authMocks.getTvSign).toHaveBeenCalledWith({
      access_key: 'fresh-token',
      id: 42,
      appkey: 'test-app-key',
      ts: '1700000000',
    })
  })

  it('rejects authenticated requests when no current token is available', async () => {
    const { applyAppAuthToParams } = await import('~/background/utils')
    await expect(applyAppAuthToParams({}, 'inject', ''))
      .rejects
      .toMatchObject({ code: 'ERR_APP_AUTH_REQUIRED' })
  })
})
