import { DARK_MODE_BASE_COLOR_CHANGE } from '~/constants/globalEvents'

export const COMMENT_THEME_CONTROL_ATTR = 'data-bewly-comment-theme'

const COMMENT_THEME_TOKENS_INSTALLED = Symbol.for('bewly.commentThemeTokens.installed')
const COMMENT_ROOT_SELECTOR = 'bili-comments'

export const COMMENT_THEME_TOKEN_SOURCES = [
  ['--text1', '--bew-text-1', 'rgb(242, 243, 245)'],
  ['--text2', '--bew-text-2', 'rgba(213, 216, 221, 0.9)'],
  ['--text3', '--bew-text-3', 'rgba(184, 188, 194, 0.75)'],
  ['--text4', '--bew-text-4', 'rgba(156, 161, 169, 0.55)'],
  ['--text_link', '--bew-theme-color-80', 'rgb(64, 197, 241)'],
  ['--bg1', '--bew-bg', 'rgb(34, 36, 40)'],
  ['--bg2', '--bew-content-solid', 'rgb(48, 50, 54)'],
  ['--bg3', '--bew-content-alt-solid', 'rgb(52, 54, 58)'],
  ['--bg1_float', '--bew-elevated-solid', 'rgb(52, 54, 58)'],
  ['--bg2_float', '--bew-elevated-solid', 'rgb(52, 54, 58)'],
  ['--graph_bg_thin', '--graph_bg_thin', 'rgb(41, 43, 47)'],
  ['--graph_bg_regular', '--graph_bg_regular', 'rgb(48, 50, 54)'],
  ['--graph_bg_thick', '--graph_bg_thick', 'rgb(76, 78, 82)'],
  ['--graph_weak', '--bew-border-color', 'rgba(131, 131, 145, 0.16)'],
  ['--line_light', '--bew-fill-1', 'rgba(131, 131, 145, 0.1)'],
  ['--line_regular', '--bew-fill-2', 'rgba(131, 131, 145, 0.2)'],
  ['--Ga1', '--bew-border-color', 'rgba(131, 131, 145, 0.16)'],
  ['--brand_blue', '--bew-theme-color', 'rgb(0, 174, 236)'],
  ['--brand_blue_thin', '--bew-theme-color-20', 'rgba(0, 174, 236, 0.2)'],
  ['--Lb4', '--Lb4', 'rgb(0, 148, 201)'],
  ['--Lb6', '--Lb6', 'rgb(64, 197, 241)'],
  ['--Pi1', '--Pi1', 'rgb(255, 236, 241)'],
  ['--Pi5', '--Pi5', 'rgb(255, 102, 153)'],
  ['--Pi10_u', '--bew-text-1', 'rgb(242, 243, 245)'],
  ['--Ye5_u', '--Ye5_u', 'rgb(255, 179, 0)'],
] as const

export const COMMENT_THEME_OWNED_PROPERTIES = [
  ...COMMENT_THEME_TOKEN_SOURCES.map(([property]) => property),
  '--bg1_rgb',
] as const

export type CommentThemePalette = Record<string, string>

type CommentThemeWindow = Window & typeof globalThis & {
  [COMMENT_THEME_TOKENS_INSTALLED]?: boolean
}

type ResolveCommentThemePalette = (targetWindow: CommentThemeWindow) => CommentThemePalette

function resolveColor(
  targetWindow: CommentThemeWindow,
  probe: HTMLElement,
  sourceProperty: string,
  fallback: string,
) {
  probe.style.color = fallback
  probe.style.color = `var(${sourceProperty}, ${fallback})`

  const resolved = targetWindow.getComputedStyle(probe).color.trim()
  if (!resolved || resolved.includes('var('))
    return fallback
  return resolved
}

function getRgbTuple(color: string) {
  const rgb = color.match(
    /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i,
  )
  if (rgb)
    return `${Math.round(Number(rgb[1]))}, ${Math.round(Number(rgb[2]))}, ${Math.round(Number(rgb[3]))}`

  const srgb = color.match(
    /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i,
  )
  if (srgb) {
    return [srgb[1], srgb[2], srgb[3]]
      .map(channel => Math.round(Number(channel) * 255))
      .join(', ')
  }

  return '34, 36, 40'
}

