import { getVideoElement, setPlaybackRate } from '~/utils/player'
import type { BilibiliTabRequest } from '~/utils/settingsPage'
import { BILIBILI_TAB_REQUEST_MESSAGE } from '~/utils/settingsPage'

function handleRequest(request: BilibiliTabRequest) {
  if (request.action === 'applyPlaybackRate') {
    const video = getVideoElement()
    return video && setPlaybackRate(request.rate, video) ? true : undefined
  }

  return getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || undefined
}

/** 设置页是独立标签页，播放器和第三方主题等页面状态由这里代为操作。 */
export function setupSettingsPageBridge() {
  browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    if (message?.type !== BILIBILI_TAB_REQUEST_MESSAGE)
      return false as unknown as true

    // 同一标签页的多个框架都会收到；只有能处理的框架才应答。
    const result = handleRequest(message.data)
    if (result === undefined)
      return false as unknown as true
    sendResponse(result)
    return true
  })
}
