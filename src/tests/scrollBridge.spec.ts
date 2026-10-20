import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installScrollBridge } from '~/contentScripts/features/scrollBridge'

describe('首页滚动桥', () => {
  let viewport: HTMLElement
  let documentTop: number
  let dispose: () => void
  let scrollViewport: ReturnType<typeof vi.fn>
  let scrollDocument: ReturnType<typeof vi.fn>
  const disconnect = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    documentTop = 1000
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => documentTop)
    scrollDocument = vi.fn(({ top }: ScrollToOptions) => {
      documentTop = top ?? 0
    })
    vi.spyOn(window, 'scrollTo').mockImplementation(scrollDocument)
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect = disconnect
    })
    viewport = document.createElement('div')
    viewport.innerHTML = '<main></main>'
    viewport.scrollTop = documentTop
    Object.defineProperty(viewport, 'scrollHeight', { value: 5000 })
    scrollViewport = vi.fn(({ top }: ScrollToOptions) => {
      viewport.scrollTop = top ?? 0
    })
    viewport.scrollTo = scrollViewport
    document.body.appendChild(viewport)
    dispose = installScrollBridge(viewport)
  })

  afterEach(() => {
    dispose()
    document.body.replaceChildren()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    disconnect.mockClear()
  })

  function scrollOuter(top: number) {
    documentTop = top
    window.dispatchEvent(new Event('scroll'))
  }

  function scrollInner(top: number) {
    viewport.scrollTop = top
    viewport.dispatchEvent(new Event('scroll'))
  }

  it.each(['wheel', 'touchstart'])('收到 %s 后不再让旧文档位置覆盖原生滚动', (input) => {
    scrollOuter(1010)
    expect(viewport.scrollTop).toBe(1010)
    scrollViewport.mockClear()

    viewport.dispatchEvent(new Event(input))
    scrollOuter(1000)
    expect(viewport.scrollTop).toBe(1010)
    scrollInner(1100)
    vi.advanceTimersByTime(150)

    expect(viewport.scrollTop).toBe(1100)
    expect(documentTop).toBe(1100)
    expect(scrollViewport).not.toHaveBeenCalled()
  })

  it('内部滚动可以接管文档驱动，不丢弃后续输入', () => {
    scrollOuter(1010)
    scrollViewport.mockClear()
    scrollInner(1100)
    vi.advanceTimersByTime(150)
    expect(viewport.scrollTop).toBe(1100)
    expect(documentTop).toBe(1100)
    expect(scrollViewport).not.toHaveBeenCalled()
  })

  it('忽略延迟的文档事件，快速反向滚动后不回拉', () => {
    viewport.dispatchEvent(new Event('wheel'))
    scrollInner(1200)
    scrollOuter(1100)
    scrollInner(1050)
    scrollOuter(1200)
    vi.advanceTimersByTime(150)
    expect(viewport.scrollTop).toBe(1050)
    expect(scrollViewport).not.toHaveBeenCalled()
  })

  it('滚动结束只释放控制权，不重复写入任一滚动位置', () => {
    scrollInner(1200)
    scrollDocument.mockClear()
    scrollViewport.mockClear()
    vi.advanceTimersByTime(150)
    expect(scrollDocument).not.toHaveBeenCalled()
    expect(scrollViewport).not.toHaveBeenCalled()
  })

  it('空闲后仍可用外层文档滚动命令连续控制首页', () => {
    scrollInner(1200)
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(150)
    scrollOuter(1600)
    viewport.dispatchEvent(new Event('scroll'))
    scrollOuter(2000)
    viewport.dispatchEvent(new Event('scroll'))
    expect(viewport.scrollTop).toBe(2000)
  })

  it('卸载后移除输入监听、文档占位和待执行定时器', () => {
    viewport.dispatchEvent(new Event('wheel'))
    dispose()
    scrollViewport.mockClear()
    scrollDocument.mockClear()
    viewport.dispatchEvent(new Event('wheel'))
    scrollOuter(1500)
    scrollInner(1600)
    vi.advanceTimersByTime(150)
    expect(scrollViewport).not.toHaveBeenCalled()
    expect(scrollDocument).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(disconnect).toHaveBeenCalledOnce()
    dispose = () => {}
  })
})
