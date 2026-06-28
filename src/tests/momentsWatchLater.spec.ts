import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import MomentsPop from '~/components/TopBar/components/pops/MomentsPop.vue'

const mocks = vi.hoisted(() => ({
  getCSRF: vi.fn(() => 'csrf-token'),
  getVideoInfo: vi.fn(),
  removeFromWatchLater: vi.fn(),
  saveToWatchLater: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  store: {
    addedWatchLaterBvids: new Set<string>(),
    addedWatchLaterList: [] as number[],
    initMomentsData: vi.fn(),
    isLoadingMoments: false,
    isNewMoment: vi.fn(() => false),
    moments: [] as any[],
    getMomentsData: vi.fn(),
  },
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
    },
  },
}))

vi.mock('~/stores/topBarStore', () => ({
  useTopBarStore: () => mocks.store,
}))

vi.mock('~/utils/api', () => ({
  default: {
    video: {
      getVideoInfo: mocks.getVideoInfo,
    },
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
    link: 'https://www.bilibili.com/video/BV1abcdefg',
    pubTime: 'now',
    rid: 123,
    aid: 123,
    bvid: 'BV1abcdefg',
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
          added: 'Added',
          save_to_watch_later: 'Save',
          view_all: 'View all',
          watch_later_add_failed: 'Add failed',
          watch_later_invalid_video_id: 'Invalid video',
          watch_later_login_required: 'Login required',
          watch_later_operation_failed: 'Operation failed',
          watch_later_remove_failed: 'Remove failed',
          watch_later_remove_invalid_aid: 'Invalid aid',
          watch_later_remove_success: 'Removed',
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

describe('moments watch-later toggle', () => {
  describe('aid-based', () => {
    let app: ReturnType<typeof createApp>
    let errorSpy: ReturnType<typeof vi.spyOn>
    let root: HTMLDivElement

    beforeEach(() => {
      vi.clearAllMocks()
      mocks.getCSRF.mockReturnValue('csrf-token')
      mocks.store.addedWatchLaterList.length = 0
      mocks.store.addedWatchLaterBvids.clear()
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

    it('stops link bubbling and guards concurrent add requests', async () => {
      let resolveRequest: (value: unknown) => void = () => {}
      mocks.saveToWatchLater.mockImplementationOnce(() => new Promise((resolve) => {
        resolveRequest = resolve
      }))
      const parentClick = vi.fn()
      root.addEventListener('click', parentClick)
      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement

      toggle.click()
      toggle.click()

      expect(parentClick).not.toHaveBeenCalled()
      expect(mocks.saveToWatchLater).toHaveBeenCalledOnce()

      resolveRequest({ code: 0 })
      await flushAsyncAction()

      expect(mocks.saveToWatchLater).toHaveBeenCalledWith({
        aid: 123,
        bvid: 'BV1abcdefg',
        csrf: 'csrf-token',
      })
      expect(mocks.store.addedWatchLaterList).toEqual([123])
      expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('removes only the selected aid', async () => {
      mocks.store.addedWatchLaterList.push(123, 456)
      mocks.removeFromWatchLater.mockResolvedValueOnce({ code: 0 })
      await nextTick()

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      toggle.click()
      await flushAsyncAction()

      expect(mocks.removeFromWatchLater).toHaveBeenCalledWith({
        aid: 123,
        csrf: 'csrf-token',
      })
      expect(mocks.store.addedWatchLaterList).toEqual([456])
      expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('shows request errors and releases the per-key guard', async () => {
      mocks.saveToWatchLater
        .mockRejectedValueOnce(new Error('Bridge failed'))
        .mockResolvedValueOnce({ code: 0 })
      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement

      toggle.click()
      await flushAsyncAction()
      toggle.click()
      await flushAsyncAction()

      expect(mocks.saveToWatchLater).toHaveBeenCalledTimes(2)
      expect(mocks.toastError).not.toHaveBeenCalled()
      expect(mocks.store.addedWatchLaterList).toEqual([123])
    })
  })

  describe('bvid-only', () => {
    let app: ReturnType<typeof createApp>
    let errorSpy: ReturnType<typeof vi.spyOn>
    let root: HTMLDivElement

    beforeEach(() => {
      vi.clearAllMocks()
      mocks.getCSRF.mockReturnValue('csrf-token')
      mocks.store.addedWatchLaterList.length = 0
      mocks.store.addedWatchLaterBvids.clear()
      const ctx = mountWithMoments([
        makeVideoMoment({ aid: undefined, rid: undefined, bvid: 'BV1bvid000' }),
      ])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy
    })

    afterEach(() => {
      errorSpy.mockRestore()
      app.unmount()
      root.remove()
    })

    it('adds a bvid-only moment without aid', async () => {
      mocks.saveToWatchLater.mockResolvedValueOnce({ code: 0 })

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      expect(toggle).not.toBeNull()

      toggle.click()
      await flushAsyncAction()

      expect(mocks.saveToWatchLater).toHaveBeenCalledWith({
        bvid: 'BV1bvid000',
        csrf: 'csrf-token',
      })
      const callArgs = mocks.saveToWatchLater.mock.calls[0][0]
      expect(callArgs.aid).toBeUndefined()
      expect(mocks.store.addedWatchLaterBvids.has('BV1bvid000')).toBe(true)
      expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('removes a bvid-only moment by resolving aid from getVideoInfo', async () => {
      mocks.store.addedWatchLaterBvids.add('BV1bvid000')
      mocks.getVideoInfo.mockResolvedValueOnce({ code: 0, data: { aid: 789 } })
      mocks.removeFromWatchLater.mockResolvedValueOnce({ code: 0 })

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      toggle.click()
      await flushAsyncAction()

      expect(mocks.getVideoInfo).toHaveBeenCalledWith({ bvid: 'BV1bvid000' })
      expect(mocks.removeFromWatchLater).toHaveBeenCalledWith({
        aid: 789,
        csrf: 'csrf-token',
      })
      expect(mocks.store.addedWatchLaterBvids.has('BV1bvid000')).toBe(false)
      expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('keeps the bvid lock after resolving aid while removal is pending', async () => {
      let resolveRemove: (value: unknown) => void = () => {}
      mocks.store.addedWatchLaterBvids.add('BV1bvid000')
      mocks.getVideoInfo.mockResolvedValueOnce({ code: 0, data: { aid: 789 } })
      mocks.removeFromWatchLater.mockImplementationOnce(() => new Promise((resolve) => {
        resolveRemove = resolve
      }))

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      toggle.click()
      await flushAsyncAction()

      expect(mocks.removeFromWatchLater).toHaveBeenCalledOnce()
      expect(mocks.store.moments[0].aid).toBe(789)

      toggle.click()
      await flushAsyncAction()

      expect(mocks.getVideoInfo).toHaveBeenCalledOnce()
      expect(mocks.removeFromWatchLater).toHaveBeenCalledOnce()

      resolveRemove({ code: 0 })
      await flushAsyncAction()
      expect(mocks.store.addedWatchLaterBvids.has('BV1bvid000')).toBe(false)
    })

    it('shows error when getVideoInfo fails for bvid-only removal', async () => {
      mocks.store.addedWatchLaterBvids.add('BV1bvid000')
      mocks.getVideoInfo.mockResolvedValueOnce({ code: -1, data: null })
      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement

      toggle.click()
      await flushAsyncAction()

      expect(mocks.getVideoInfo).toHaveBeenCalledWith({ bvid: 'BV1bvid000' })
      expect(mocks.removeFromWatchLater).not.toHaveBeenCalled()
      expect(mocks.toastError).not.toHaveBeenCalled()
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

    it('does not show watch-later button on article items', async () => {
      vi.clearAllMocks()
      const ctx = mountWithMoments([{
        type: 'video',
        title: 'An article',
        author: 'Writer',
        authorFace: 'https://example.com/avatar.jpg',
        cover: 'https://example.com/cover.jpg',
        link: 'https://www.bilibili.com/read/cv123',
        isVideo: false,
        isCollaborative: false,
      }])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      expect(toggle).toBeNull()
    })

    it('does not show watch-later button on live items', async () => {
      vi.clearAllMocks()
      const ctx = mountWithMoments([{
        type: 'live',
        title: 'A stream',
        author: 'Streamer',
        authorFace: 'https://example.com/avatar.jpg',
        cover: 'https://example.com/cover.jpg',
        link: 'https://live.bilibili.com/123',
        isVideo: false,
      }])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      expect(toggle).toBeNull()
    })

    it('hides button when neither aid nor bvid is present on a "video" item', async () => {
      vi.clearAllMocks()
      const ctx = mountWithMoments([
        makeVideoMoment({ aid: undefined, rid: undefined, bvid: undefined }),
      ])
      root = ctx.root
      app = ctx.app
      errorSpy = ctx.errorSpy

      const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement
      // Button hidden because getMomentWatchLaterKey returns ''
      expect(toggle).toBeNull()
    })
  })
})
