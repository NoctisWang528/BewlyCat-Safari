import { describe, expect, it } from 'vitest'

import { extractMomentVideoIdentifier } from '~/utils/momentVideoIdentifier'

describe('extractMomentVideoIdentifier', () => {
  it('extracts aid and bvid from archive', () => {
    const item = {
      type: 8,
      modules: {
        module_dynamic: {
          major: {
            archive: {
              aid: 123456,
              bvid: 'BV1abc123',
            },
          },
        },
      },
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 123456,
      bvid: 'BV1abc123',
    })
  })

  it('extracts aid from item.rid as number', () => {
    const item = { type: 8, rid: 789 }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 789,
      bvid: undefined,
    })
  })

  it('extracts aid from item.rid as numeric string', () => {
    const item = { type: 8, rid: '456' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 456,
      bvid: undefined,
    })
  })

  it('extracts identifiers from the current top-bar nav response shape', () => {
    const item = {
      type: 8,
      rid: '116826935659862',
      jump_url: '//www.bilibili.com/video/BV18wTM6bECR',
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 116826935659862,
      bvid: 'BV18wTM6bECR',
    })
  })

  it('extracts aid from item.aid', () => {
    const item = { type: 8, aid: 999 }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 999,
      bvid: undefined,
    })
  })

  it('extracts aid from basic.rid_str', () => {
    const item = { type: 8, basic: { rid_str: '321' } }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 321,
      bvid: undefined,
    })
  })

  it('extracts bvid from jump_url', () => {
    const item = {
      type: 8,
      jump_url: 'https://www.bilibili.com/video/BV1xyz789',
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1xyz789',
    })
  })

  it('extracts bvid from item.bvid', () => {
    const item = { type: 8, bvid: 'BV1direct1' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1direct1',
    })
  })

  it('extracts bvid from archive.jump_url', () => {
    const item = {
      type: 8,
      modules: {
        module_dynamic: {
          major: {
            archive: {
              jump_url: 'https://www.bilibili.com/video/BV1arch456',
            },
          },
        },
      },
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1arch456',
    })
  })

  it('falls back after invalid direct bvid candidates', () => {
    const item = {
      bvid: 'BV1fallback',
      modules: {
        module_dynamic: {
          major: {
            archive: {
              bvid: 'invalid-archive-bvid',
            },
          },
        },
      },
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1fallback',
    })
  })

  it('checks archive.jump_url when the top-level URL is not a video', () => {
    const item = {
      jump_url: '//t.bilibili.com/123',
      modules: {
        module_dynamic: {
          major: {
            archive: {
              jump_url: '//www.bilibili.com/video/BV1archive',
            },
          },
        },
      },
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1archive',
    })
  })

  it('filters aid=0', () => {
    const item = { type: 8, aid: 0, bvid: 'BV1valid00' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1valid00',
    })
  })

  it('filters aid=negative', () => {
    const item = { type: 8, aid: -1, bvid: 'BV1valid01' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1valid01',
    })
  })

  it('filters aid=NaN', () => {
    const item = { type: 8, aid: Number.NaN, bvid: 'BV1valid02' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1valid02',
    })
  })

  it('does not use id_str as aid', () => {
    const item = { type: 8, id_str: '12345', bvid: 'BV1valid03' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1valid03',
    })
  })

  it('returns empty object for article without video identifier', () => {
    const item = {
      type: 64,
      title: 'An article',
    }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: undefined,
    })
  })

  it('trims and validates bvid format', () => {
    const item = { type: 8, bvid: '  BV1trimmed  ' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: 'BV1trimmed',
    })
  })

  it('rejects invalid bvid format', () => {
    const item = { type: 8, bvid: 'not-a-bvid' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: undefined,
    })
  })

  it('rejects bvid with insufficient length', () => {
    const item = { type: 8, bvid: 'BV123' }
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: undefined,
      bvid: undefined,
    })
  })

  it('prioritizes archive values over top-level fallbacks', () => {
    const item = {
      type: 8,
      aid: 1,
      bvid: 'BV1toplv01',
      rid: 2,
      modules: {
        module_dynamic: {
          major: {
            archive: {
              aid: 999,
              bvid: 'BV1archpri',
            },
          },
        },
      },
    }
    // archive.aid is tried first; archive.bvid is tried first
    expect(extractMomentVideoIdentifier(item)).toEqual({
      aid: 999,
      bvid: 'BV1archpri',
    })
  })
})
