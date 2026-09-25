import browser from 'webextension-polyfill'

import type { ApiPortResponse } from '~/constants/apiRequest'
import { API_REQUEST_PORT } from '~/constants/apiRequest'
import { waitWithSignal } from '~/utils/abort'
import { markBackgroundConnectionHealthy, promptPageRefreshFromContentScript } from '~/utils/refreshPrompt'

export interface Message<T = any> {
  type: string
  data: T
}

export interface SerializedError {
  name: string
  message: string
  code?: string | number
  isRiskControl?: boolean
  originalError?: string
}

interface MessageResponse<R = any> {
  ok: boolean
  data?: R
  error?: SerializedError
}

export type MessageHandler<T = any, R = any> = (
  data: T,
  sender?: browser.Runtime.MessageSender,
) => R | Promise<R>

export const ERROR_WHITELIST: (keyof SerializedError)[] = ['name', 'message', 'code', 'isRiskControl', 'originalError']

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: SerializedError = { name: error.name, message: error.message }
    for (const key of ERROR_WHITELIST) {
      if (key === 'name' || key === 'message')
        continue
      const value = (error as any)[key]
      if (key === 'code' && (typeof value === 'string' || typeof value === 'number'))
        serialized.code = value
      else if (key === 'isRiskControl' && typeof value === 'boolean')
        serialized.isRiskControl = value
      else if (key === 'originalError' && typeof value === 'string')
        serialized.originalError = value
    }
    return serialized
  }
  return { name: 'Error', message: String(error) }
}

export function deserializeError(serialized: SerializedError): Error {
  const error = new Error(serialized.message)
  error.name = serialized.name || 'Error'
  if (serialized.code !== undefined) {
    ;(error as any).code = serialized.code
  }
  if (serialized.isRiskControl !== undefined) {
    ;(error as any).isRiskControl = serialized.isRiskControl
  }
  if (serialized.originalError !== undefined) {
    ;(error as any).originalError = serialized.originalError
  }
  return error
}

const TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS = 3

function getErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).toLowerCase()
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  return getErrorMessage(error).includes('extension context invalidated')
}

export function isBackgroundDisconnectedError(error: unknown): boolean {
  const message = getErrorMessage(error)
  return message.includes('could not establish connection')
    || message.includes('receiving end does not exist')
}

export function isBackgroundUnavailableError(error: unknown): boolean {
  return isExtensionContextInvalidatedError(error) || isBackgroundDisconnectedError(error)
}

function waitForRetry(delay: number) {
  return new Promise<void>(resolve => setTimeout(resolve, delay))
}

/**
 * 从 content script 发送消息到 background
 */
export async function sendMessage<T = any, R = any>(type: string, data?: T): Promise<R> {
  const message: Message<T> = { type, data: data as T }
  let response: MessageResponse<R> | undefined
  let lastError: unknown

  for (let attempt = 0; attempt < TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS; attempt++) {
    try {
      response = await browser.runtime.sendMessage(message) as MessageResponse<R>
      markBackgroundConnectionHealthy()
      lastError = undefined
      break
    }
    catch (error) {
      lastError = error
      if (isExtensionContextInvalidatedError(error)) {
        promptPageRefreshFromContentScript('context-invalidated', attempt + 1)
        throw error
      }
      if (!isBackgroundDisconnectedError(error) || attempt === TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS - 1)
        break
      await waitForRetry(100 * 2 ** attempt)
    }
  }

  if (lastError) {
    if (isBackgroundDisconnectedError(lastError))
      promptPageRefreshFromContentScript('background-unreachable', TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS)
    throw lastError
  }

  if (!response) {
    const error = new Error(`No response from background for message: ${type}`)
    ;(error as any).code = 'ERR_EXTENSION_NO_RESPONSE'
    throw error
  }
  if (typeof response !== 'object' || !('ok' in response)) {
    const error = new Error(`Malformed background response for message: ${type}`)
    ;(error as any).code = 'ERR_EXTENSION_MALFORMED_RESPONSE'
    ;(error as any).originalResponse = response
    throw error
  }
  if (!response.ok) {
    if (!response.error || typeof response.error.name !== 'string' || typeof response.error.message !== 'string')
      throw new Error('Malformed messaging error response')
    throw deserializeError(response.error)
  }
  return response.data as R
}

/** 每个可取消的读取独占一个 Port；关闭 Port 会取消后台请求，也覆盖页面卸载。 */
export async function sendAbortableApiMessage(type: string, data: unknown, signal: AbortSignal): Promise<any> {
  for (let attempt = 0; attempt < TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS; attempt++) {
    signal.throwIfAborted()
    try {
      return await sendApiPortMessage(type, data, signal)
    }
    catch (error) {
      signal.throwIfAborted()
      if (isExtensionContextInvalidatedError(error)) {
        promptPageRefreshFromContentScript('context-invalidated', attempt + 1)
        throw error
      }
      if (!isBackgroundDisconnectedError(error))
        throw error
      if (attempt === TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS - 1) {
        promptPageRefreshFromContentScript('background-unreachable', TRANSIENT_BACKGROUND_MESSAGE_ATTEMPTS)
        throw error
      }
      await waitWithSignal(waitForRetry(100 * 2 ** attempt), signal)
    }
  }
}

function sendApiPortMessage(type: string, data: unknown, signal: AbortSignal): Promise<any> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const port = browser.runtime.connect({ name: API_REQUEST_PORT })
    let settled = false

    function finish(error: unknown, value?: unknown) {
      if (settled)
        return
      settled = true
      signal.removeEventListener('abort', onAbort)
      port.onMessage.removeListener(onResponse)
      port.onDisconnect.removeListener(onDisconnect)
      try {
        port.disconnect()
      }
      catch {
        // 扩展重载时 Port 可能已经失效，仍需结算当前调用。
      }
      if (error)
        reject(error)
      else
        resolve(value)
    }

    function onAbort() {
      finish(signal.reason ?? new DOMException('Request aborted', 'AbortError'))
    }

    function onResponse(message: unknown) {
      const response = message as ApiPortResponse
      if (!response || typeof response.ok !== 'boolean'
        || (!response.ok && typeof response.error?.message !== 'string')) {
        finish(new TypeError('Invalid API response'))
        return
      }
      markBackgroundConnectionHealthy()
      if (response.ok)
        finish(undefined, response.data)
      else
        finish(Object.assign(new Error(response.error.message), response.error))
    }

    function onDisconnect() {
      finish(new Error(port.error?.message || browser.runtime.lastError?.message || 'Could not establish connection to the API request handler'))
    }

    port.onMessage.addListener(onResponse)
    port.onDisconnect.addListener(onDisconnect)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) {
      onAbort()
    }
    else {
      try {
        port.postMessage({ type, data })
      }
      catch (error) {
        finish(error)
      }
    }
  })
}

/**
 * 在 background 中监听来自 content script 的消息
 */
export function onMessage<T = any, R = any>(
  type: string,
  handler: MessageHandler<T, R>,
): void {
  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    if (message?.type !== type)
      return false as unknown as true
    Promise.resolve()
      .then(() => handler(message.data as T, sender))
      .then(data => sendResponse({ ok: true, data } satisfies MessageResponse))
      .catch(error => sendResponse({ ok: false, error: serializeError(error) } satisfies MessageResponse))
    return true
  })
}
