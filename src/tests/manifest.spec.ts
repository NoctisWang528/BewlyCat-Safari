import { describe, expect, it, vi } from 'vitest'

import { getManifest } from '~/manifest'

vi.mock('fs-extra', () => ({
  default: {
    readJSON: vi.fn().mockResolvedValue({
      description: 'Safari test manifest',
      displayName: 'BewlyCat',
      homepage: 'https://github.com/NoctisWang528/BewlyCat-Safari',
      name: 'bewly-cat',
      safariRevision: 1,
      version: '1.6.9',
    }),
  },
}))

vi.mock('../../scripts/utils', () => ({
  isDev: false,
  isFirefox: false,
  isSafari: true,
  port: 5173,
  r: vi.fn(value => value),
}))

describe('safari manifest', () => {
  it('keeps Safari versioning, permissions, and injection compatibility', async () => {
    const manifest = await getManifest()
    const serialized = JSON.stringify(manifest)

    expect(manifest.version).toBe('1.6.9.1')
    expect(manifest.background).toEqual({
      scripts: ['./dist/background/index.js'],
    })
    expect(manifest.permissions).toEqual(expect.arrayContaining([
      'alarms',
      'declarativeNetRequestWithHostAccess',
      'scripting',
      'storage',
    ]))
    expect(manifest.host_permissions).toEqual([
      '*://*.bilibili.com/*',
      '*://*.hdslb.com/*',
    ])
    expect(manifest.content_scripts).toHaveLength(1)
    expect(manifest.content_scripts?.[0]).toMatchObject({
      exclude_matches: [
        '*://www.bilibili.com/match/game*',
        '*://www.bilibili.com/toy*',
      ],
      js: ['./dist/contentScripts/index.global.js'],
    })
    expect(serialized).not.toContain('"persistent"')
    expect(serialized).not.toContain('"world"')
    expect(serialized).not.toContain('"match_about_blank"')
  })
})
