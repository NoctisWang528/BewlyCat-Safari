import browser from 'webextension-polyfill'

import { appAuthTokens, resetAppAuthTokens } from '~/logic'
import { refreshAppAccessToken } from '~/utils/authProvider'

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const REFRESH_BUFFER = 10 * 60 * 1000 // 10 minutes
const MIN_INTERVAL = 60 * 1000
const ALARM_NAME = 'bewlycat-app-auth-refresh'
const PERIOD_MINUTES = 5

let timer: ReturnType<typeof setInterval> | null = null
let refreshing = false

function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function ensureFreshTokens() {
  const tokens = appAuthTokens.value

  if (!tokens.accessToken || !tokens.refreshToken)
    return

  if (tokens.refreshTokenExpiresAt && tokens.refreshTokenExpiresAt <= Date.now()) {
    console.warn('[BewlyCat] APP refresh token 已过期，清除授权。')
    resetAppAuthTokens()
    return
  }

  if (!tokens.accessTokenExpiresAt)
    return

  const shouldRefresh = tokens.accessTokenExpiresAt <= Date.now() + REFRESH_BUFFER
  if (!shouldRefresh)
    return

  if (refreshing)
    return

  refreshing = true
  try {
    const ok = await refreshAppAccessToken()
    if (!ok)
      console.warn('[BewlyCat] APP access token 刷新失败，请重新授权。')
  }
  finally {
    refreshing = false
  }
}

async function registerAlarm() {
  if (browser.alarms?.create) {
    await browser.alarms.clear(ALARM_NAME).catch(() => {})
    browser.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES })
    return true
  }
  return false
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

export async function ensureFreshTokensOnDemand() {
  await ensureFreshTokens()
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
