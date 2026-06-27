import browser from 'webextension-polyfill'

const READY_EVENT = 'BEWLY_PAGE_WORLD_READY'
const FALLBACK_ATTR = 'data-bewly-main-world-fallback'

export function ensureMainWorldInjectedFallback(timeoutMs = 150) {
  let ready = false

  const onReady = (event: MessageEvent) => {
    if (event.source !== window)
      return
    if (event.data?.type !== READY_EVENT)
      return
    ready = true
    window.removeEventListener('message', onReady)
  }

  window.addEventListener('message', onReady, { passive: true })

  setTimeout(() => {
    if (ready)
      return
    if (document.documentElement.hasAttribute(FALLBACK_ATTR))
      return

    const script = document.createElement('script')
    script.src = browser.runtime.getURL('dist/contentScripts/inject.global.js')
    script.async = false
    script.dataset.bewlyPageWorld = '1'

    document.documentElement.setAttribute(FALLBACK_ATTR, '1')
    ;(document.head || document.documentElement).appendChild(script)

    script.onload = () => script.remove()
    script.onerror = () => {
      script.remove()
      console.error('[BewlyCat] MAIN world fallback injection failed')
    }
  }, timeoutMs)
}
