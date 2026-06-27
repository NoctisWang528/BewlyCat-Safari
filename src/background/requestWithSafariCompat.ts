const DNR_COVERED_HOSTS: ReadonlySet<string> = new Set([
  'api.bilibili.com',
  'passport.bilibili.com',
])

/**
 * Pure function: determines whether the given request is covered by the
 * static DNR rules in assets/rules.json.
 *
 * Current rules cover POST xmlhttprequest to api.bilibili.com and
 * passport.bilibili.com (thirdParty). This function mirrors that scope
 * exactly.
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
 * both Origin and Referer are removed from caller headers — DNR rules
 * in assets/rules.json set them at the browser level.
 *
 * For non-DNR requests, Origin is removed (it's a forbidden header
 * that ordinary fetch code cannot reliably set), but caller-provided
 * Referer is preserved.
 *
 * Note: code can only choose the DNR path; it cannot simulate DNR
 * behavior through ordinary fetch. Whether rules actually take effect
 * in Safari requires on-device verification.
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
    // DNR-covered: remove Origin and Referer — let DNR rules set them
    normalizedHeaders.delete('Origin')
    normalizedHeaders.delete('Referer')
  }
  else {
    // Non-DNR: remove Origin (forbidden header), keep Referer if provided
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
