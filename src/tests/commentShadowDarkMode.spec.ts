import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  COMMENT_SHADOW_DARK_STYLE_ID,
  installCommentShadowDarkMode,
} from '~/inject/commentShadowDarkMode'

type CommentTestWindow = Window & typeof globalThis

function createTargetWindow() {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  return {
    iframe,
    target: iframe.contentWindow! as CommentTestWindow,
  }
}

function setBewlyTheme(target: CommentTestWindow, theme: 'dark' | 'light') {
  target.document.documentElement.classList.add('bewly-design')
  target.document.documentElement.classList.toggle('dark', theme === 'dark')
}

function defineCommentRoot(
  target: CommentTestWindow,
  options: {
    resetThemeDuringUpdate?: boolean
    withLegacyStyles?: boolean
  } = {},
) {
  class TestCommentRoot extends target.HTMLElement {
    theme = 'light'
    updateCount = 0

    update() {
      this.updateCount++
      if (options.resetThemeDuringUpdate)
        this.theme = 'light'

      const root = this.shadowRoot || this.attachShadow({ mode: 'open' })
      if (options.withLegacyStyles) {
        root.innerHTML = `
          <style id="${COMMENT_SHADOW_DARK_STYLE_ID}">:host { color: #18191c; }</style>
          <bili-rich-text></bili-rich-text>
        `
        const richText = root.querySelector('bili-rich-text')!
        const nestedRoot = richText.attachShadow({ mode: 'open' })
        nestedRoot.innerHTML = `<style id="${COMMENT_SHADOW_DARK_STYLE_ID}">:host { color: #18191c; }</style>`
      }
      return 'updated'
    }
  }

  target.customElements.define('bili-comments', TestCommentRoot as CustomElementConstructor)
  return TestCommentRoot
}

async function flushCommentThemeSync() {
  await new Promise<void>(resolve => queueMicrotask(resolve))
  await new Promise<void>(resolve => queueMicrotask(resolve))
}

async function waitForMutationObserver() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await flushCommentThemeSync()
}

describe('comment shadow dark mode', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach(iframe => iframe.remove())
    vi.restoreAllMocks()
  })

  it('synchronizes an already-rendered comment root to the initial dark theme', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'dark')
    const CommentRoot = defineCommentRoot(target)
    const root = new CommentRoot()
    target.document.body.appendChild(root)
    root.update()

    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()

    expect(root.theme).toBe('dark')
    expect(root.getAttribute('data-bewly-comment-lit-theme')).toBe('dark')
  })

  it('patches a late-defined root, preserves update results and coalesces theme repair', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'dark')
    installCommentShadowDarkMode(target)

    const CommentRoot = defineCommentRoot(target, { resetThemeDuringUpdate: true })
    await flushCommentThemeSync()

    const root = new CommentRoot()
    target.document.body.appendChild(root)
    expect(root.update()).toBe('updated')
    expect(root.update()).toBe('updated')
    expect(root.theme).toBe('light')

    await flushCommentThemeSync()

    expect(root.updateCount).toBe(2)
    expect(root.theme).toBe('dark')
  })

  it('applies the current theme to comment roots added after initialization', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'dark')
    const CommentRoot = defineCommentRoot(target)
    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()

    const firstRoot = new CommentRoot()
    target.document.body.appendChild(firstRoot)
    firstRoot.update()
    await flushCommentThemeSync()

    const replacementRoot = new CommentRoot()
    firstRoot.replaceWith(replacementRoot)
    replacementRoot.update()
    await waitForMutationObserver()

    expect(firstRoot.theme).toBe('dark')
    expect(replacementRoot.theme).toBe('dark')
  })

  it('tracks dark and light class changes without DOM theme events', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'light')
    const CommentRoot = defineCommentRoot(target)
    const root = new CommentRoot()
    target.document.body.appendChild(root)
    root.update()
    const globalThemeListener = vi.fn()
    target.addEventListener('global.themeChange', globalThemeListener)

    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()
    expect(root.theme).toBe('light')

    target.document.documentElement.classList.add('dark')
    await waitForMutationObserver()
    expect(root.theme).toBe('dark')

    target.document.documentElement.classList.remove('dark')
    await waitForMutationObserver()
    expect(root.theme).toBe('light')
    expect(globalThemeListener).not.toHaveBeenCalled()
  })

  it('removes legacy recursive styles from existing open shadow roots', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'dark')
    const CommentRoot = defineCommentRoot(target, { withLegacyStyles: true })
    const root = new CommentRoot()
    target.document.body.appendChild(root)
    root.update()

    expect(root.shadowRoot!.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)).toBeTruthy()
    expect(root.shadowRoot!.querySelector('bili-rich-text')!.shadowRoot!
      .querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)).toBeTruthy()

    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()

    expect(root.shadowRoot!.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)).toBeNull()
    expect(root.shadowRoot!.querySelector('bili-rich-text')!.shadowRoot!
      .querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)).toBeNull()
  })

  it('releases theme control when BewlyCat styling is disabled', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'dark')
    const CommentRoot = defineCommentRoot(target)
    const root = new CommentRoot()
    target.document.body.appendChild(root)
    root.update()

    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()
    expect(root.theme).toBe('dark')

    target.document.documentElement.classList.remove('bewly-design')
    await waitForMutationObserver()

    expect(root.theme).toBe('light')
    expect(root.hasAttribute('data-bewly-comment-lit-theme')).toBe(false)
  })

  it('does not override an independently dark Bilibili page when control is released', async () => {
    const { target } = createTargetWindow()
    setBewlyTheme(target, 'dark')
    const CommentRoot = defineCommentRoot(target)
    const root = new CommentRoot()
    target.document.body.appendChild(root)
    root.update()

    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()
    target.document.documentElement.classList.add('bili_dark')
    target.document.documentElement.classList.remove('bewly-design')
    await waitForMutationObserver()

    expect(root.theme).toBe('dark')
    expect(root.hasAttribute('data-bewly-comment-lit-theme')).toBe(false)
  })

  it('isolates theme synchronization failures from Bilibili updates', async () => {
    const { target } = createTargetWindow()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setBewlyTheme(target, 'dark')

    class FailingCommentRoot extends target.HTMLElement {
      get theme() {
        return 'light'
      }

      set theme(_value: string) {
        throw new Error('theme assignment failed')
      }

      update() {
        return 'updated'
      }
    }

    target.customElements.define('bili-comments', FailingCommentRoot as CustomElementConstructor)
    installCommentShadowDarkMode(target)
    await flushCommentThemeSync()
    const root = new FailingCommentRoot()
    target.document.body.appendChild(root)

    expect(root.update()).toBe('updated')
    await flushCommentThemeSync()

    expect(warning).toHaveBeenCalledWith(
      '[BewlyCat] Failed to synchronize the Bilibili comment theme.',
      expect.any(Error),
    )
  })
})
