import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import About from '~/components/Settings/About/About.vue'

const mocks = vi.hoisted(() => ({
  getURL: vi.fn((path: string) => `safari-extension://bewlycat${path}`),
  sendMessage: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getURL: mocks.getURL,
    },
  },
}))

vi.mock('~/utils/messaging', () => ({
  sendMessage: mocks.sendMessage,
}))

vi.mock('~/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('~/logic', () => ({
  originalSettings: {
    language: 'en',
    topBarComponentsConfig: [],
  },
  settings: {
    value: {
      language: 'en',
    },
  },
  videoCardContextMenuKeys: [],
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
          contributors_image_failed: 'Failed to load contributors',
          current_contributors: 'Current contributors',
          contributors: 'Contributors',
          copy_environment_info: 'Copy environment info',
          copy_environment_info_desc: 'Copy environment info for reports',
          export_settings: 'Export Settings',
          export_settings_desc: 'Export settings',
          import_settings: 'Import Settings',
          links: 'Links',
          group_environment_info: 'Environment info',
          environment_info_unknown: 'Unknown',
          environment_info_copied: 'Copied',
          environment_info_copy_failed: 'Copy failed',
          reset_settings: 'Reset Settings',
          safari_github: 'Safari GitHub',
          upstream_github: 'Upstream GitHub',
          environment_browser: 'Browser',
          environment_browser_version: 'Browser version',
          environment_bewlycat_version: 'BewlyCat version',
          open_source_license: 'Open Source License',
          open_source_license_desc: 'License description',
          view_full_license: 'View Full License',
          view_third_party_licenses: 'Third-Party Licenses',
          third_party_licenses: 'Third-Party Licenses',
          third_party_licenses_desc: 'Third-party dependencies',
          third_party_licenses_failed: 'Failed to load third-party licenses',
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
    mocks.sendMessage.mockResolvedValue({ name: 'Apple Safari', version: '26.0' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows Safari branding and keeps distinct repository links in order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulReleaseResponse('v1.8.3-safari.1')))
    const { app, root } = mountAbout()
    await flushReleaseCheck()

    expect(root.querySelector('.product-name')?.textContent).toBe('BewlyCat-Safari')
    expect(root.querySelector('.version-link')?.textContent?.trim()).toBe('v1.8.3-safari.1')

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
        href: 'https://space.bilibili.com/34234421',
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
    const fetchMock = vi.fn().mockResolvedValue(successfulReleaseResponse('v1.8.3-safari.2'))
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
      .mockResolvedValueOnce(successfulReleaseResponse('v1.8.3-safari.1'))
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

  it('copies Safari environment metadata and bundles the contributors image', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulReleaseResponse('v1.8.3-safari.1')))

    const { app, root } = mountAbout()
    await flushReleaseCheck()

    const contributors = root.querySelector<HTMLImageElement>('.contributors-image-link img')
    expect(contributors?.src).toBe('safari-extension://bewlycat/assets/contributors.svg')

    const copyButton = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Copy environment info'))
    copyButton?.click()
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('BewlyCat-Safari 1.8.3-safari.1'))
    app.unmount()
  })
})
