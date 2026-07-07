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

function defineCommentElement(
  target: CommentTestWindow,
  name: string,
  html = '<div id="contents">comment <a class="bili-rich-text-link">link</a></div>',
) {
  class TestCommentElement extends target.HTMLElement {
    update() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' })
      root.innerHTML = html
      return 'updated'
    }
  }

  target.customElements.define(name, TestCommentElement as CustomElementConstructor)
  return TestCommentElement
}

async function waitForMutationObserver() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('comment shadow dark mode', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach(iframe => iframe.remove())
    vi.restoreAllMocks()
  })

  it('patches comment elements that are defined after installation', () => {
    const { target } = createTargetWindow()

    installCommentShadowDarkMode(target)
    defineCommentElement(target, 'bili-rich-text')

    const element = target.document.createElement('bili-rich-text') as any
    target.document.body.appendChild(element)
    expect(element.update()).toBe('updated')

    const style = element.shadowRoot.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`) as HTMLStyleElement
    expect(style).toBeTruthy()
    expect(style.textContent).toContain('color: var(--bew-text-1')
    expect(style.textContent).toContain('--bili-rich-text-link-color: var(--bew-theme-color')
    expect(style.textContent).toContain('.bili-rich-text-link')
  })

  it('patches comment elements that are already defined', () => {
    const { target } = createTargetWindow()

    defineCommentElement(target, 'bili-comment-renderer', '<div id="body"><span class="content">comment</span></div>')
    installCommentShadowDarkMode(target)

    const element = target.document.createElement('bili-comment-renderer') as any
    target.document.body.appendChild(element)
    element.update()

    const style = element.shadowRoot.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`) as HTMLStyleElement
    expect(style?.textContent).toContain('#body')
    expect(style?.textContent).toContain('.content')
  })

  it('does not inject duplicate shadow styles on repeated updates', () => {
    const { target } = createTargetWindow()

    installCommentShadowDarkMode(target)
    defineCommentElement(target, 'bili-comment-user-info', '<div id="user-name"><a>user</a></div>')

    const element = target.document.createElement('bili-comment-user-info') as any
    target.document.body.appendChild(element)
    element.update()
    element.update()

    expect(element.shadowRoot.querySelectorAll(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)).toHaveLength(1)
  })

  it('keeps the vote card text color fix inside the shared shadow style', () => {
    const { target } = createTargetWindow()

    installCommentShadowDarkMode(target)
    defineCommentElement(target, 'bili-comments-vote-card')

    const element = target.document.createElement('bili-comments-vote-card') as any
    target.document.body.appendChild(element)
    element.update()

    const style = element.shadowRoot.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`) as HTMLStyleElement
    expect(style.textContent).toContain('--option-color: var(--bew-text-1')
  })

  it('dispatches page-world theme changes when html dark state changes', async () => {
    const { target } = createTargetWindow()
    const listener = vi.fn()
    target.addEventListener('global.themeChange', listener)

    installCommentShadowDarkMode(target)
    target.document.documentElement.classList.add('dark')
    await waitForMutationObserver()

    expect(listener).toHaveBeenCalledOnce()
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe('dark')
  })
})
