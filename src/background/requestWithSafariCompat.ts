import browser from 'webextension-polyfill'

const DEFAULT_REFERER = 'https://www.bilibili.com/'
const DEFAULT_ORIGIN = 'https://www.bilibili.com'

function canUseDnrHeaderMode(): boolean {
  return Boolean(browser.declarativeNetRequest)
}

export interface SafariCompatRequestOptions {
  url: string
  method: string
  headers?: Record<string, string>
  body?: BodyInit | null
  credentials?: RequestCredentials
  referer?: string
  origin?: string
}

export interface RequestDiagnostics {
  target: 'dnr' | 'background-fetch'
  url: string
  method: string
  appliedReferer?: string
  appliedOrigin?: string
  credentials: RequestCredentials
  status?: number
  contentType?: string | null
  ts: number
}

/**
 * Execute a fetch request with Safari-compatible header handling.
 *
 * When DNR is available and the request is POST, the browser's declarative
 * net request rules will set Origin/Referer. Otherwise, the background
 * fetch directly sets them.
 */
export async function requestWithSafariCompat(input: SafariCompatRequestOptions): Promise<Response> {
  const {
    url,
    method,
    headers = {},
    body = null,
    credentials = 'include',
    referer = DEFAULT_REFERER,
    origin = DEFAULT_ORIGIN,
  } = input

  const useDnr = canUseDnrHeaderMode() && method.toUpperCase() === 'POST'

  const finalHeaders: Record<string, string> = { ...headers }
  if (!useDnr) {
    if (!finalHeaders.Referer)
      finalHeaders.Referer = referer
    if (!finalHeaders.Origin)
      finalHeaders.Origin = origin
  }

  return fetch(url, {
    method,
    headers: finalHeaders,
    body,
    credentials,
  })
}
