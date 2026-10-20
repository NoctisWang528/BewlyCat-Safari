import { describe, expect, it } from 'vitest'

import { buildAppClientHeaderRules } from '~/background/appClient'

describe('buildAppClientHeaderRules', () => {
  it('keeps non-tab scoping in Chromium builds', () => {
    const rules = buildAppClientHeaderRules(false)

    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      expect(rule.condition).toMatchObject({
        resourceTypes: ['xmlhttprequest'],
        tabIds: [-1],
      })
    }
  })

  it('omits the unsupported tabIds condition in Safari builds', () => {
    const rules = buildAppClientHeaderRules(true)

    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      expect(rule.condition).not.toHaveProperty('tabIds')
      expect(rule.condition?.regexFilter).toMatch(/^\^https:\/\/(?:passport|app)\\\.bilibili\\\.com\//)
      expect(rule.condition?.resourceTypes).toEqual(['xmlhttprequest'])
      expect(rule.action.requestHeaders).toEqual(expect.arrayContaining([
        expect.objectContaining({ header: 'user-agent', operation: 'set' }),
        expect.objectContaining({ header: 'referer', operation: 'set' }),
        expect.objectContaining({ header: 'origin', operation: 'remove' }),
      ]))
    }
  })
})
