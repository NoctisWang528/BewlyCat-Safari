import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import MomentsPop from '~/components/TopBar/components/pops/MomentsPop.vue'

const mocks = vi.hoisted(() => ({
  getCSRF: vi.fn(() => 'csrf-token'),
  removeFromWatchLater: vi.fn(),
  saveToWatchLater: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  watchLaterEntries: new Map<string, boolean>(),
  ensureWatchLaterState: vi.fn(async () => {}),
  getWatchLaterAid: vi.fn((target?: { aid?: number | string, bvid?: string }) => {
    const key = target?.bvid || String(target?.aid ?? '')
    if (!mocks.watchLaterEntries.get(key))
      return undefined
    const aid = Number(target?.aid || 0)
    return Number.isSafeInteger(aid) && aid > 0 ? aid : undefined
  }),
  isInWatchLater: vi.fn((target?: { aid?: number | string, bvid?: string }) => {
    const key = target?.bvid || String(target?.aid ?? '')
    return mocks.watchLaterEntries.get(key) ?? false
  }),
  markWatchLater: vi.fn((target?: { aid?: number | string, bvid?: string }, added?: boolean) => {
    const key = target?.bvid || String(target?.aid ?? '')
    if (added)
      mocks.watchLaterEntries.set(key, true)
    else
      mocks.watchLaterEntries.delete(key)
  }),
  store: {
    initMomentsData: vi.fn(),
    isLoadingMoments: false,
    isNewMoment: vi.fn(() => false),
    isLastSeenMoment: vi.fn(() => false),
    moments: [] as any[],
    getMomentsData: vi.fn(),
    syncWatchLaterState: vi.fn(),
  },
}))

vi.mock('~/logic/watchLaterState', () => ({
  ensureWatchLaterState: mocks.ensureWatchLaterState,
  getWatchLaterAid: mocks.getWatchLaterAid,
  isInWatchLater: mocks.isInWatchLater,
  markWatchLater: mocks.markWatchLater,
}))

vi.mock('vue-toastification', () => ({
  useToast: () => ({
    error: mocks.toastError,
    success: mocks.toastSuccess,
  }),
}))

vi.mock('~/composables/useOptimizedScroll', () => ({
  useOptimizedScroll: vi.fn(),
}))

vi.mock('~/logic', () => ({
  settings: {
    value: {
      filterArticlesInMoments: true,
      showVideoCardWatchLater: true,
    },
  },
}))

vi.mock('~/stores/topBarStore', () => ({
  useTopBarStore: () => mocks.store,
}))

vi.mock('~/utils/api', () => ({
  default: {
    watchlater: {
      removeFromWatchLater: mocks.removeFromWatchLater,
      saveToWatchLater: mocks.saveToWatchLater,
    },
  },
}))

vi.mock('~/utils/main', () => ({
  getCSRF: mocks.getCSRF,
  scrollToTop: vi.fn(),
}))

async function flushAsyncAction() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

function makeVideoMoment(overrides: Record<string, unknown> = {}) {
  return {
    author: 'Uploader',
    authorFace: 'https://example.com/avatar.jpg',
    authorJumpUrl: 'https://space.bilibili.com/1',
    cover: 'https://example.com/cover.jpg',
    id_str: 'moment-123',
    itemType: 8,
    link: 'https://www.bilibili.com/video/BV1abcdefg',
    pubTime: 'now',
    rid: 123,
    isVideo: true,
    title: 'Test video',
    type: 'video',
    ...overrides,
  }
}

function mountWithMoments(momentList: any[]): {
  root: HTMLDivElement
  app: ReturnType<typeof createApp>
  errorSpy: ReturnType<typeof vi.spyOn>
} {
  mocks.store.moments.length = 0
  mocks.store.moments.push(...momentList)

  const root = document.createElement('div')
  document.body.append(root)
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  const app = createApp(MomentsPop)
  app.component('ALink', defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('a', attrs, slots.default?.())
    },
  }))
  app.use(createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        common: {
          added_to_watch_later: 'Added to watch later',
          add_to_watch_later: 'Add to watch later',
          view_all: 'View all',
        },
        topbar: {
          moments_dropdown: {
            live_status: 'Live',
            tabs: {
              all: 'All',
              live: 'Live',
              videos: 'Videos',
            },
          },
        },
      },
    },
  }))
  app.mount(root)

  return { root, app, errorSpy }
}

