import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const APP_NAME = 'BewlyCat Safari'
const EXTENSION_NAME = `${APP_NAME} Extension`
const RESOURCE_ENTRIES = ['assets', 'dist', 'manifest.json']
const XCODE_BETA_PATH = '/Applications/Xcode-beta.app'
const DEVELOPER_DIR = `${XCODE_BETA_PATH}/Contents/Developer`

const extensionDir = path.join(root, 'extension-safari')
const xcodeOutputDir = path.join(root, 'extension-safari-macos', APP_NAME)
const xcodeProjectPath = path.join(xcodeOutputDir, `${APP_NAME}.xcodeproj`)
const xcodeResourcesDir = path.join(xcodeOutputDir, EXTENSION_NAME, 'Resources')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function assertExists(targetPath, message) {
  if (!fs.existsSync(targetPath))
    fail(message)
}

function collectFiles(baseDir) {
  const files = new Map()

  function visit(relativePath) {
    const absolutePath = path.join(baseDir, relativePath)
    const stat = fs.lstatSync(absolutePath)

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(absolutePath).sort()
      for (const entry of entries)
        visit(path.join(relativePath, entry))
      return
    }

    const hash = crypto.createHash('sha256')
    if (stat.isSymbolicLink())
      hash.update(`symlink:${fs.readlinkSync(absolutePath)}`)
    else
      hash.update(fs.readFileSync(absolutePath))

    files.set(relativePath.split(path.sep).join('/'), hash.digest('hex'))
  }

  for (const entry of RESOURCE_ENTRIES) {
    const entryPath = path.join(baseDir, entry)
    assertExists(entryPath, `${path.relative(root, entryPath)} is missing`)
    visit(entry)
  }

  return files
}

function aggregateHash(files) {
  const hash = crypto.createHash('sha256')
  for (const [relativePath, fileHash] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b)))
    hash.update(`${relativePath}\0${fileHash}\n`)
  return hash.digest('hex')
}

function compareResources(sourceDir, targetDir, targetLabel) {
  assertExists(targetDir, `${targetLabel} does not exist: ${targetDir}`)

  const sourceFiles = collectFiles(sourceDir)
  const targetFiles = collectFiles(targetDir)
  const mismatches = []
  const allPaths = new Set([...sourceFiles.keys(), ...targetFiles.keys()])

  for (const relativePath of [...allPaths].sort()) {
    if (!sourceFiles.has(relativePath))
      mismatches.push(`${relativePath}: only present in ${targetLabel}`)
    else if (!targetFiles.has(relativePath))
      mismatches.push(`${relativePath}: missing from ${targetLabel}`)
    else if (sourceFiles.get(relativePath) !== targetFiles.get(relativePath))
      mismatches.push(`${relativePath}: content differs`)
  }

  if (mismatches.length > 0) {
    const details = mismatches.slice(0, 20).map(item => `  - ${item}`).join('\n')
    const remaining = mismatches.length > 20 ? `\n  - ...and ${mismatches.length - 20} more` : ''
    fail(`${targetLabel} is stale:\n${details}${remaining}`)
  }

  const digest = aggregateHash(sourceFiles)
  console.log(`OK: ${targetLabel} matches extension-safari (${sourceFiles.size} files, sha256 ${digest})`)
}

function syncXcodeResources() {
  assertExists(
    xcodeProjectPath,
    `generated Xcode project is missing. Run "pnpm package-safari" once before "pnpm sync-safari-xcode": ${xcodeProjectPath}`,
  )
  assertExists(
    xcodeResourcesDir,
    `Safari extension Resources directory is missing: ${xcodeResourcesDir}`,
  )

  collectFiles(extensionDir)

  const stagingDir = fs.mkdtempSync(path.join(xcodeOutputDir, '.bewlycat-resources-'))
  const backupDir = `${xcodeResourcesDir}.backup-${process.pid}`
  let resourcesBackedUp = false

  try {
    for (const entry of fs.readdirSync(xcodeResourcesDir)) {
      fs.cpSync(path.join(xcodeResourcesDir, entry), path.join(stagingDir, entry), {
        recursive: true,
        force: true,
      })
    }

    for (const entry of RESOURCE_ENTRIES) {
      fs.rmSync(path.join(stagingDir, entry), { recursive: true, force: true })
      fs.cpSync(path.join(extensionDir, entry), path.join(stagingDir, entry), {
        recursive: true,
        force: true,
      })
    }

    compareResources(extensionDir, stagingDir, 'staged Xcode resources')

    fs.rmSync(backupDir, { recursive: true, force: true })
    fs.renameSync(xcodeResourcesDir, backupDir)
    resourcesBackedUp = true
    fs.renameSync(stagingDir, xcodeResourcesDir)
    fs.rmSync(backupDir, { recursive: true, force: true })
    resourcesBackedUp = false
  }
  catch (error) {
    if (resourcesBackedUp && !fs.existsSync(xcodeResourcesDir) && fs.existsSync(backupDir))
      fs.renameSync(backupDir, xcodeResourcesDir)
    fs.rmSync(stagingDir, { recursive: true, force: true })
    throw error
  }

  compareResources(extensionDir, xcodeResourcesDir, 'Xcode project resources')
}

