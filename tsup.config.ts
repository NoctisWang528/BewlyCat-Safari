// import path from 'node:path'

// import fs from 'fs-extra'
import { defineConfig } from 'tsup'

import packageJson from './package.json'
import { isDev, isFirefox, isSafari } from './scripts/utils'

const outDir = isFirefox ? 'extension-firefox/dist' : isSafari ? 'extension-safari/dist' : 'extension/dist'

export default defineConfig(() => ({
  entry: {
    'background/index': './src/background/index.ts',
    ...(isDev ? { mv3client: './scripts/client.ts' } : {}),
  },
  async onSuccess() {
    // fs.copySync(path.resolve(__dirname, './src/inject/index.js'), path.resolve(__dirname, `./${outDir}/inject/index.js`))
  },
  outDir,
  format: isSafari ? ['iife'] : ['esm'],
  outExtension: isSafari ? () => ({ js: '.js' }) : undefined,
  target: 'esnext',
  ignoreWatch: ['**/extension/**', '**/extension-firefox/**', '**/extension-safari/**'],
  splitting: false,
  noExternal: ['md5'],
  sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
  define: {
    '__DEV__': JSON.stringify(isDev),
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
}))
