import browser from 'webextension-polyfill'

export interface Message<T = any> {
  type: string
  data: T
}

interface MessageResponse<R = any> {
  ok: boolean
  data?: R
  error?: {
    name: string
    message: string
  }
}

export type MessageHandler<T = any, R = any> = (
  data: T,
  sender?: browser.Runtime.MessageSender,
) => R | Promise<R>

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
    const err = new Error(response.error?.message || 'Unknown messaging error')
    err.name = response.error?.name || 'Error'
    throw err
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
          error: {
            name: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
          },
        } satisfies MessageResponse)
      })

    return true
  }

  browser.runtime.onMessage.addListener(listener)
}
