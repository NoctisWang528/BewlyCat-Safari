import { describe, expect, it, vi } from 'vitest'

import { setupOptionalBackgroundFeatures } from '~/background/platformFeatures'

describe('optional background features', () => {
  it('does not initialize unsupported cloud sync or cookie change listeners in Safari', () => {
    const setupLoginStateWatcher = vi.fn()
    const setupSettingsCloudSync = vi.fn()

    setupOptionalBackgroundFeatures(true, {
      setupLoginStateWatcher,
      setupSettingsCloudSync,
    })

    expect(setupSettingsCloudSync).not.toHaveBeenCalled()
    expect(setupLoginStateWatcher).not.toHaveBeenCalled()
  })

  it('keeps both features available to upstream browser builds', () => {
    const setupLoginStateWatcher = vi.fn()
    const setupSettingsCloudSync = vi.fn()

    setupOptionalBackgroundFeatures(false, {
      setupLoginStateWatcher,
      setupSettingsCloudSync,
    })

    expect(setupSettingsCloudSync).toHaveBeenCalledOnce()
    expect(setupLoginStateWatcher).toHaveBeenCalledOnce()
  })
})
