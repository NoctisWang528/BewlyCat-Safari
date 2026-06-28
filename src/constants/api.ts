export const PAGE_NO_COOKIE_SEARCH_REQUEST = 'BEWLY_PAGE_NO_COOKIE_SEARCH_REQUEST'
export const PAGE_NO_COOKIE_SEARCH_RESPONSE = 'BEWLY_PAGE_NO_COOKIE_SEARCH_RESPONSE'

export const PAGE_WATCH_LATER_REQUEST = 'BEWLY_PAGE_WATCH_LATER_REQUEST'
export const PAGE_WATCH_LATER_RESPONSE = 'BEWLY_PAGE_WATCH_LATER_RESPONSE'

export type PageWatchLaterMethod = 'saveToWatchLater' | 'removeFromWatchLater'

export interface PageWatchLaterParams {
  aid?: number
  bvid?: string
  viewed?: boolean
}

export interface PageWatchLaterRequestData {
  id: string
  method: PageWatchLaterMethod
  params: PageWatchLaterParams
}

export interface PageWatchLaterError {
  name: string
  message: string
  code?: string | number
  isRiskControl?: boolean
}

export interface PageWatchLaterResponseData {
  id: string
  response?: unknown
  error?: PageWatchLaterError
}
