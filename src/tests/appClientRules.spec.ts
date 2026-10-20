import { describe, expect, it } from 'vitest'

import { buildAppClientHeaderRules } from '~/background/appClient'

describe('buildAppClientHeaderRules', () => {
  it('keeps client hints and non-tab scoping in Chromium builds', () => {
    const rules = buildAppClientHeaderRules(false)

    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      expect(rule.condition).toMatchObject({
        resourceTypes: ['xmlhttprequest'],
        tabIds: [-1],
      })
      expect(rule.action.requestHeaders?.map(header => header.header)).toEqual([
        'user-agent',
        'referer',
        'origin',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
      ])
    }
  })

  it('omits unsupported tabIds and client hint headers in Safari builds', () => {
    const rules = buildAppClientHeaderRules(true)

    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      expect(rule.condition).not.toHaveProperty('tabIds')
      expect(rule.condition?.regexFilter).toMatch(/^\^https:\/\/(?:passport|app)\\\.bilibili\\\.com\//)
      expect(rule.condition?.resourceTypes).toEqual(['xmlhttprequest'])
      expect(rule.action.requestHeaders?.map(header => header.header)).toEqual([
        'user-agent',
        'referer',
        'origin',
      ])
    }
  })
})