export function resolveCommentThemePalette(
  targetWindow: CommentThemeWindow = window as CommentThemeWindow,
) {
  const probe = targetWindow.document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none'
  targetWindow.document.documentElement.appendChild(probe)

  try {
    const palette: CommentThemePalette = {}
    COMMENT_THEME_TOKEN_SOURCES.forEach(([property, sourceProperty, fallback]) => {
      palette[property] = resolveColor(targetWindow, probe, sourceProperty, fallback)
    })
    palette['--bg1_rgb'] = getRgbTuple(palette['--bg1'])
    return palette
  }
  finally {
    probe.remove()
  }
}

export function applyCommentThemePalette(root: HTMLElement, palette: CommentThemePalette) {
  Object.entries(palette).forEach(([property, value]) => {
    root.style.setProperty(property, value, 'important')
  })
  root.setAttribute(COMMENT_THEME_CONTROL_ATTR, 'dark')
}

export function clearCommentThemePalette(root: HTMLElement) {
  if (!root.hasAttribute(COMMENT_THEME_CONTROL_ATTR))
    return

  COMMENT_THEME_OWNED_PROPERTIES.forEach((property) => {
    root.style.removeProperty(property)
  })
  root.removeAttribute(COMMENT_THEME_CONTROL_ATTR)
}

function isCommentThemeActive(targetWindow: CommentThemeWindow) {
  const classes = targetWindow.document.documentElement.classList
  return classes.contains('dark') && classes.contains('bewly-design')
}

function findCommentRootsInNode(targetWindow: CommentThemeWindow, node: Node) {
  if (!(node instanceof targetWindow.Element))
    return []

  const roots: HTMLElement[] = []
  if (node.matches(COMMENT_ROOT_SELECTOR))
    roots.push(node as HTMLElement)
  roots.push(...Array.from(node.querySelectorAll<HTMLElement>(COMMENT_ROOT_SELECTOR)))
  return roots
}

export function installCommentThemeTokens(
  targetWindow: CommentThemeWindow = window as CommentThemeWindow,
  resolvePalette: ResolveCommentThemePalette = resolveCommentThemePalette,
) {
  if (targetWindow[COMMENT_THEME_TOKENS_INSTALLED])
    return

  const documentElement = targetWindow.document.documentElement
  if (!documentElement)
    return

  let syncScheduled = false

  const syncRoots = (roots?: Iterable<HTMLElement>) => {
    const targets = roots
      ? [...roots]
      : Array.from(targetWindow.document.querySelectorAll<HTMLElement>(COMMENT_ROOT_SELECTOR))

    if (isCommentThemeActive(targetWindow)) {
      if (targets.length === 0)
        return
      const palette = resolvePalette(targetWindow)
      targets.forEach(root => applyCommentThemePalette(root, palette))
    }
    else {
      targets.forEach(clearCommentThemePalette)
    }
  }

  const scheduleFullSync = () => {
    if (syncScheduled)
      return
    syncScheduled = true
    targetWindow.queueMicrotask(() => {
      syncScheduled = false
      syncRoots()
    })
  }

  const themeObserver = new targetWindow.MutationObserver(scheduleFullSync)
  themeObserver.observe(documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  })

  const rootObserver = new targetWindow.MutationObserver((mutations) => {
    const addedRoots = new Set<HTMLElement>()
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        findCommentRootsInNode(targetWindow, node).forEach(root => addedRoots.add(root))
      })
    })
    if (addedRoots.size > 0)
      syncRoots(addedRoots)
  })
  rootObserver.observe(documentElement, {
    childList: true,
    subtree: true,
  })

  targetWindow.addEventListener(DARK_MODE_BASE_COLOR_CHANGE, scheduleFullSync)
  targetWindow[COMMENT_THEME_TOKENS_INSTALLED] = true
  scheduleFullSync()
}
