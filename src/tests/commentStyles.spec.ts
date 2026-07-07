import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const commentsScss = readFileSync(
  join(process.cwd(), 'src/styles/adaptedStyles/common/comments.scss'),
  'utf8',
)

describe('comment dark-mode styles', () => {
  it('covers the video-page plain DOM comment body selectors', () => {
    expect(commentsScss).toContain('.reply-content-container .reply-content')
    expect(commentsScss).toContain('.root-reply .reply-content')
    expect(commentsScss).toContain('.sub-reply-content')
    expect(commentsScss).toContain('.bili-rich-text__content')
    expect(commentsScss).toContain('.bili-rich-text-module')
    expect(commentsScss).toContain('color: var(--bew-text-1) !important')
  })

  it('covers secondary comment metadata and operation text', () => {
    expect(commentsScss).toContain('.reply-info')
    expect(commentsScss).toContain('.reply-time')
    expect(commentsScss).toContain('.reply-operation')
    expect(commentsScss).toContain('.reply-btn')
    expect(commentsScss).toContain('color: var(--bew-text-3) !important')
  })

  it('covers the video-page reply editor background and text selectors', () => {
    expect(commentsScss).toContain('.reply-box .box-normal .reply-box-warp')
    expect(commentsScss).toContain('.bili-rich-textarea')
    expect(commentsScss).toContain('.bili-rich-textarea__inner')
    expect(commentsScss).toContain('[contenteditable="true"]')
    expect(commentsScss).toContain('caret-color: var(--bew-theme-color)')
  })
})
