/**
 * 将自定义首页滚动位置映射到文档，兼容以 document.scrollingElement 为目标的快捷键。
 * 原生滚动输入优先，文档镜像事件不能反向覆盖正在滚动的视口。
 */
export function installScrollBridge(viewport: HTMLElement): () => void {
  const previousScrollbarWidth = document.documentElement.style.scrollbarWidth
  document.documentElement.style.scrollbarWidth = 'none'

  const spacer = document.createElement('div')
  spacer.setAttribute('aria-hidden', 'true')
  Object.assign(spacer.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '1px',
    pointerEvents: 'none',
    visibility: 'hidden',
  })
  document.body.appendChild(spacer)

  let mirroredDocumentTop: number | null = null
  let scrollDriver: 'document' | 'viewport' | null = null
  let releaseDriverTimer: ReturnType<typeof setTimeout> | undefined

  function keepScrollDriver(driver: 'document' | 'viewport') {
    scrollDriver = driver
    clearTimeout(releaseDriverTimer)
    releaseDriverTimer = setTimeout(() => {
      // 这里只释放控制权；再次写入位置会打断 Safari 的惯性滚动或拉回旧位置。
      scrollDriver = null
      mirroredDocumentTop = null
    }, 150)
  }

  function updateDocumentHeight() {
    spacer.style.height = `${viewport.scrollHeight}px`
  }

  function handleDocumentScroll() {
    const top = window.scrollY
    if (Math.abs(viewport.scrollTop - top) < 1)
      return

    // 原生视口优先；旧镜像回声也必须同步到当前视口，不能留下过期位置。
    if (scrollDriver === 'viewport') {
      mirrorViewportToDocument()
      return
    }

    if (mirroredDocumentTop !== null && Math.abs(mirroredDocumentTop - top) < 1) {
      mirroredDocumentTop = null
      return
    }

    mirroredDocumentTop = null
    keepScrollDriver('document')
    viewport.scrollTo({ top, behavior: 'instant' })
  }

  function mirrorViewportToDocument() {
    const top = viewport.scrollTop
    if (Math.abs(window.scrollY - top) < 1)
      return
    mirroredDocumentTop = top
    window.scrollTo({ top, behavior: 'instant' })
  }

  function handleViewportScroll() {
    if (Math.abs(window.scrollY - viewport.scrollTop) < 1)
      return
    keepScrollDriver('viewport')
    mirrorViewportToDocument()
  }

  function handleViewportInput() {
    // 在首个 scroll 事件之前接管，避免旧文档事件抢先覆盖新的滚轮方向。
    keepScrollDriver('viewport')
  }

  const resizeObserver = new ResizeObserver(updateDocumentHeight)
  resizeObserver.observe(viewport)
  const content = viewport.querySelector('main')
  if (content)
    resizeObserver.observe(content)

  updateDocumentHeight()
  window.addEventListener('scroll', handleDocumentScroll, { passive: true })
  viewport.addEventListener('scroll', handleViewportScroll, { passive: true })
  viewport.addEventListener('wheel', handleViewportInput, { passive: true })
  viewport.addEventListener('touchstart', handleViewportInput, { passive: true })

  return () => {
    resizeObserver.disconnect()
    window.removeEventListener('scroll', handleDocumentScroll)
    viewport.removeEventListener('scroll', handleViewportScroll)
    viewport.removeEventListener('wheel', handleViewportInput)
    viewport.removeEventListener('touchstart', handleViewportInput)
    clearTimeout(releaseDriverTimer)
    spacer.remove()
    document.documentElement.style.scrollbarWidth = previousScrollbarWidth
    if (window.scrollY)
      window.scrollTo({ top: 0, behavior: 'instant' })
  }
}
