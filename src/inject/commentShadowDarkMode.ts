export const COMMENT_SHADOW_DARK_STYLE_ID = 'bewly-comment-dark-style'

const COMMENT_DEFINE_PATCH_MARK = Symbol.for('bewly.commentShadowDarkMode.definePatched')
const COMMENT_UPDATE_PATCH_MARK = Symbol.for('bewly.commentShadowDarkMode.updatePatched')
const COMMENT_THEME_OBSERVER_MARK = Symbol.for('bewly.commentShadowDarkMode.themeObserverInstalled')

type CommentWindow = Window & typeof globalThis

const COMMENT_ELEMENT_NAMES = [
  'bili-comment-renderer',
  'bili-rich-text',
  'bili-comment-user-info',
  'bili-comment-action-buttons-renderer',
  'bili-comment-box',
  'bili-comments-vote-card',
] as const

type CommentElementName = typeof COMMENT_ELEMENT_NAMES[number]

interface CommentElementPrototype {
  update?: (...args: any[]) => any
  [COMMENT_UPDATE_PATCH_MARK]?: boolean
}

interface CommentElementConstructor {
  prototype?: CommentElementPrototype
}

interface PatchedCustomElementRegistry extends CustomElementRegistry {
  [COMMENT_DEFINE_PATCH_MARK]?: boolean
}

type ThemeObserverWindow = CommentWindow & {
  [COMMENT_THEME_OBSERVER_MARK]?: boolean
}

function getCommentShadowStyle(name: CommentElementName) {
  const voteCardStyle = name === 'bili-comments-vote-card'
    ? `
      :host {
        --option-color: var(--bew-text-1, #f1f2f3) !important;
      }
    `
    : ''

  return `
    :host {
      color: var(--bew-text-1, #f1f2f3) !important;
      color-scheme: inherit;
      --bili-comment-tag-color: var(--bew-text-2, #c9ccd0) !important;
      --bili-comment-tag-bg: var(--bew-fill-1, rgba(255, 255, 255, 0.08)) !important;
      --bili-rich-text-link-color: var(--bew-theme-color, #00aeec) !important;
      --bili-rich-text-link-color-hover: var(--bew-theme-color-80, #40c5f1) !important;
    }

    :host,
    #body,
    #content,
    #contents,
    #main,
    #pub,
    #user-name,
    .content,
    .reply-content,
    .sub-reply-content,
    .text,
    .name,
    .title {
      color: var(--bew-text-1, #f1f2f3) !important;
    }

    .time,
    .location,
    .operation,
    .sub-reply,
    .reply-info,
    .reply-time,
    .reply-count,
    .count,
    .desc,
    .secondary {
      color: var(--bew-text-3, #9499a0) !important;
    }

    a,
    .link,
    .bili-rich-text-link,
    [class*="link"] {
      color: var(--bew-theme-color, #00aeec) !important;
    }

    a:hover,
    .link:hover,
    .bili-rich-text-link:hover,
    [class*="link"]:hover {
      color: var(--bew-theme-color-80, #40c5f1) !important;
    }

    .tag,
    .tag[style],
    [class*="tag"] {
      color: var(--bew-text-2, #c9ccd0) !important;
      background-color: var(--bew-fill-1, rgba(255, 255, 255, 0.08)) !important;
    }

    input,
    textarea,
    [contenteditable="true"] {
      color: var(--bew-text-1, #f1f2f3) !important;
      caret-color: var(--bew-theme-color, #00aeec);
    }

    ${voteCardStyle}
  `
}

function injectCommentShadowStyle(root: ShadowRoot, name: CommentElementName) {
  if (root.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`))
    return

  const style = root.ownerDocument.createElement('style')
  style.id = COMMENT_SHADOW_DARK_STYLE_ID
  style.textContent = getCommentShadowStyle(name)
  root.appendChild(style)
}

export function patchCommentShadowElement(name: string, classConstructor: unknown) {
  if (!COMMENT_ELEMENT_NAMES.includes(name as CommentElementName))
    return false
  if (typeof classConstructor !== 'function')
    return false

  const prototype = (classConstructor as CommentElementConstructor).prototype
  if (!prototype || typeof prototype.update !== 'function')
    return false
  if (prototype[COMMENT_UPDATE_PATCH_MARK])
    return true

  const originalUpdate = prototype.update
  prototype.update = function (...args: any[]) {
    const result = originalUpdate.apply(this, args)
    const root = (this as { shadowRoot?: ShadowRoot | null }).shadowRoot
    if (root)
      injectCommentShadowStyle(root, name as CommentElementName)
    return result
  }
  prototype[COMMENT_UPDATE_PATCH_MARK] = true
  return true
}

export function dispatchBewlyCommentThemeChange(targetWindow: CommentWindow = window) {
  const theme = targetWindow.document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  targetWindow.dispatchEvent(new targetWindow.CustomEvent('global.themeChange', { detail: theme }))
}

function installCommentThemeObserver(targetWindow: ThemeObserverWindow) {
  if (targetWindow[COMMENT_THEME_OBSERVER_MARK])
    return
  if (!targetWindow.MutationObserver)
    return

  let lastThemeSignature = [
    targetWindow.document.documentElement.classList.contains('dark'),
    targetWindow.document.documentElement.classList.contains('bewly-design'),
  ].join(':')

  const observer = new targetWindow.MutationObserver(() => {
    const nextThemeSignature = [
      targetWindow.document.documentElement.classList.contains('dark'),
      targetWindow.document.documentElement.classList.contains('bewly-design'),
    ].join(':')

    if (nextThemeSignature === lastThemeSignature)
      return

    lastThemeSignature = nextThemeSignature
    dispatchBewlyCommentThemeChange(targetWindow)
  })

  observer.observe(targetWindow.document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  targetWindow[COMMENT_THEME_OBSERVER_MARK] = true
}

export function installCommentShadowDarkMode(targetWindow: CommentWindow = window) {
  const registry = targetWindow.customElements as PatchedCustomElementRegistry | undefined
  if (!registry)
    return

  installCommentThemeObserver(targetWindow)

  COMMENT_ELEMENT_NAMES.forEach((name) => {
    const existingConstructor = registry.get(name)
    if (existingConstructor)
      patchCommentShadowElement(name, existingConstructor)
  })

  if (registry[COMMENT_DEFINE_PATCH_MARK])
    return

  const originalDefine = registry.define
  registry.define = new Proxy(originalDefine, {
    apply(target, thisArg, args: Parameters<CustomElementRegistry['define']>) {
      const [name, classConstructor] = args
      patchCommentShadowElement(name, classConstructor)
      return Reflect.apply(target, thisArg, args)
    },
  })
  registry[COMMENT_DEFINE_PATCH_MARK] = true
}
