import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const XCODE_BETA_PATH = '/Applications/Xcode-beta.app'
const DEVELOPER_DIR = `${XCODE_BETA_PATH}/Contents/Developer`
const EXT_DIR = path.join(root, 'extension-safari')
const OUTPUT_DIR = path.join(root, 'extension-safari-macos')
const MANIFEST_PATH = path.join(EXT_DIR, 'manifest.json')

const APP_NAME = 'BewlyCat Safari'
const BUNDLE_ID = 'com.noctiswang528.bewlycat.safari'
const LANGUAGE = 'Swift'
const PLATFORM = 'macOS'

let failures = 0

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  failures++
}

function info(msg) {
  console.log(`INFO: ${msg}`)
}

function run(cmd, opts = {}) {
  try {
    const output = execSync(cmd, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DEVELOPER_DIR },
      ...opts,
    })
    return output
  }
  catch {
    return null
  }
}

// 1. Check Xcode Beta exists
info('Checking Xcode Beta installation...')
if (!fs.existsSync(XCODE_BETA_PATH)) {
  fail(`Xcode Beta not found at ${XCODE_BETA_PATH}`)
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
info(`Found Xcode Beta at ${XCODE_BETA_PATH}`)

// 2. Check safari-web-extension-packager exists
info('Checking safari-web-extension-packager...')
const packagerPath = run(`xcrun --find safari-web-extension-packager`)
if (!packagerPath || !packagerPath.trim()) {
  fail('safari-web-extension-packager not found. Ensure Xcode 27 Beta is installed with its developer directory selected.')
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
info(`Found packager: ${packagerPath.trim()}`)

// 3. Build extension
info('Building Safari extension...')
try {
  execSync('pnpm build', { cwd: root, stdio: 'inherit', env: { ...process.env, SAFARI: 'true', DEVELOPER_DIR } })
}
catch {
  fail('pnpm build failed')
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

// 4. Validate extension
info('Validating Safari extension...')
try {
  execSync('pnpm validate-safari', { cwd: root, stdio: 'inherit', env: { ...process.env, DEVELOPER_DIR } })
}
catch {
  fail('pnpm validate-safari failed')
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

// 5. Verify no unsupported manifest keys
info('Checking manifest for unsupported Safari keys...')
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
const manifestStr = JSON.stringify(manifest, null, 2)

if (manifestStr.includes('"persistent"')) {
  fail('Manifest contains unsupported "persistent" key')
}
if (manifestStr.includes('"world"')) {
  fail('Manifest contains unsupported "world" key')
}
if (manifestStr.includes('"match_about_blank"')) {
  fail('Manifest contains unsupported "match_about_blank" key')
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

// 6. Clean old Xcode output
info('Cleaning old Xcode output...')
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
}

// 7. Run packager
info('Running safari-web-extension-packager...')
const packagerArgs = [
  'safari-web-extension-packager',
  EXT_DIR,
  '--project-location',
  OUTPUT_DIR,
  '--app-name',
  APP_NAME,
  '--bundle-identifier',
  BUNDLE_ID,
  `--${LANGUAGE.toLowerCase()}`,
  `--${PLATFORM.toLowerCase()}-only`,
  '--copy-resources',
  '--no-open',
  '--no-prompt',
  '--force',
]

const packagerResult = spawnSync('xcrun', packagerArgs, {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, DEVELOPER_DIR },
  stdio: ['pipe', 'pipe', 'pipe'],
})

if (packagerResult.error) {
  fail(`safari-web-extension-packager failed: ${packagerResult.error.message}`)
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

if (packagerResult.status !== 0) {
  fail(`safari-web-extension-packager exited with code ${packagerResult.status}`)
  if (packagerResult.stderr) {
    console.error(packagerResult.stderr)
  }
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

const packagerOutput = packagerResult.stdout + packagerResult.stderr

if (/Warning: The following keys[\s\S]*not supported/i.test(packagerOutput)) {
  fail(`Packager reported unsupported manifest keys:\n${packagerOutput}`)
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

info(packagerOutput)

// 8. Verify generated project exists
info('Verifying generated Xcode project...')
// The packager generates the project at: OUTPUT_DIR/APP_NAME/APP_NAME.xcodeproj
const xcodeprojPath = path.join(OUTPUT_DIR, APP_NAME, `${APP_NAME}.xcodeproj`)
if (!fs.existsSync(xcodeprojPath)) {
  fail(`Generated .xcodeproj not found at ${xcodeprojPath}`)
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

// Verify extension manifest in generated project
const generatedManifest = path.join(OUTPUT_DIR, APP_NAME, `${APP_NAME} Extension`, 'Resources', 'manifest.json')
if (!fs.existsSync(generatedManifest)) {
  fail(`Generated extension manifest not found at ${generatedManifest}`)
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}

console.log(`\nSafari packaging completed successfully.`)
console.log(`Xcode project: ${xcodeprojPath}`)
console.log(`Extension dir: ${EXT_DIR}`)
