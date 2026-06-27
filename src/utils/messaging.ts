import browser from 'webextension-polyfill'

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
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
    }
    for (const key of ERROR_WHITELIST) {
      if (key === 'name' || key === 'message')
        continue
      const value = (error as any)[key]
      if (value !== undefined) {
        if (key === 'code') {
          if (typeof value === 'string' || typeof value === 'number')
            serialized.code = value
        }
        else if (key === 'isRiskControl') {
          if (typeof value === 'boolean')
            serialized.isRiskControl = value
        }
        else if (key === 'originalError') {
          if (typeof value === 'string')
            serialized.originalError = value
        }
      }
    }
    return serialized
  }
  return {
    name: 'Error',
    message: String(error),
  }
}

export function deserializeError(serialized: SerializedError): Error {
  const err = new Error(serialized.message)
  err.name = serialized.name || 'Error'
  if (serialized.code !== undefined)
    (err as any).code = serialized.code
  if (serialized.isRiskControl !== undefined)
    (err as any).isRiskControl = serialized.isRiskControl
  if (serialized.originalError !== undefined)
    (err as any).originalError = serialized.originalError
  return err
}

type OnMessageListener = (
  message: any,
  sender: browser.Runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => true

/**
 * 从 content script 发送消息到 background
 * 自动解包 {ok, data/error} 响应格式
 */
export async function sendMessage<T = any, R = any>(type: string, data?: T): Promise<R> {
  const message: Message<T> = { type, data: data as T }
  const response: MessageResponse<R> = await browser.runtime.sendMessage(message)
  if (!response || typeof response !== 'object' || !('ok' in response)) {
    return response as unknown as R
  }
  if (!response.ok) {
    if (!response.error
      || typeof response.error.name !== 'string'
      || typeof response.error.message !== 'string') {
      throw new Error('Malformed messaging error response')
    }
    throw deserializeError(response.error)
  }
  return response.data as R
}

/**
 * 在 background 中监听来自 content script 的消息
 * 使用 return true + sendResponse 模式，兼容 Safari 非持久后台
 */
export function onMessage<T = any, R = any>(
  type: string,
  handler: MessageHandler<T, R>,
): void {
  const listener: OnMessageListener = (message, sender, sendResponse) => {
    if (message?.type !== type)
      return false as unknown as true

    Promise.resolve()
      .then(() => handler(message.data as T, sender))
      .then((data) => {
        sendResponse({ ok: true, data } satisfies MessageResponse)
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: serializeError(error),
        } satisfies MessageResponse)
      })

    return true
  }

  browser.runtime.onMessage.addListener(listener)
}
