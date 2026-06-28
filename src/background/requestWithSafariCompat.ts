const DNR_COVERED_HOSTS: ReadonlySet<string> = new Set([
  'api.bilibili.com',
  'passport.bilibili.com',
])

/**
 * Pure function: determines whether the given request is covered by the
 * static DNR rules in assets/rules.json.
 *
 * Current rules cover POST xmlhttprequest/other requests to
 * api.bilibili.com and passport.bilibili.com (thirdParty). The request
 * resource type is assigned by the browser, so this function mirrors the
 * URL and method portion of that scope.
 */
export function isDnrCoveredRequest(url: string, method: string): boolean {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  }
  catch {
    return false
  }
  return method.toUpperCase() === 'POST' && DNR_COVERED_HOSTS.has(hostname)
}

export interface SafariCompatRequestOptions {
  url: string
  method: string
  headers?: Record<string, string>
  body?: BodyInit | null
  credentials?: RequestCredentials
}

/**
 * Execute a fetch request with Safari-compatible header handling.
 *
 * When DNR covers the request (POST to api/passport.bilibili.com),
 * Origin and Referer are removed from caller headers so the browser-level
 * modifyHeaders rules can set them.
 *
 * For non-DNR requests, Origin is removed because ordinary fetch code cannot
 * reliably set it, while a caller-provided Referer is preserved.
 */
export async function requestWithSafariCompat(input: SafariCompatRequestOptions): Promise<Response> {
  const {
    url,
    method,
    headers: callerHeaders = {},
    body = null,
    credentials = 'include',
  } = input

  // Normalize header keys using Headers API for case-insensitive handling
  const normalizedHeaders = new Headers(callerHeaders)
  const dnrCovered = isDnrCoveredRequest(url, method)

  if (dnrCovered) {
    normalizedHeaders.delete('Origin')
    normalizedHeaders.delete('Referer')
  }
  else {
    normalizedHeaders.delete('Origin')
  }

  // Convert Headers back to plain object for fetch
  const headers: Record<string, string> = {}
  normalizedHeaders.forEach((value, key) => {
    headers[key] = value
  })

  return fetch(url, {
    method,
    headers,
    body,
    credentials,
  })
}
