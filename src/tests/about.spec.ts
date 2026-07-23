import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import About from '~/components/Settings/About/About.vue'

const mocks = vi.hoisted(() => ({
  getURL: vi.fn((path: string) => `safari-extension://bewlycat${path}`),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getURL: mocks.getURL,
    },
  },
}))

vi.mock('~/logic', () => ({
  originalSettings: {
    language: 'en',
  },
  settings: {
    value: {
      language: 'en',
    },
  },
}))

function successfulReleaseResponse(tagName: string) {
  return {
    json: vi.fn().mockResolvedValue({ tag_name: tagName }),
    ok: true,
  } as unknown as Response
}

async function flushReleaseCheck() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

function mountAbout() {
  const root = document.createElement('div')
  document.body.append(root)

  const app = createApp(About)
  app.component('Button', defineComponent({
    setup(_, { slots }) {
      return () => h('button', slots.default?.())
    },
  }))
  app.component('Tooltip', defineComponent({
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  }))
  app.use(createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        settings: {
          contributors: 'Contributors',
          export_settings: 'Export Settings',
          export_settings_desc: 'Export settings',
          import_settings: 'Import Settings',
          links: 'Links',
          reset_settings: 'Reset Settings',
          safari_github: 'Safari GitHub',
          upstream_github: 'Upstream GitHub',
        },
      },
    },
  }))
  app.mount(root)

  return { app, root }
}

describe('settings about page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows Safari branding and keeps distinct repository links in order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulReleaseResponse('v1.6.9-safari.1')))
    const { app, root } = mountAbout()
    await flushReleaseCheck()

    expect(root.querySelector('.product-name')?.textContent).toBe('BewlyCat-Safari')
    expect(root.querySelector('.version-link')?.textContent?.trim()).toBe('v1.6.9-safari.1')

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.link-card'))
    expect(links.map(link => ({
      href: link.href,
      text: link.textContent?.replace(/\s+/g, ' ').trim(),
    }))).toEqual([
      {
        href: 'https://github.com/NoctisWang528/BewlyCat-Safari',
        text: 'Safari GitHub',
      },
      {
        href: 'https://github.com/keleus/BewlyCat',
        text: 'Upstream GitHub',
      },
      {
        href: 'https://space.bilibili.com/32487218/dynamic',
        text: 'Bilibili',
      },
      {
        href: 'https://www.xiaohongshu.com/user/profile/5fb77085000000000100060d',
        text: '小红书',
      },
    ])

    app.unmount()
  })

  it('checks Safari releases and shows NEW for a different full tag', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulReleaseResponse('v1.6.9-safari.2'))
    vi.stubGlobal('fetch', fetchMock)
    const { app, root } = mountAbout()
    await flushReleaseCheck()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/NoctisWang528/BewlyCat-Safari/releases/latest',
    )
    expect(root.querySelector<HTMLAnchorElement>('.version-link')?.href)
      .toBe('https://github.com/NoctisWang528/BewlyCat-Safari/releases')
    expect(root.querySelector<HTMLAnchorElement>('.new-version-link')?.href)
      .toBe('https://github.com/NoctisWang528/BewlyCat-Safari/releases')

    app.unmount()
  })

  it('hides NEW for the exact current tag and when the release check fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(successfulReleaseResponse('v1.6.9-safari.1'))
      .mockRejectedValueOnce(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    const firstMount = mountAbout()
    await flushReleaseCheck()
    expect(firstMount.root.querySelector('.new-version-link')).toBeNull()
    firstMount.app.unmount()
    firstMount.root.remove()

    const secondMount = mountAbout()
    await flushReleaseCheck()
    expect(secondMount.root.querySelector('.new-version-link')).toBeNull()
    secondMount.app.unmount()
  })
})
