import type {
  PageWatchLaterError,
  PageWatchLaterMethod,
  PageWatchLaterParams,
  PageWatchLaterResponseData,
} from '~/constants/api'
import { PAGE_WATCH_LATER_REQUEST, PAGE_WATCH_LATER_RESPONSE } from '~/constants/api'
import {
  BEWLY_PAGE_WORLD_FALLBACK_ATTR,
  BEWLY_PAGE_WORLD_SOURCE,
} from '~/constants/pageWorld'

const RESPONSE_TIMEOUT_MS = 15000
let requestSeq = 0

export function isPageWatchLaterMethod(method: PropertyKey): method is PageWatchLaterMethod {
  return method === 'saveToWatchLater' || method === 'removeFromWatchLater'
}

function createBridgeError(error: PageWatchLaterError): Error {
  const result = new Error(error.message)
  result.name = error.name || 'Error'
  if (error.code !== undefined)
    (result as any).code = error.code
  if (error.isRiskControl !== undefined)
    (result as any).isRiskControl = error.isRiskControl
  return result
}

function createUnavailableError(): Error {
  const error = new Error('Safari 页面请求桥不可用，请刷新页面后重试')
  ;(error as any).code = 'ERR_PAGE_WORLD_UNAVAILABLE'
  return error
}

export function requestPageWatchLater(
  method: PageWatchLaterMethod,
  options: Record<string, unknown> = {},
): Promise<any> {
  if (document.documentElement.getAttribute(BEWLY_PAGE_WORLD_FALLBACK_ATTR) === 'failed')
    return Promise.reject(createUnavailableError())

  const params: PageWatchLaterParams = {
    aid: typeof options.aid === 'number' ? options.aid : undefined,
    bvid: typeof options.bvid === 'string' ? options.bvid : undefined,
    viewed: typeof options.viewed === 'boolean' ? options.viewed : undefined,
  }

  return new Promise((resolve, reject) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++requestSeq}-${Math.random()}`
    const timer = window.setTimeout(() => {
      cleanup()
      const error = new Error('Safari 页面稍后再看请求超时，请刷新页面后重试')
      ;(error as any).code = 'ERR_PAGE_WATCH_LATER_TIMEOUT'
      reject(error)
    }, RESPONSE_TIMEOUT_MS)

    function cleanup() {
      window.clearTimeout(timer)
      window.removeEventListener('message', handleMessage)
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window)
        return

      const { type, source, data } = event.data || {}
      if (type !== PAGE_WATCH_LATER_RESPONSE
        || source !== BEWLY_PAGE_WORLD_SOURCE
        || data?.id !== id) {
        return
      }

      cleanup()

      const response = data as PageWatchLaterResponseData
      if (response.error) {
        reject(createBridgeError(response.error))
        return
      }

      resolve(response.response)
    }

    window.addEventListener('message', handleMessage)
    window.postMessage({
      type: PAGE_WATCH_LATER_REQUEST,
      source: BEWLY_PAGE_WORLD_SOURCE,
      data: {
        id,
        method,
        params,
      },
    }, '*')
  })
}