function readBuildSetting(block, name) {
  const match = block.match(new RegExp(`^\\s*${name} = (.+)$`, 'm'))
  return match?.[1]?.trim()
}

function resolveBuiltAppPath() {
  if (process.env.BEWLYCAT_APP_PATH)
    return path.resolve(process.env.BEWLYCAT_APP_PATH)

  assertExists(
    XCODE_BETA_PATH,
    `Xcode Beta is required to locate the built app: ${XCODE_BETA_PATH}`,
  )

  let output
  try {
    output = execFileSync(
      path.join(DEVELOPER_DIR, 'usr/bin/xcodebuild'),
      [
        '-project',
        xcodeProjectPath,
        '-scheme',
        APP_NAME,
        '-configuration',
        process.env.CONFIGURATION || 'Debug',
        '-showBuildSettings',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, DEVELOPER_DIR },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  }
  catch {
    fail('xcodebuild could not resolve the containing app build path')
  }

  const quotedTargetMarker = `Build settings for action build and target "${APP_NAME}":`
  const unquotedTargetMarker = `Build settings for action build and target ${APP_NAME}:`
  const targetMarker = output.includes(quotedTargetMarker)
    ? quotedTargetMarker
    : unquotedTargetMarker
  const targetStart = output.indexOf(targetMarker)
  if (targetStart < 0)
    fail(`xcodebuild output did not contain settings for target "${APP_NAME}"`)

  const nextTargetStart = output.indexOf(
    '\nBuild settings for action build and target ',
    targetStart + targetMarker.length,
  )
  const targetBlock = output.slice(targetStart, nextTargetStart < 0 ? undefined : nextTargetStart)
  const targetBuildDir = readBuildSetting(targetBlock, 'TARGET_BUILD_DIR')
  const wrapperName = readBuildSetting(targetBlock, 'WRAPPER_NAME')

  if (!targetBuildDir || !wrapperName)
    fail('xcodebuild output did not contain TARGET_BUILD_DIR and WRAPPER_NAME')

  return path.join(targetBuildDir, wrapperName)
}

function checkBuiltApp() {
  const appPath = resolveBuiltAppPath()
  const appResourcesDir = path.join(
    appPath,
    'Contents',
    'PlugIns',
    `${EXTENSION_NAME}.appex`,
    'Contents',
    'Resources',
  )

  assertExists(
    appResourcesDir,
    `built app resources are missing. Clean-build "${APP_NAME}" before checking: ${appResourcesDir}`,
  )
  compareResources(extensionDir, appResourcesDir, 'built app extension resources')
}

const args = new Set(process.argv.slice(2))
for (const arg of args) {
  if (arg !== '--check')
    fail(`unsupported argument: ${arg}`)
}

assertExists(
  path.join(extensionDir, 'manifest.json'),
  'extension-safari is missing. Run "pnpm build" before checking or use "pnpm sync-safari-xcode"',
)

if (args.has('--check')) {
  assertExists(
    xcodeProjectPath,
    `generated Xcode project is missing. Run "pnpm package-safari" once: ${xcodeProjectPath}`,
  )
  compareResources(extensionDir, xcodeResourcesDir, 'Xcode project resources')
  checkBuiltApp()
  console.log('Safari Xcode resource freshness check passed.')
}
else {
  syncXcodeResources()
  console.log('Safari Xcode resources synchronized without regenerating the project.')
}
