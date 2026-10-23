import type { Options } from 'tsup'
import { defineConfig } from 'tsup'

import packageJson from './package.json'
import { thirdPartyLicensesEsbuildPlugin } from './scripts/thirdPartyLicenses'
import { buildCommit, isDev, isFirefox, isSafari } from './scripts/utils'

const outDir = isFirefox ? 'extension-firefox/dist' : isSafari ? 'extension-safari/dist' : 'extension/dist'

const shared: Options = {
  outDir,
  // 统一由 clear-safari 清理，避免两个任务互删产物或删除 Vite 产物。
  clean: false,
  outExtension: () => ({ js: '.js' }),
  target: 'esnext',
  ignoreWatch: ['**/extension/**', '**/extension-firefox/**', '**/extension-safari/**'],
  splitting: false,
  loader: { '.css': 'text' },
  noExternal: ['md5'],
  esbuildPlugins: [thirdPartyLicensesEsbuildPlugin('background')],
  sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
  define: {
    '__DEV__': JSON.stringify(isDev),
    '__BUILD_COMMIT__': JSON.stringify(buildCommit),
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
    'process.env.FIREFOX': JSON.stringify(isFirefox),
    'process.env.SAFARI': JSON.stringify(isSafari),
    '__BEWLY_VERSION__': JSON.stringify(packageJson.version),

    // Vue compile-time feature flags.
    // Required because background is bundled by tsup, not Vite.
    '__VUE_OPTIONS_API__': JSON.stringify(true),
    '__VUE_PROD_DEVTOOLS__': JSON.stringify(false),
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': JSON.stringify(false),
    '__VUE_INSTANCE_SETTERS__': JSON.stringify(true),
    '__VUE_DEVTOOLS_HOOK_REPLAY__': JSON.stringify(true),
  },
  platform: 'browser',
  minifyWhitespace: !isDev,
  minifySyntax: !isDev,
}

export default defineConfig((): Options[] => [
  {
    ...shared,
    entry: {
      'background/index': './src/background/index.ts',
      'contentScripts/pageLoading': './src/contentScripts/pageLoading.ts',
    },
    format: isSafari ? ['iife'] : ['esm'],
  },
  {
    ...shared,
    entry: { 'contentScripts/listenVideoControl': './src/contentScripts/listenVideoControl.ts' },
    // 动态 import() 需要命名导出；听视频入口不能随 Safari 后台一起转为 IIFE。
    format: ['esm'],
  },
])
