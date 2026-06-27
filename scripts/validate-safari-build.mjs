import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const extDir = path.join(root, 'extension-safari')
const manifestPath = path.join(extDir, 'manifest.json')

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

// 2. MV3
assert(manifest.manifest_version === 3, 'manifest_version must be 3')

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

// 10. MAIN world content script entry exists
const cs = manifest.content_scripts || []
const mainWorldEntry = cs.find(item => item.world === 'MAIN')
assert(mainWorldEntry, 'missing MAIN world content_script entry')

// 11. web_accessible_resources should not use <all_urls>
const war = manifest.web_accessible_resources || []
const warText = JSON.stringify(war)
assert(
  !warText.includes('<all_urls>'),
  'web_accessible_resources should not default to <all_urls>, tighten to specific domains',
)

// 12. inject.global.js should be in web_accessible_resources for fallback
assert(
  warText.includes('inject.global.js'),
  'inject.global.js should be in web_accessible_resources for script-tag fallback',
)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

console.log('Safari build validation passed.')
