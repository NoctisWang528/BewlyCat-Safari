import { describe, expect, it } from 'vitest'

import API_MOMENT from '~/background/messageListeners/api/moment'
import { originalSettings } from '~/logic/storage'

describe('moments frequently visited uploader list', () => {
  it('requests the expanded portal uploader list and enables the component by default', () => {
    expect(API_MOMENT.getMomentsPortal.params).toMatchObject({
      up_list_more: 1,
      web_location: '333.1365',
    })
    expect(originalSettings.momentsShowUpList).toBe(true)
  })
})
