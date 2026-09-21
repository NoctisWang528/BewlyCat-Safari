import { describe, expect, it } from 'vitest'

import { parseWatchLaterTabUrl } from '~/utils/openTabsWatchLater'

describe('open tabs watch-later parser', () => {
  it('recognizes supported video and PGC playback URLs', () => {
    expect(parseWatchLaterTabUrl('https://www.bilibili.com/video/BV1abcdefghi?p=2')).toEqual({ type: 'bvid', id: 'BV1abcdefghi' })
    expect(parseWatchLaterTabUrl('https://www.bilibili.com/video/av123')).toEqual({ type: 'aid', id: 123 })
    expect(parseWatchLaterTabUrl('https://www.bilibili.com/bangumi/play/ep456')).toEqual({ type: 'epid', id: 456 })
    expect(parseWatchLaterTabUrl('https://www.bilibili.com/bangumi/play/ss789')).toEqual({ type: 'seasonId', id: 789 })
  })

  it('ignores non-playback and non-Bilibili URLs', () => {
    expect(parseWatchLaterTabUrl('https://space.bilibili.com/123?bvid=BV1abcdefghi')).toBeUndefined()
    expect(parseWatchLaterTabUrl('https://example.com/video/BV1abcdefghi')).toBeUndefined()
  })
})
