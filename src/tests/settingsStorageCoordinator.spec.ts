import { beforeEach, describe, expect, it, vi } from 'vitest'
import browser from 'webextension-polyfill'

import { setupSettingsStorageCoordinator, shouldUseSettingsCloudSync } from '~/background/settingsStorageCoordinator'
import { SETTINGS_STORAGE_IMPORT_MESSAGE } from '~/utils/settingsStorageProtocol'

describe('safari settings storage boundary', () => {
  beforeEach(() => {
    vi.mocked(browser.storage.local.get).mockReset()
    vi.mocked(browser.storage.local.set).mockReset()
  })
  it('ignores a stale cloud-sync preference when sync is unavailable', () => {
    expect(shouldUseSettingsCloudSync(true, false)).toBe(false)
    expect(shouldUseSettingsCloudSync('true', false)).toBe(false)
  })

  it('keeps upstream cloud-sync preferences available outside Safari', () => {
    expect(shouldUseSettingsCloudSync(true, true)).toBe(true)
    expect(shouldUseSettingsCloudSync(false, true)).toBe(false)
  })

  it('does not read storage.sync for a stale Safari preference during import', async () => {
    const sync = { get: vi.fn() }
    ;(browser.storage as any).sync = sync
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      settingsCloudSyncEnabled: true,
      settings: '{}',
      settingsStorageMeta: { cloudSyncInitialized: true, epoch: 'epoch', deviceId: 'device' },
    })
    setupSettingsStorageCoordinator({ cloudSyncAvailable: false })
    const listener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls.at(-1)?.[0] as any
    await listener({ type: SETTINGS_STORAGE_IMPORT_MESSAGE, data: { settings: { language: 'en' } } }, {}, vi.fn())
    expect(sync.get).not.toHaveBeenCalled()
  })
})
