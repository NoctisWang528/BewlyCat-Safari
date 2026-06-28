import type { API_COLLECTION } from '~/background/messageListeners/api'
import { settings } from '~/logic'
import { sendMessage } from '~/utils/messaging'
import { isPageNoCookieSearchMethod, requestPageNoCookieSearch } from '~/utils/pageNoCookieSearch'
import { isPageWatchLaterMethod, requestPageWatchLater } from '~/utils/pageWatchLater'

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : Lowercase<S>

type APIFunction<T = typeof API_COLLECTION> = {
  [K in keyof T as CamelCase<string & K>]: {
    // @ts-expect-error allow params
    [P in keyof T[K]]: T[K][P] extends (...args: any[]) => any ? T[K][P] : Lowercase<T[K][P]['_fetch']['method']> extends 'get' ? (options?: Partial<T[K][P]['params']>) => Promise<any> : (options?: Partial<T[K][P]['params'] & T[K][P]['_fetch']['body']>) => Promise<any>
  }
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export interface APIClient extends APIFunction<typeof API_COLLECTION> {

}

export function shouldUsePageWatchLater(
  namespace: PropertyKey,
  method: PropertyKey,
  isSafari: boolean,
): method is 'saveToWatchLater' | 'removeFromWatchLater' {
  return isSafari && namespace === 'watchlater' && isPageWatchLaterMethod(method)
}

function assertApiResponse(value: unknown, namespace: string | symbol, method: string | symbol) {
  if (!value || typeof value !== 'object') {
    const err = new Error(`Invalid API response from ${String(namespace)}.${String(method)}: response is ${value}`)
    ;(err as any).code = 'ERR_INVALID_API_RESPONSE'
    throw err
  }

  if (!('code' in value)) {
    const err = new Error(`Invalid API response from ${String(namespace)}.${String(method)}: missing code`)
    ;(err as any).code = 'ERR_INVALID_API_RESPONSE'
    ;(err as any).response = value
    throw err
  }

  return value
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class APIClient {
  private readonly cache = new Map<string | symbol, any>()

  // eslint-disable-next-line node/prefer-global/process
  constructor(useSafariPageWatchLater = Boolean(process.env.SAFARI)) {
    // @ts-expect-error ignore
    return new Proxy({}, {
      get: (_, namespace) => { // namespace
        if (this.cache.has(namespace)) {
          return this.cache.get(namespace)
        }
        else {
          const api = new Proxy({}, {
            get(_, p) {
              return (options?: object) => {
                if (shouldUsePageWatchLater(namespace, p, useSafariPageWatchLater)) {
                  return requestPageWatchLater(p, options as Record<string, unknown> | undefined)
                    .then(response => assertApiResponse(response, namespace, p))
                }

                if (
                  namespace === 'search'
                  && typeof p === 'string'
                  && settings.value.depersonalizeSearchResults
                  && isPageNoCookieSearchMethod(p)
                ) {
                  return requestPageNoCookieSearch(p, options as Record<string, unknown> | undefined)
                }

                const message: Record<string, any> = {
                  contentScriptQuery: p as string,
                  ...options,
                }

                return sendMessage(p as string, message)
                  .then(response => assertApiResponse(response, namespace, p))
              }
            },
          })
          this.cache.set(namespace, api)
          return api
        }
      },
    })
  }
}

const api = new APIClient()

export default api
