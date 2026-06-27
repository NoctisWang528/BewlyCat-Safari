import browser from 'webextension-polyfill'

import { appAuthTokens, resetAppAuthTokens } from '~/logic'
import { refreshAppAccessToken } from '~/utils/authProvider'

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const REFRESH_BUFFER = 10 * 60 * 1000 // 10 minutes
const MIN_INTERVAL = 60 * 1000
const ALARM_NAME = 'bewlycat-app-auth-refresh'
const PERIOD_MINUTES = 5

let timer: ReturnType<typeof setInterval> | null = null
let refreshPromise: Promise<boolean> | null = null

export function getRefreshPromise(): Promise<boolean> | null {
  return refreshPromise
}

function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function ensureFreshTokens(): Promise<boolean> {
  const tokens = appAuthTokens.value

  if (!tokens.accessToken || !tokens.refreshToken)
    return false

  if (tokens.refreshTokenExpiresAt && tokens.refreshTokenExpiresAt <= Date.now()) {
    console.warn('[BewlyCat] APP refresh token 已过期，清除授权。')
    resetAppAuthTokens()
    return false
  }

  if (!tokens.accessTokenExpiresAt)
    return true

  const shouldRefresh = tokens.accessTokenExpiresAt <= Date.now() + REFRESH_BUFFER
  if (!shouldRefresh)
    return true

  // If a refresh is already in progress, wait for it
  if (refreshPromise)
    return await refreshPromise

  // Create a new refresh promise that all concurrent callers share
  refreshPromise = (async () => {
    try {
      const ok = await refreshAppAccessToken()
      if (!ok)
        console.warn('[BewlyCat] APP access token 刷新失败，请重新授权。')
      return ok
    }
    finally {
      refreshPromise = null
    }
  })()

  return await refreshPromise
}

async function registerAlarm(): Promise<boolean> {
  if (!browser.alarms?.create)
    return false
  try {
    await browser.alarms.clear(ALARM_NAME).catch(() => {})
    browser.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES })
    return true
  }
  catch {
    return false
  }
}

function registerInterval() {
  clearTimer()
  timer = setInterval(() => {
    void ensureFreshTokens()
  }, Math.max(CHECK_INTERVAL, MIN_INTERVAL))
}

export async function registerAppAuthScheduler() {
  const usedAlarm = await registerAlarm()
  if (!usedAlarm) {
    registerInterval()
  }
}

export function wireAppAuthScheduler() {
  if (browser.alarms?.onAlarm) {
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME)
        void ensureFreshTokens()
    })
  }

  browser.runtime.onInstalled.addListener(() => {
    void registerAppAuthScheduler()
  })

  if (browser.runtime.onStartup) {
    browser.runtime.onStartup.addListener(() => {
      void registerAppAuthScheduler()
    })
  }

  void ensureFreshTokens()
}

/**
 * Ensure tokens are fresh and return the latest access token.
 * Waits for any in-progress refresh, then returns the current token
 * from background memory (the authoritative source).
 */
export async function ensureFreshTokensOnDemand(): Promise<string> {
  const usable = await ensureFreshTokens()
  if (!usable)
    return ''

  const token = appAuthTokens.value.accessToken
  return token || ''
}

export function setupAppAuthScheduler() {
  void registerAppAuthScheduler()
  wireAppAuthScheduler()
}

export function teardownAppAuthScheduler() {
  clearTimer()
  if (browser.alarms?.clear) {
    void browser.alarms.clear(ALARM_NAME)
  }
}
