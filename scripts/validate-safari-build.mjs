import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const extDir = path.join(root, 'extension-safari')
const manifestPath = path.join(extDir, 'manifest.json')
const packagePath = path.join(root, 'package.json')

let failures = 0

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    failures++
  }
}

function fileExists(p) {
  return fs.existsSync(p)
}

// 1. manifest.json exists
assert(fileExists(manifestPath), 'extension-safari/manifest.json does not exist')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

// 2. MV3
assert(manifest.manifest_version === 3, 'manifest_version must be 3')
assert(
  manifest.version === `${pkg.version}.${pkg.safariRevision}`,
  'Safari manifest version must combine package version and safariRevision',
)

// 3. Background bundle exists
assert(
  fileExists(path.join(extDir, 'dist/background/index.js')),
  'dist/background/index.js missing',
)

// 4. Content script bundle exists
assert(
  fileExists(path.join(extDir, 'dist/contentScripts/index.global.js')),
  'dist/contentScripts/index.global.js missing',
)

// 5. Inject bundle exists
assert(
  fileExists(path.join(extDir, 'dist/contentScripts/inject.global.js')),
  'dist/contentScripts/inject.global.js missing',
)

// 6. Content style exists
assert(
  fileExists(path.join(extDir, 'dist/contentScripts/style.css')),
  'dist/contentScripts/style.css missing',
)

// 7. DNR rules exist
assert(
  fileExists(path.join(extDir, 'assets/rules.json')),
  'assets/rules.json missing',
)

// 8. Background configuration exists
const bg = manifest.background || {}
assert(bg.scripts || bg.service_worker, 'background configuration missing')

// 9. If background.scripts without type:"module", check for bare import/export
if (bg.scripts && !bg.type) {
  const bgPath = path.join(extDir, 'dist/background/index.js')
  if (fileExists(bgPath)) {
    const bgCode = fs.readFileSync(bgPath, 'utf8')
    const hasBareImport = /^\s*import\s/m.test(bgCode)
    const hasBareExport = /^\s*export\s/m.test(bgCode)
    assert(
      !hasBareImport && !hasBareExport,
      'background.scripts bundle uses ESM syntax (import/export) but is not declared as module',
    )
  }
}

// 10. Safari should NOT have world: "MAIN" in content_scripts
const cs = manifest.content_scripts || []
const mainWorldEntry = cs.find(item => item.world === 'MAIN')
assert(!mainWorldEntry, 'Safari manifest must not have world: "MAIN" in content_scripts')

// 11. web_accessible_resources should not use <all_urls>
const war = manifest.web_accessible_resources || []
const warText = JSON.stringify(war)
assert(
  !warText.includes('<all_urls>'),
  'web_accessible_resources should not default to <all_urls>, tighten to specific domains',
)

// 12. inject.global.js should be in web_accessible_resources for script-tag injection
assert(
  warText.includes('inject.global.js'),
  'inject.global.js should be in web_accessible_resources for script-tag injection',
)

// 13. Safari manifest should have alarms permission
const permissions = manifest.permissions || []
assert(
  permissions.includes('alarms'),
  'Safari manifest should include alarms permission',
)
assert(
  permissions.includes('scripting'),
  'Safari manifest should include scripting permission for content script recovery',
)

// 14. Safari modifyHeaders rules require the host-access DNR permission
assert(
  permissions.includes('declarativeNetRequestWithHostAccess'),
  'Safari manifest should include declarativeNetRequestWithHostAccess for modifyHeaders rules',
)
assert(
  !permissions.includes('declarativeNetRequest'),
  'Safari manifest should use declarativeNetRequestWithHostAccess instead of declarativeNetRequest',
)

// 14. Safari should NOT have persistent key (MV3 is non-persistent by default)
assert(
  bg.persistent === undefined,
  'Safari manifest background should not have persistent key (MV3 default is non-persistent)',
)

// 15. Safari should NOT have match_about_blank (unsupported)
const hasMatchAboutBlank = cs.some(item => item.match_about_blank === true)
assert(
  !hasMatchAboutBlank,
  'Safari manifest content_scripts should not use match_about_blank (unsupported)',
)
const isolatedContentScript = cs.find(item =>
  item.js?.includes('./dist/contentScripts/index.global.js'),
)
assert(
  isolatedContentScript?.exclude_matches?.includes('*://www.bilibili.com/match/game*')
  && isolatedContentScript.exclude_matches.includes('*://www.bilibili.com/toy*'),
  'Safari manifest content script should preserve upstream excluded pages',
)

// 16. Safari content bundle should contain the script-tag injection guard
const contentBundlePath = path.join(extDir, 'dist/contentScripts/index.global.js')
if (fileExists(contentBundlePath)) {
  const contentCode = fs.readFileSync(contentBundlePath, 'utf8')
  const hasFallbackReference = contentCode.includes('data-bewly-main-world-fallback')
    || contentCode.includes('ensureMainWorldInjected')
  assert(
    hasFallbackReference,
    'Safari content bundle should contain script-tag injection reference',
  )
}

// 17. JS bundles must not contain unresolved Vue compile-time feature flags.
// Only the known flags are checked. Vue internals use similar-looking identifiers
// as runtime properties (e.g. e.__VUE_DEVTOOLS_HOOK_REPLAY__) and string arguments
// (e.g. registerGlobalSetter("__VUE_INSTANCE_SETTERS__", ...)) which are NOT
// compile-time feature flags and must not be treated as false positives.
const vueFeatureFlags = [
  '__VUE_OPTIONS_API__',
  '__VUE_PROD_DEVTOOLS__',
  '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__',
]

const jsFilesToScan = [
  path.join(extDir, 'dist/background/index.js'),
  path.join(extDir, 'dist/contentScripts/index.global.js'),
  path.join(extDir, 'dist/contentScripts/inject.global.js'),
]

for (const file of jsFilesToScan) {
  if (!fileExists(file))
    continue

  const code = fs.readFileSync(file, 'utf8')
  for (const flag of vueFeatureFlags) {
    const flagRegex = new RegExp(`(?<!["'.\\w])${flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!["'\\w])`)
    const match = code.match(flagRegex)
    assert(
      !match,
      `${path.relative(root, file)} contains unresolved Vue feature flag: ${flag}`,
    )
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

console.log('Safari build validation passed.')
