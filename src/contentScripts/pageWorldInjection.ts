import browser from 'webextension-polyfill'

import {
  BEWLY_PAGE_WORLD_FAILED,
  BEWLY_PAGE_WORLD_FALLBACK_ATTR,
  BEWLY_PAGE_WORLD_PING,
  BEWLY_PAGE_WORLD_READY,
  BEWLY_PAGE_WORLD_SOURCE,
} from '~/constants/pageWorld'

const FALLBACK_STATES = ['pending', 'loaded', 'failed'] as const
type FallbackState = typeof FALLBACK_STATES[number]

function setFallbackAttr(state: FallbackState) {
  document.documentElement.setAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR, state)
}

function getFallbackAttr(): FallbackState | null {
  const val = document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR)
  if (val && (FALLBACK_STATES as readonly string[]).includes(val))
    return val as FallbackState
  return null
}

export function ensureMainWorldInjected(timeoutMs = 300) {
  // Already pending, loaded, or failed — never insert twice
  if (getFallbackAttr())
    return

  let cleaned = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let readyTimer: ReturnType<typeof setTimeout> | undefined
  let scriptInserted = false

  function cleanup() {
    if (cleaned)
      return
    cleaned = true
    window.removeEventListener('message', onPageWorldMessage)
    if (timer !== undefined)
      clearTimeout(timer)
    if (readyTimer !== undefined)
      clearTimeout(readyTimer)
  }

  function onPageWorldMessage(event: MessageEvent) {
    if (event.source !== window)
      return
    if (event.data?.source !== BEWLY_PAGE_WORLD_SOURCE)
      return

    if (event.data?.type === BEWLY_PAGE_WORLD_READY) {
      cleanup()
      setFallbackAttr('loaded')
    }
    else if (event.data?.type === BEWLY_PAGE_WORLD_FAILED) {
      cleanup()
      setFallbackAttr('failed')
      console.error('[BewlyCat] MAIN world initialization failed:', event.data?.error)
    }
  }

  // Install READY listener first (before PING)
  window.addEventListener('message', onPageWorldMessage, { passive: true })

  setFallbackAttr('pending')
  // Send PING in case the page-world script already loaded
  window.postMessage({
    type: BEWLY_PAGE_WORLD_PING,
    source: BEWLY_PAGE_WORLD_SOURCE,
  }, '*')

  timer = setTimeout(() => {
    timer = undefined

    // If READY was received in the meantime, onReady already cleaned up
    if (getFallbackAttr() !== 'pending')
      return

    if (scriptInserted)
      return
    scriptInserted = true

    const script = document.createElement('script')
    script.src = browser.runtime.getURL('dist/contentScripts/inject.global.js')
    script.async = false
    script.dataset.bewlyPageWorld = '1'

    ;(document.head || document.documentElement).appendChild(script)

    script.onload = () => {
      script.remove()
      // script.onload only means the resource loaded, NOT that hooks initialized.
      // Wait for READY message; if it doesn't come, mark as failed.
      readyTimer = setTimeout(() => {
        if (getFallbackAttr() === 'pending') {
          cleanup()
          setFallbackAttr('failed')
          console.error('[BewlyCat] MAIN world script loaded but READY not received')
        }
      }, 500)
    }
    script.onerror = () => {
      script.remove()
      cleanup()
      setFallbackAttr('failed')
      console.error('[BewlyCat] MAIN world script injection failed')
    }
  }, timeoutMs)
}
