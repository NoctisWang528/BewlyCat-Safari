import { afterEach, describe, expect, it, vi } from 'vitest'

import { DARK_MODE_BASE_COLOR_CHANGE } from '~/constants/globalEvents'
import {
  applyCommentThemePalette,
  clearCommentThemePalette,
  COMMENT_THEME_CONTROL_ATTR,
  COMMENT_THEME_OWNED_PROPERTIES,
  installCommentThemeTokens,
} from '~/contentScripts/commentThemeTokens'

type CommentTestWindow = Window & typeof globalThis

const DARK_PALETTE = {
  '--text1': 'rgb(242, 243, 245)',
  '--text2': 'rgba(213, 216, 221, 0.9)',
  '--text3': 'rgba(184, 188, 194, 0.75)',
  '--text4': 'rgba(156, 161, 169, 0.55)',
  '--text_link': 'rgb(64, 197, 241)',
  '--bg1': 'rgb(34, 36, 40)',
  '--bg2': 'rgb(48, 50, 54)',
  '--bg3': 'rgb(52, 54, 58)',
  '--bg1_float': 'rgb(52, 54, 58)',
  '--bg2_float': 'rgb(52, 54, 58)',
  '--graph_bg_thin': 'rgb(41, 43, 47)',
  '--graph_bg_regular': 'rgb(48, 50, 54)',
  '--graph_bg_thick': 'rgb(76, 78, 82)',
  '--graph_weak': 'rgba(131, 131, 145, 0.16)',
  '--line_light': 'rgba(131, 131, 145, 0.1)',
  '--line_regular': 'rgba(131, 131, 145, 0.2)',
  '--Ga1': 'rgba(131, 131, 145, 0.16)',
  '--brand_blue': 'rgb(0, 174, 236)',
  '--brand_blue_thin': 'rgba(0, 174, 236, 0.2)',
  '--Lb4': 'rgb(0, 148, 201)',
  '--Lb6': 'rgb(64, 197, 241)',
  '--Pi1': 'rgb(255, 236, 241)',
  '--Pi5': 'rgb(255, 102, 153)',
  '--Pi10_u': 'rgb(242, 243, 245)',
  '--Ye5_u': 'rgb(255, 179, 0)',
  '--bg1_rgb': '34, 36, 40',
}

function createTargetWindow() {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  return {
    iframe,
    target: iframe.contentWindow! as CommentTestWindow,
  }
}

function enableDarkBewlyTheme(target: CommentTestWindow) {
  target.document.documentElement.classList.add('dark', 'bewly-design')
}

function createCommentRoot(target: CommentTestWindow) {
  const root = target.document.createElement('bili-comments')
  target.document.body.appendChild(root)
  return root
}

async function flushThemeTokens() {
  await new Promise<void>(resolve => queueMicrotask(resolve))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('comment theme tokens', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach(iframe => iframe.remove())
    vi.restoreAllMocks()
  })

  it('writes resolved dark tokens to the root host with inline important priority', () => {
    const { target } = createTargetWindow()
    const root = createCommentRoot(target)
    const setProperty = vi.spyOn(root.style, 'setProperty')

    applyCommentThemePalette(root, DARK_PALETTE)

    expect(root.getAttribute(COMMENT_THEME_CONTROL_ATTR)).toBe('dark')
    Object.entries(DARK_PALETTE).forEach(([property, value]) => {
      expect(root.style.getPropertyValue(property), property).toBe(value)
      expect(setProperty, property).toHaveBeenCalledWith(property, value, 'important')
    })
  })

  it('covers text, icon, divider, background, editor and nested-reply tokens', () => {
    expect(DARK_PALETTE).toMatchObject({
      '--text1': expect.any(String),
      '--text3': expect.any(String),
      '--graph_weak': expect.any(String),
      '--line_regular': expect.any(String),
      '--bg1': expect.any(String),
      '--bg3': expect.any(String),
      '--Ga1': expect.any(String),
      '--bg1_rgb': expect.any(String),
    })
  })

  it('removes only the properties owned by BewlyCat when light mode is restored', () => {
    const { target } = createTargetWindow()
    const root = createCommentRoot(target)
    root.style.setProperty('--unrelated-token', 'keep')
    applyCommentThemePalette(root, DARK_PALETTE)

    clearCommentThemePalette(root)

    COMMENT_THEME_OWNED_PROPERTIES.forEach((property) => {
      expect(root.style.getPropertyValue(property), property).toBe('')
    })
    expect(root.style.getPropertyValue('--unrelated-token')).toBe('keep')
    expect(root.hasAttribute(COMMENT_THEME_CONTROL_ATTR)).toBe(false)
  })

  it('applies the initial dark palette and clears it after a light-mode switch', async () => {
    const { target } = createTargetWindow()
    enableDarkBewlyTheme(target)
    const root = createCommentRoot(target)
    const resolvePalette = vi.fn(() => DARK_PALETTE)

    installCommentThemeTokens(target, resolvePalette)
    await flushThemeTokens()
    expect(root.style.getPropertyValue('--text1')).toBe(DARK_PALETTE['--text1'])

    target.document.documentElement.classList.remove('dark')
    await flushThemeTokens()

    expect(root.style.getPropertyValue('--text1')).toBe('')
    expect(root.hasAttribute(COMMENT_THEME_CONTROL_ATTR)).toBe(false)
  })

  it('styles comment roots mounted or replaced after initialization', async () => {
    const { target } = createTargetWindow()
    enableDarkBewlyTheme(target)
    installCommentThemeTokens(target, () => DARK_PALETTE)
    await flushThemeTokens()

    const firstRoot = createCommentRoot(target)
    await flushThemeTokens()
    expect(firstRoot.style.getPropertyValue('--bg3')).toBe(DARK_PALETTE['--bg3'])

    const replacementRoot = target.document.createElement('bili-comments')
    firstRoot.replaceWith(replacementRoot)
    await flushThemeTokens()
    expect(replacementRoot.style.getPropertyValue('--text3')).toBe(DARK_PALETTE['--text3'])
  })

  it('re-resolves the palette when the dark base color changes', async () => {
    const { target } = createTargetWindow()
    enableDarkBewlyTheme(target)
    const root = createCommentRoot(target)
    const updatedPalette = {
      ...DARK_PALETTE,
      '--bg1': 'rgb(20, 22, 26)',
    }
    const resolvePalette = vi.fn()
      .mockReturnValueOnce(DARK_PALETTE)
      .mockReturnValue(updatedPalette)

    installCommentThemeTokens(target, resolvePalette)
    await flushThemeTokens()
    target.dispatchEvent(new target.CustomEvent(DARK_MODE_BASE_COLOR_CHANGE))
    await flushThemeTokens()

    expect(resolvePalette).toHaveBeenCalledTimes(2)
    expect(root.style.getPropertyValue('--bg1')).toBe(updatedPalette['--bg1'])
  })

  it('does not override native comments unless both dark and Bewly design are active', async () => {
    const { target } = createTargetWindow()
    target.document.documentElement.classList.add('dark')
    const root = createCommentRoot(target)
    const resolvePalette = vi.fn(() => DARK_PALETTE)

    installCommentThemeTokens(target, resolvePalette)
    await flushThemeTokens()

    expect(resolvePalette).not.toHaveBeenCalled()
    expect(root.getAttribute('style')).toBeNull()
  })
})
