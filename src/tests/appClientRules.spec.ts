import { describe, expect, it } from 'vitest'
import browser from 'webextension-polyfill'

import { buildAppClientHeaderRules, isAppClientRequestUrl } from '~/background/appClient'

const endpointCases: [string, number][] = [
  ['https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code?appkey=test', 1002],
  ['https://passport.bilibili.com/x/passport-tv-login/qrcode/poll?appkey=test', 1002],
  ['https://passport.bilibili.com/api/v2/oauth2/refresh_token', 1005],
  ['https://passport.bilibili.com/api/v3/oauth2/refresh_token', 1005],
  ['https://passport.bilibili.com/api/v3/oauth2/refresh_token?appkey=test', 1005],
  ['https://app.bilibili.com/x/v2/feed/index?appkey=test', 1003],
  ['https://app.bilibili.com/x/feed/dislike?appkey=test', 1004],
  ['https://app.bilibili.com/x/feed/dislike/cancel?appkey=test', 1004],
]

const rejectedUrls = [
  'http://app.bilibili.com/x/v2/feed/index?appkey=test',
  'https://app.bilibili.com.evil.example/x/v2/feed/index?appkey=test',
  'https://passport.bilibili.com.evil.example/api/v3/oauth2/refresh_token',
  'https://api.bilibili.com/x/v2/feed/index?appkey=test',
  'https://app.bilibili.com/api/v3/oauth2/refresh_token',
  'https://passport.bilibili.com/x/passport-tv-login/qrcode-other/auth_code?appkey=test',
  'https://passport.bilibili.com/api/v1/oauth2/refresh_token',
  'https://passport.bilibili.com/api/v3/oauth2/refresh_token/extra',
  'https://passport.bilibili.com/api/v3/oauth2/refresh_token_extra',
  'https://app.bilibili.com/x/v2/feed/index/extra?appkey=test',
  'https://app.bilibili.com/x/feed/dislike/cancel/extra?appkey=test',
  'https://app.bilibili.com/x/feed/dislike/other?appkey=test',
  'https://app.bilibili.com/x/v2/feed/index',
  'https://app.bilibili.com/x/feed/dislike',
  'https://app.bilibili.com/x/feed/dislike/cancel',
]

describe('buildAppClientHeaderRules', () => {
  it('keeps client hints and non-tab scoping in Chromium builds', () => {
    const rules = buildAppClientHeaderRules(false)

    expect(rules).toHaveLength(4)
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

    expect(rules.map(rule => rule.id).sort()).toEqual([1002, 1003, 1004, 1005])
    for (const rule of rules) {
      expect(rule.condition).not.toHaveProperty('tabIds')
      expect(typeof rule.condition.regexFilter).toBe('string')
      expect(rule.condition.regexFilter).not.toContain('|')
      expect(rule.condition?.regexFilter).toMatch(/^\^https:\/\/(?:passport|app)\\\.bilibili\\\.com\//)
      expect(rule.condition?.resourceTypes).toEqual(['xmlhttprequest'])
      expect(rule.action.requestHeaders).toEqual([
        { header: 'user-agent', operation: 'set', value: expect.stringContaining(rule.id === 1003 ? 'BiliDroid/2.0.1' : 'Dart/3.6') },
        { header: 'referer', operation: 'set', value: 'https://www.bilibili.com' },
        { header: 'origin', operation: 'remove' },
      ])
    }
  })

  it('replaces legacy and current APP rules without removing rule 1001', () => {
    expect(browser.declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith({
      removeRuleIds: [1002, 1005, 1003, 1004],
      // 测试环境不是 Safari 构建，启动同步走 Chromium 分支。
      addRules: buildAppClientHeaderRules(false),
    })
  })

  for (const isSafariBuild of [true, false]) {
    describe(isSafariBuild ? 'Safari endpoint scope' : 'Chromium endpoint scope', () => {
      const rules = buildAppClientHeaderRules(isSafariBuild)
      const matchingRules = (url: string) => rules.filter(rule => new RegExp(rule.condition.regexFilter!).test(url))

      it.each(endpointCases)('matches %s only with rule %i', (url, id) => {
        expect(matchingRules(url).map(rule => rule.id)).toEqual([id])
        expect(isAppClientRequestUrl(url)).toBe(true)
      })

      it.each(rejectedUrls)('rejects %s', (url) => {
        expect(matchingRules(url)).toEqual([])
        expect(isAppClientRequestUrl(url)).toBe(false)
      })
    })
  }
})
