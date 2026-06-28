import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import { useVideoCardLogic } from '~/components/VideoCard/composables/useVideoCardLogic'

const mocks = vi.hoisted(() => ({
  getCSRF: vi.fn(() => 'csrf-token'),
  getAllWatchLaterList: vi.fn(),
  openIframeDrawer: vi.fn(),
  removeFromWatchLater: vi.fn(),
  saveToWatchLater: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('vue-toastification', () => ({
  useToast: () => ({
    error: mocks.toastError,
    success: mocks.toastSuccess,
  }),
}))

vi.mock('~/composables/useAppProvider', () => ({
  useBewlyApp: () => ({
    openIframeDrawer: mocks.openIframeDrawer,
  }),
}))

vi.mock('~/logic', () => ({
  appAuthTokens: { value: { accessToken: '' } },
  settings: {
    value: {
      enableVideoPreview: false,
      hoverVideoCardDelayed: false,
      videoCardLinkOpenMode: 'default',
    },
  },
}))

vi.mock('~/stores/topBarStore', () => ({
  useTopBarStore: () => ({
    getAllWatchLaterList: mocks.getAllWatchLaterList,
    isLogin: true,
  }),
}))

vi.mock('~/utils/api', () => ({
  default: {
    live: {
      getLivePlayUrl: vi.fn(),
    },
    video: {
      getVideoInfo: vi.fn(),
      getVideoPreview: vi.fn(),
    },
    watchlater: {
      removeFromWatchLater: mocks.removeFromWatchLater,
      saveToWatchLater: mocks.saveToWatchLater,
    },
  },
}))

vi.mock('~/utils/main', () => ({
  getCSRF: mocks.getCSRF,
  removeHttpFromUrl: vi.fn((url: string) => url),
}))

vi.mock('~/utils/tabs', () => ({
  openLinkInBackground: vi.fn(),
}))

describe('useVideoCardLogic watch later', () => {
  let app: ReturnType<typeof createApp>
  let errorSpy: ReturnType<typeof vi.spyOn>
  let root: HTMLDivElement
  let logic: ReturnType<typeof useVideoCardLogic>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.getCSRF.mockReturnValue('csrf-token')
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    root = document.createElement('div')
    document.body.append(root)

    app = createApp(defineComponent({
      setup() {
        logic = useVideoCardLogic(() => ({
          video: {
            id: 123,
            bvid: 'BV1test',
            title: 'Test video',
            cover: 'https://example.com/cover.jpg',
            threePointV2: [],
          },
        }))
        return () => h('div')
      },
    }))
    app.use(createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          common: {
            watch_later_add_failed: 'Failed to add',
            watch_later_add_success: 'Added',
            watch_later_invalid_video_id: 'Invalid video',
            watch_later_login_required: 'Login required',
            watch_later_operation_failed: 'Operation failed',
            watch_later_remove_failed: 'Failed to remove',
            watch_later_remove_invalid_aid: 'Invalid aid',
            watch_later_remove_success: 'Removed',
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
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('catches a rejected add request and displays its error', async () => {
    mocks.saveToWatchLater.mockRejectedValueOnce(new Error('Risk control'))

    await expect(logic.toggleWatchLater()).resolves.toBeUndefined()

    expect(mocks.toastError).toHaveBeenCalledWith('Risk control')
    expect(logic.isInWatchLater.value).toBe(false)
  })

  it('does not send a request without a CSRF token', async () => {
    mocks.getCSRF.mockReturnValueOnce('')

    await logic.toggleWatchLater()

    expect(mocks.saveToWatchLater).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith('Login required')
  })

  it('guards against concurrent watch-later requests', async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    mocks.saveToWatchLater.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))

    const firstRequest = logic.toggleWatchLater()
    const secondRequest = logic.toggleWatchLater()

    expect(mocks.saveToWatchLater).toHaveBeenCalledOnce()
    await expect(secondRequest).resolves.toBeUndefined()

    resolveRequest({ code: -1, message: 'Rejected' })
    await firstRequest
    expect(mocks.toastError).toHaveBeenCalledWith('Rejected')
  })

  it('updates state and refreshes the list after a successful add', async () => {
    mocks.saveToWatchLater.mockResolvedValueOnce({ code: 0 })

    await logic.toggleWatchLater()

    expect(mocks.saveToWatchLater).toHaveBeenCalledWith({
      aid: 123,
      bvid: 'BV1test',
      csrf: 'csrf-token',
    })
    expect(logic.isInWatchLater.value).toBe(true)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Added')

    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.getAllWatchLaterList).toHaveBeenCalledOnce()
  })

  it('catches a rejected remove request and releases the loading guard', async () => {
    logic.isInWatchLater.value = true
    mocks.removeFromWatchLater
      .mockRejectedValueOnce(new Error('Remove failed'))
      .mockResolvedValueOnce({ code: 0 })

    await logic.toggleWatchLater()
    await logic.toggleWatchLater()

    expect(mocks.removeFromWatchLater).toHaveBeenCalledTimes(2)
    expect(mocks.toastError).toHaveBeenCalledWith('Remove failed')
    expect(logic.isInWatchLater.value).toBe(false)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Removed')
  })
})
