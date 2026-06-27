import fs from 'fs-extra'
import type { Manifest } from 'webextension-polyfill'

import type PkgType from '../package.json'
import { isDev, isFirefox, isSafari, port, r } from '../scripts/utils'

const BILIBILI_MATCHES = [
  '*://www.bilibili.com/*',
  '*://search.bilibili.com/*',
  '*://t.bilibili.com/*',
  '*://space.bilibili.com/*',
  '*://message.bilibili.com/*',
  '*://member.bilibili.com/*',
  '*://account.bilibili.com/*',
  '*://www.hdslb.com/*',
  '*://passport.bilibili.com/*',
  '*://music.bilibili.com/*',
]

export async function getManifest() {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: `${pkg.displayName || pkg.name}${isDev ? ' Dev' : ''}`,
    version: pkg.version,
    description: pkg.description,
    homepage_url: pkg.homepage,
    // action: {
    //   default_icon: './assets/icon-512.png',
    //   default_popup: './dist/popup/index.html',
    // },
    // options_ui: {
    //   page: './dist/options/index.html',
    //   open_in_tab: true,
    // },

    // Setting `persistent` to true in Manifest V3 results in an error in Firefox
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
    background: (isFirefox || isSafari)
      ? { scripts: ['./dist/background/index.js'] }
      : { service_worker: './dist/background/index.js', type: 'module' },

    icons: {
      16: 'assets/icon-512.png',
      48: 'assets/icon-512.png',
      128: 'assets/icon-512.png',
    },
    permissions: [
      'storage',
      'declarativeNetRequest',
      ...isFirefox
        ? ['webRequest', 'webRequestBlocking', 'cookies']
        : [],
      ...isSafari
        ? ['alarms']
        : [],
    ],
    host_permissions: [
      '*://*.bilibili.com/*',
      '*://*.hdslb.com/*',
    ],
    content_scripts: [
      {
        matches: BILIBILI_MATCHES,
        js: ['./dist/contentScripts/index.global.js'],
        css: ['./dist/contentScripts/style.css'],
        run_at: 'document_start',
        ...isSafari ? {} : { match_about_blank: true },
        all_frames: true,
      },
      // Safari does not support world: "MAIN" — inject via web_accessible_resources instead
      ...isSafari
        ? []
        : [{
            matches: BILIBILI_MATCHES,
            js: ['./dist/contentScripts/inject.global.js'],
            run_at: 'document_start' as const,
            match_about_blank: true,
            all_frames: true,
            world: 'MAIN' as const,
          }],
    ],
    web_accessible_resources: [
      {
        resources: ['dist/contentScripts/style.css', 'dist/contentScripts/inject.global.js', 'assets/*'],
        matches: BILIBILI_MATCHES,
      },
    ],
    content_security_policy: isFirefox
      ? {
          extension_pages: 'script-src \'self\'; object-src \'self\'',
        }
      : {
          extension_pages: isDev
          // this is required on dev for Vite script to load
            ? `script-src 'self' http://localhost:${port}; object-src 'self' http://localhost:${port}`
            : 'script-src \'self\'; object-src \'self\'',
        },
    ...isFirefox
      ? {}
      : {
          declarative_net_request: {
            rule_resources: [
              {
                id: 'ruleset_1',
                enabled: true,
                path: 'assets/rules.json',
              },
            ],
          },
        },
  }

  if (isDev)
    manifest.permissions?.push('webNavigation')

  if (isFirefox) {
    manifest.browser_specific_settings = {
      gecko: {
        id: 'addon@celeus.cn',
      },
    }
  }

  return manifest
}
