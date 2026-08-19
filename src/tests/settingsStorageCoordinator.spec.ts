import { describe, expect, it } from 'vitest'

import { shouldUseSettingsCloudSync } from '~/background/settingsStorageCoordinator'

describe('safari settings storage boundary', () => {
  it('ignores a stale cloud-sync preference when sync is unavailable', () => {
    expect(shouldUseSettingsCloudSync(true, false)).toBe(false)
    expect(shouldUseSettingsCloudSync('true', false)).toBe(false)
  })

  it('keeps upstream cloud-sync preferences available outside Safari', () => {
    expect(shouldUseSettingsCloudSync(true, true)).toBe(true)
    expect(shouldUseSettingsCloudSync(false, true)).toBe(false)
  })
})
