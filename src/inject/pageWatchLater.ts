import type {
  PageWatchLaterError,
  PageWatchLaterParams,
  PageWatchLaterRequestData,
} from '~/constants/api'
import { PAGE_WATCH_LATER_REQUEST, PAGE_WATCH_LATER_RESPONSE } from '~/constants/api'
import { BEWLY_PAGE_WORLD_SOURCE } from '~/constants/pageWorld'

const WATCH_LATER_ADD_URL = 'https://api.bilibili.com/x/v2/history/toview/add'
const WATCH_LATER_REMOVE_URL = 'https://api.bilibili.com/x/v2/history/toview/del'

interface PageWatchLaterBridgeOptions {
  fetchImpl?: typeof window.fetch
  target?: Window
  cookieSource?: Pick<Document, 'cookie'>
}

function createRequestError(
  message: string,
  code: string | number = -1,
  isRiskControl = false,
): Error {
  const error = new Error(message)
  ;(error as any).code = code
  if (isRiskControl)
    (error as any).isRiskControl = true
  return error
}

function serializeError(error: unknown): PageWatchLaterError {
  if (!(error instanceof Error)) {
    return {
      name: 'Error',
      message: String(error),
      code: -1,
    }
  }

  return {
    name: error.name || 'Error',
    message: error.message,
    code: typeof (error as any).code === 'string' || typeof (error as any).code === 'number'
      ? (error as any).code
      : -1,
    isRiskControl: (error as any).isRiskControl === true || undefined,
  }
}

function readCookie(name: string, cookie: string): string {
  const prefix = `${name}=`
  const entry = cookie.split(';').map(item => item.trim()).find(item => item.startsWith(prefix))
  if (!entry)
    return ''

  try {
    return decodeURIComponent(entry.slice(prefix.length))
  }
  catch {
    return entry.slice(prefix.length)
  }
}

function isValidAid(aid: unknown): aid is number {
  return typeof aid === 'number' && Number.isFinite(aid) && aid > 0
}

function isValidBvid(bvid: unknown): bvid is string {
  return typeof bvid === 'string' && /^BV[0-9A-Za-z]{6,}$/.test(bvid)
}

function buildWatchLaterRequest(
  method: PageWatchLaterRequestData['method'],
  params: PageWatchLaterParams,
  csrf: string,
): { url: string, init: RequestInit } {
  const body = new URLSearchParams()
  body.set('csrf', csrf)

  if (method === 'saveToWatchLater') {
    if (!isValidAid(params.aid) && !isValidBvid(params.bvid))
      throw createRequestError('无法识别视频 ID，稍后再看操作失败', 'ERR_INVALID_VIDEO_ID')

    if (isValidAid(params.aid))
      body.set('aid', String(params.aid))
    if (isValidBvid(params.bvid))
      body.set('bvid', params.bvid)

    return {
      url: WATCH_LATER_ADD_URL,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body,
      },
    }
  }

  if (method === 'removeFromWatchLater') {
    if (params.viewed !== true && !isValidAid(params.aid))
      throw createRequestError('无法识别视频 aid，移出稍后再看失败', 'ERR_INVALID_VIDEO_ID')

    const url = new URL(WATCH_LATER_REMOVE_URL)
    if (isValidAid(params.aid))
      url.searchParams.set('aid', String(params.aid))
    body.set('viewed', String(params.viewed === true))

    return {
      url: url.toString(),
      init: {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body,
      },
    }
  }

  throw createRequestError('不支持的稍后再看操作', 'ERR_UNSUPPORTED_WATCH_LATER_METHOD')
}

function parseWatchLaterResponse(response: Response, text: string): unknown {
  const contentType = response.headers.get('content-type') || ''
  const trimmedText = text.trim()
  if (contentType.includes('text/html')
    || trimmedText.startsWith('<!DOCTYPE')
    || trimmedText.startsWith('<html')) {
    throw createRequestError('检测到风控页面，API返回了HTML而不是JSON', -412, true)
  }

  try {
    return text ? JSON.parse(text) : null
  }
  catch {
    throw createRequestError('稍后再看 API 返回了无效响应', 'ERR_INVALID_API_RESPONSE')
  }
}

export async function executePageWatchLaterRequest(
  data: PageWatchLaterRequestData,
  options: PageWatchLaterBridgeOptions = {},
): Promise<unknown> {
  if (!data || typeof data.id !== 'string')
    throw createRequestError('无效的稍后再看请求', 'ERR_INVALID_WATCH_LATER_REQUEST')

  const csrf = readCookie('bili_jct', (options.cookieSource ?? document).cookie)
  if (!csrf)
    throw createRequestError('无法获取登录凭证，请确认已登录 Bilibili 并允许 Safari 扩展访问本站点', 'ERR_BILI_CSRF_MISSING')

  const { url, init } = buildWatchLaterRequest(data.method, data.params || {}, csrf)
  const fetchImpl = options.fetchImpl ?? window.fetch.bind(window)
  const response = await fetchImpl(url, init)
  const text = await response.text()
  return parseWatchLaterResponse(response, text)
}

export function installPageWatchLaterBridge(options: PageWatchLaterBridgeOptions = {}): () => void {
  const target = options.target ?? window

  const listener = (event: MessageEvent) => {
    if (event.source !== target)
      return

    const { type, source, data } = event.data || {}
    if (type !== PAGE_WATCH_LATER_REQUEST || source !== BEWLY_PAGE_WORLD_SOURCE)
      return

    const request = data as PageWatchLaterRequestData
    void executePageWatchLaterRequest(request, options)
      .then((response) => {
        target.postMessage({
          type: PAGE_WATCH_LATER_RESPONSE,
          source: BEWLY_PAGE_WORLD_SOURCE,
          data: {
            id: request?.id,
            response,
          },
        }, '*')
      })
      .catch((error) => {
        target.postMessage({
          type: PAGE_WATCH_LATER_RESPONSE,
          source: BEWLY_PAGE_WORLD_SOURCE,
          data: {
            id: request?.id,
            error: serializeError(error),
          },
        }, '*')
      })
  }

  target.addEventListener('message', listener)
  return () => target.removeEventListener('message', listener)
}
