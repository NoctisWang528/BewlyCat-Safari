/// <reference types="vitest" />

import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import replace from '@rollup/plugin-replace'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import type { Plugin, UserConfig } from 'vite'
import { defineConfig } from 'vite'

import packageJson from './package.json'
import { buildCommit, isDev, isFirefox, isSafari, r } from './scripts/utils'

// unplugin-vue-i18n 按 config.isProduction 选择消息格式：开发模式下每条消息都编译为带 start/end/loc/source
// 位置信息的完整 AST，4 个语言约 3.5 MB，是生产格式的十倍左右，显著拖慢内容脚本与设置页的构建。
// 位置信息只用于编译期报错定位，vue-i18n 运行时同样解析精简格式，因此开发构建也使用生产格式。
function withCompactI18nMessages(plugins: Plugin | Plugin[]): Plugin[] {
  return [plugins].flat().map((plugin) => {
    const hook = plugin.configResolved
    if (!hook)
      return plugin
    const handler = typeof hook === 'function' ? hook : hook.handler
    return {
      ...plugin,
      configResolved(config) {
        return handler.call(this, Object.create(config, { isProduction: { value: true } }))
      },
    }
  })
}

// 内容脚本、页面脚本和设置页的共享配置。
export const sharedConfig: UserConfig = {
  root: r('src'),
  resolve: {
    alias: [
      { find: '~/', replacement: `${r('src')}/` },
      { find: '~', replacement: r('src') },
      // vuedraggable's UMD entry `require`s `vue`, which resolves to the CJS
      // build and drags the template compiler into the content script.
      // Templates are precompiled, so every consumer can share the runtime build.
      { find: /^vue$/, replacement: 'vue/dist/vue.runtime.esm-bundler.js' },
    ],
  },
  plugins: [
    Vue(),

    AutoImport({
      imports: [
        'vue',
        {
          'webextension-polyfill': [
            ['*', 'browser'],
          ],
        },
      ],
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    withCompactI18nMessages(VueI18nPlugin({
      runtimeOnly: true,
      compositionOnly: true,
      strictMessage: false,
      include: [r('./src/_locales/**')],
    })),

    // https://github.com/unocss/unocss
    // UnoCSS(),

    replace({
      '__DEV__': JSON.stringify(isDev),
      '__BUILD_COMMIT__': JSON.stringify(buildCommit),
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
      'process.env.SAFARI': JSON.stringify(isSafari),
      '__BEWLY_VERSION__': JSON.stringify(isSafari ? `${packageJson.version}.${packageJson.safariRevision}` : packageJson.version),
      'process.env.FIREFOX': JSON.stringify(isFirefox),
      '__VUE_OPTIONS_API__': JSON.stringify(true),
      '__VUE_PROD_DEVTOOLS__': JSON.stringify(false),
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': JSON.stringify(false),
      '__VUE_INSTANCE_SETTERS__': JSON.stringify(true),
      '__VUE_DEVTOOLS_HOOK_REPLAY__': JSON.stringify(true),
      'preventAssignment': true,
    }),

  ],
}

export default defineConfig({
  ...sharedConfig,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
})
