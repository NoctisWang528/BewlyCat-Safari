import { describe, expect, it } from 'vitest'

import {
  SAFARI_LATEST_RELEASE_API_URL,
  SAFARI_RELEASES_URL,
  SAFARI_TAG,
  SAFARI_VERSION,
} from '~/constants/release'

describe('safari release metadata', () => {
  it('uses the upstream version plus Safari revision', () => {
    expect(SAFARI_VERSION).toBe('1.6.9-safari.1')
    expect(SAFARI_TAG).toBe('v1.6.9-safari.1')
  })

  it('checks and links to Safari releases instead of upstream browser packages', () => {
    expect(SAFARI_RELEASES_URL).toBe('https://github.com/NoctisWang528/BewlyCat-Safari/releases')
    expect(SAFARI_LATEST_RELEASE_API_URL)
      .toBe('https://api.github.com/repos/NoctisWang528/BewlyCat-Safari/releases/latest')
  })
})