function findToggle(root: HTMLElement) {
  return root.querySelector<HTMLElement>('.bew-watch-later-cover__btn')
}

describe('moments watch-later toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.watchLaterEntries.clear()
    mocks.getCSRF.mockReturnValue('csrf-token')
    mocks.store.syncWatchLaterState.mockResolvedValue(undefined)
  })

  describe('aid-based video moments', () => {
    let app: ReturnType<typeof createApp>
    let errorSpy: ReturnType<typeof vi.spyOn>
    let root: HTMLDivElement

    beforeEach(() => {
      const ctx = mountWithMoments([makeVideoMoment()])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy
    })

    afterEach(() => {
      errorSpy.mockRestore()
      app.unmount()
      root.remove()
    })

    it('stops link bubbling and adds the moment aid', async () => {
      let resolveRequest: (value: unknown) => void = () => {}
      mocks.saveToWatchLater.mockImplementationOnce(() => new Promise((resolve) => {
        resolveRequest = resolve
      }))
      const parentClick = vi.fn()
      root.addEventListener('click', parentClick)
      const toggle = findToggle(root)!

      toggle.click()
      toggle.click()

      expect(parentClick).not.toHaveBeenCalled()
      expect(mocks.saveToWatchLater).toHaveBeenCalledOnce()

      resolveRequest({ code: 0 })
      await flushAsyncAction()

      expect(mocks.saveToWatchLater).toHaveBeenCalledWith({
        aid: 123,
        bvid: undefined,
        csrf: 'csrf-token',
      })
      expect(mocks.isInWatchLater({ aid: 123 })).toBe(true)
      expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('removes only the selected aid', async () => {
      mocks.watchLaterEntries.set('123', true)
      mocks.watchLaterEntries.set('456', true)
      mocks.removeFromWatchLater.mockResolvedValueOnce({ code: 0 })
      await nextTick()

      findToggle(root)!.click()
      await flushAsyncAction()

      expect(mocks.removeFromWatchLater).toHaveBeenCalledWith({
        aid: 123,
        csrf: 'csrf-token',
      })
      expect(mocks.isInWatchLater({ aid: 123 })).toBe(false)
      expect(mocks.isInWatchLater({ aid: 456 })).toBe(true)
      expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('shows request errors and releases the per-key guard', async () => {
      mocks.saveToWatchLater
        .mockRejectedValueOnce(new Error('Bridge failed'))
        .mockResolvedValueOnce({ code: 0 })
      const toggle = findToggle(root)!

      toggle.click()
      await flushAsyncAction()
      toggle.click()
      await flushAsyncAction()

      expect(mocks.saveToWatchLater).toHaveBeenCalledTimes(2)
      expect(mocks.toastError).toHaveBeenCalledWith('Bridge failed')
      expect(mocks.isInWatchLater({ aid: 123 })).toBe(true)
    })
  })

  describe('non-video items', () => {
    let app: ReturnType<typeof createApp>
    let errorSpy: ReturnType<typeof vi.spyOn>
    let root: HTMLDivElement

    afterEach(() => {
      errorSpy.mockRestore()
      app.unmount()
      root.remove()
    })

    it('does not show watch-later button on article items', () => {
      const ctx = mountWithMoments([makeVideoMoment({
        id_str: 'moment-article',
        itemType: 64,
        link: 'https://www.bilibili.com/read/cv123',
        isVideo: false,
        type: 'article',
      })])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy

      expect(findToggle(root)).toBeNull()
    })

    it('does not show watch-later button on live items', () => {
      const ctx = mountWithMoments([makeVideoMoment({
        id_str: 'moment-live',
        itemType: undefined,
        link: 'https://live.bilibili.com/123',
        isVideo: false,
        type: 'live',
      })])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy

      expect(findToggle(root)).toBeNull()
    })

    it('hides button when a video moment has no valid rid', () => {
      const ctx = mountWithMoments([
        makeVideoMoment({ rid: undefined }),
      ])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy

      expect(findToggle(root)).toBeNull()
    })
  })
})
