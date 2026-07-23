export const COMMENT_SHADOW_DARK_STYLE_ID = 'bewly-comment-dark-style'

const COMMENT_UPDATE_PATCH_MARK = Symbol.for('bewly.commentShadowDarkMode.updatePatched')
const COMMENT_THEME_OBSERVER_MARK = Symbol.for('bewly.commentShadowDarkMode.themeObserverInstalled')
const COMMENT_THEME_CONTROL_ATTR = 'data-bewly-comment-lit-theme'
const COMMENT_ROOT_NAME = 'bili-comments'

const pendingCommentThemeSync = new WeakSet<object>()

type CommentWindow = Window & typeof globalThis

interface CommentRootElement extends HTMLElement {
  theme?: string
}

interface CommentElementPrototype {
  update?: (...args: any[]) => any
  [COMMENT_UPDATE_PATCH_MARK]?: true
}

interface CommentElementConstructor {
  prototype?: CommentElementPrototype
}

type ThemeObserverWindow = CommentWindow & {
  [COMMENT_THEME_OBSERVER_MARK]?: boolean
}

function getBewlyTheme(targetWindow: CommentWindow) {
  const classes = targetWindow.document.documentElement.classList
  if (!classes.contains('bewly-design'))
    return null
  return classes.contains('dark') ? 'dark' : 'light'
}

function removeLegacyCommentStyles(root: Document | ShadowRoot) {
  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const shadowRoot = element.shadowRoot
    if (!shadowRoot)
      return

    shadowRoot.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)?.remove()
    removeLegacyCommentStyles(shadowRoot)
  })
}

function syncCommentRootTheme(root: CommentRootElement, targetWindow: CommentWindow) {
  root.shadowRoot?.querySelector(`#${COMMENT_SHADOW_DARK_STYLE_ID}`)?.remove()
  if (root.shadowRoot)
    removeLegacyCommentStyles(root.shadowRoot)

  const theme = getBewlyTheme(targetWindow)
  if (theme === null) {
    if (root.hasAttribute(COMMENT_THEME_CONTROL_ATTR)) {
      root.removeAttribute(COMMENT_THEME_CONTROL_ATTR)
      if (
        !targetWindow.document.documentElement.classList.contains('bili_dark')
        && root.theme !== 'light'
      ) {
        root.theme = 'light'
      }
    }
    return
  }

  root.setAttribute(COMMENT_THEME_CONTROL_ATTR, theme)
  if (root.theme !== theme)
    root.theme = theme
}

function scheduleCommentRootThemeSync(root: CommentRootElement, targetWindow: CommentWindow) {
  if (pendingCommentThemeSync.has(root))
    return

  pendingCommentThemeSync.add(root)
  targetWindow.queueMicrotask(() => {
    pendingCommentThemeSync.delete(root)
    try {
      syncCommentRootTheme(root, targetWindow)
    }
    catch (error) {
      console.warn('[BewlyCat] Failed to synchronize the Bilibili comment theme.', error)
    }
  })
}

export function patchCommentRootElement(
  classConstructor: unknown,
  targetWindow: CommentWindow = window,
) {
  if (typeof classConstructor !== 'function')
    return false

  const prototype = (classConstructor as CommentElementConstructor).prototype
  if (!prototype || typeof prototype.update !== 'function')
    return false
  if (prototype[COMMENT_UPDATE_PATCH_MARK])
    return true

  const originalUpdate = prototype.update
  const patchedUpdate = function (this: CommentRootElement, ...args: any[]) {
    const result = Reflect.apply(originalUpdate, this, args)
    scheduleCommentRootThemeSync(this, targetWindow)
    return result
  }

  Object.defineProperty(prototype, 'update', {
    configurable: true,
    writable: true,
    value: patchedUpdate,
  })
  Object.defineProperty(prototype, COMMENT_UPDATE_PATCH_MARK, {
    configurable: true,
    value: true,
  })
  return true
}

function syncExistingCommentRoots(targetWindow: CommentWindow) {
  targetWindow.document.querySelectorAll<CommentRootElement>(COMMENT_ROOT_NAME)
    .forEach(root => scheduleCommentRootThemeSync(root, targetWindow))
}

function installCommentThemeObserver(targetWindow: ThemeObserverWindow) {
  if (targetWindow[COMMENT_THEME_OBSERVER_MARK])
    return
  if (!targetWindow.MutationObserver)
    return

  const observer = new targetWindow.MutationObserver((mutations) => {
    let shouldSyncAll = false
    const addedRoots = new Set<CommentRootElement>()

    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        if (mutation.target === targetWindow.document.documentElement)
          shouldSyncAll = true
        return
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof targetWindow.Element))
          return
        if (node.matches(COMMENT_ROOT_NAME))
          addedRoots.add(node as CommentRootElement)
        node.querySelectorAll<CommentRootElement>(COMMENT_ROOT_NAME)
          .forEach(root => addedRoots.add(root))
      })
    })

    if (shouldSyncAll)
      syncExistingCommentRoots(targetWindow)
    else
      addedRoots.forEach(root => scheduleCommentRootThemeSync(root, targetWindow))
  })

  observer.observe(targetWindow.document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  })
  targetWindow[COMMENT_THEME_OBSERVER_MARK] = true
}

export function installCommentShadowDarkMode(targetWindow: CommentWindow = window) {
  const registry = targetWindow.customElements
  if (!registry)
    return

  installCommentThemeObserver(targetWindow)
  targetWindow.queueMicrotask(() => {
    try {
      removeLegacyCommentStyles(targetWindow.document)
      syncExistingCommentRoots(targetWindow)
    }
    catch (error) {
      console.warn('[BewlyCat] Failed to initialize the Bilibili comment theme.', error)
    }
  })

  const existingConstructor = registry.get(COMMENT_ROOT_NAME)
  if (existingConstructor) {
    patchCommentRootElement(existingConstructor, targetWindow)
    return
  }

  void registry.whenDefined(COMMENT_ROOT_NAME).then(() => {
    const classConstructor = registry.get(COMMENT_ROOT_NAME)
    if (classConstructor)
      patchCommentRootElement(classConstructor, targetWindow)
    syncExistingCommentRoots(targetWindow)
  })
}
