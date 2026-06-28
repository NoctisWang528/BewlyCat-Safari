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
  store: {
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

describe('moments watch-later toggle', () => {
  let app: ReturnType<typeof createApp>
  let errorSpy: ReturnType<typeof vi.spyOn>
  let root: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCSRF.mockReturnValue('csrf-token')
    mocks.store.addedWatchLaterList.length = 0
    mocks.store.moments.length = 0
    mocks.store.moments.push({
      author: 'Uploader',
      authorFace: 'https://example.com/avatar.jpg',
      authorJumpUrl: 'https://space.bilibili.com/1',
      cover: 'https://example.com/cover.jpg',
      link: 'https://www.bilibili.com/video/BV1abcdefg',
      pubTime: 'now',
      rid: 123,
      title: 'Test video',
      type: 'video',
    })
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    root = document.createElement('div')
    document.body.append(root)

    app = createApp(MomentsPop)
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
            watch_later_add_success: 'Added',
            watch_later_invalid_video_id: 'Invalid video',
            watch_later_login_required: 'Login required',
            watch_later_operation_failed: 'Operation failed',
            watch_later_remove_failed: 'Remove failed',
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

    expect(mocks.store.addedWatchLaterList).toEqual([123])
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Added')
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
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Removed')
  })

  it('shows request errors and releases the per-aid guard', async () => {
    mocks.saveToWatchLater
      .mockRejectedValueOnce(new Error('Bridge failed'))
      .mockResolvedValueOnce({ code: 0 })
    const toggle = root.querySelector('.moment-watch-later-toggle') as HTMLElement

    toggle.click()
    await flushAsyncAction()
    toggle.click()
    await flushAsyncAction()

    expect(mocks.saveToWatchLater).toHaveBeenCalledTimes(2)
    expect(mocks.toastError).toHaveBeenCalledWith('Bridge failed')
    expect(mocks.store.addedWatchLaterList).toEqual([123])
  })
})
