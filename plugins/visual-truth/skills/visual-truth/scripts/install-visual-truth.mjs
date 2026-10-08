#!/usr/bin/env node

import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { reportAnonymousInstall } from './install-analytics.mjs'

const projectRoot = resolve(process.argv[2] || process.cwd())
const visualTruthVersion = '1.3.0'
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundledPackage = join(pluginRoot, 'assets', 'visual-truth-package')
const stablePackage = join(homedir(), '.codex', 'tools', 'visual-truth')
const scratch = await mkdtemp(join(tmpdir(), 'visual-truth-install-'))
const stableBackup = join(scratch, 'stable-package-backup')

let manager = 'npm'
let snapshot = new Map()
let hadStablePackage = false
let stableTouched = false

const lockfileCandidates = [
  ['pnpm', 'pnpm-lock.yaml'],
  ['yarn', 'yarn.lock'],
  ['bun', 'bun.lockb'],
  ['bun', 'bun.lock'],
  ['npm', 'package-lock.json'],
]

try {
  const projectPackagePath = join(projectRoot, 'package.json')
  await requireFile(projectPackagePath, 'Unsupported project: no package.json was found. No files were changed.')
  await requireFile(join(bundledPackage, 'package.json'), 'The Visual Truth package is missing from the plugin.')

  const projectPackage = await readJson(projectPackagePath, 'The target package.json is not valid JSON.')
  assertCompatibleReactProject(projectPackage)

  manager = await detectPackageManager(projectRoot)
  assertCommandAvailable(manager)
  assertCommandAvailable('npm')

  const bridgePlan = await planSourceBridge(projectRoot, pluginRoot)
  const trackedFiles = [
    projectPackagePath,
    ...lockfileCandidates.map(([, file]) => join(projectRoot, file)),
    ...bridgePlan.trackedFiles,
  ]
  snapshot = await captureFiles(trackedFiles)

  hadStablePackage = await exists(stablePackage)
  if (hadStablePackage) await cp(stablePackage, stableBackup, { recursive: true })

  const stagedPackage = join(scratch, 'visual-truth')
  await cp(bundledPackage, stagedPackage, { recursive: true })
  const archiveName = packVisualTruth(stagedPackage)
  const stagedArchive = join(stagedPackage, archiveName)

  await mkdir(dirname(stablePackage), { recursive: true })
  stableTouched = true
  await rm(stablePackage, { recursive: true, force: true })
  await cp(stagedPackage, stablePackage, { recursive: true })
  const packageArchive = join(stablePackage, archiveName)
  await requireFile(packageArchive, 'The Visual Truth package archive was not created.')

  installPackage(manager, packageArchive)
  failForTest('install')

  if (bridgePlan.configured) {
    await applySourceBridge(bridgePlan)
    failForTest('bridge')
  }

  console.log(`Visual Truth ${visualTruthVersion} installed with ${manager}. Mount <VisualTruth /> behind the project's development-only guard.`)
  if (bridgePlan.configured) {
    console.log('The local Make It Code source bridge is ready.')
  } else {
    console.log(`Automatic source-bridge setup was skipped: ${bridgePlan.reason}`)
    console.log('The package is installed, but Codex must mount VisualTruth and configure visualTruthSourcePlugin() manually for this project structure.')
  }

  const analyticsResult = await reportAnonymousInstall({ version: visualTruthVersion })
  if (analyticsResult === 'recorded') {
    console.log('Anonymous Visual Truth installation count recorded. No project or user information was sent.')
  }

  await rm(stagedArchive, { force: true })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Visual Truth installation failed: ${message}\n`)
  process.stderr.write('Restoring the project to its pre-install state.\n')
  await restoreFiles(snapshot)
  if (stableTouched) await restoreStablePackage()
  if (snapshot.size > 0) restoreDependencies(manager)
  process.stderr.write('Rollback complete. Review the message above before trying again.\n')
  process.exitCode = 1
} finally {
  await rm(scratch, { recursive: true, force: true })
}

async function planSourceBridge(root, sourcePluginRoot) {
  const viteConfig = await firstExisting(root, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts'])
  const entry = await firstExisting(root, ['src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js'])
  const trackedFiles = []
  if (viteConfig) trackedFiles.push(viteConfig)
  if (entry) trackedFiles.push(entry, join(dirname(entry), 'visual-truth.generated.ts'))

  if (!viteConfig) {
    return { configured: false, reason: 'no conventional Vite configuration file was found', trackedFiles }
  }
  if (!entry) {
    return { configured: false, reason: 'no conventional React application entry file was found', trackedFiles }
  }

  const viteOriginal = await readFile(viteConfig, 'utf8')
  let viteSource = viteOriginal
  if (!viteSource.includes('visualTruthSourcePlugin')) {
    if (!/plugins\s*:\s*\[/.test(viteSource)) {
      return { configured: false, reason: 'the Vite config does not expose a conventional plugins array', trackedFiles }
    }
    viteSource = `import { visualTruthSourcePlugin } from 'visual-truth/vite'\n${viteSource}`
    viteSource = viteSource.replace(/plugins\s*:\s*\[/, 'plugins: [visualTruthSourcePlugin(), ')
  }

  const entryOriginal = await readFile(entry, 'utf8')
  let entrySource = entryOriginal
  if (!entrySource.includes('installVisualTruthPatches')) {
    entrySource = `import { installVisualTruthPatches } from './visual-truth.generated'\n${entrySource}\n\ninstallVisualTruthPatches()\n`
  }

  const generatedPath = join(dirname(entry), 'visual-truth.generated.ts')
  const generatedSource = await exists(generatedPath)
    ? null
    : await readFile(join(sourcePluginRoot, 'assets', 'visual-truth-generated.ts'), 'utf8')

  return {
    configured: true,
    trackedFiles,
    viteConfig,
    viteSource,
    entry,
    entrySource,
    generatedPath,
    generatedSource,
  }
}

async function applySourceBridge(plan) {
  await writeFile(plan.viteConfig, plan.viteSource, 'utf8')
  await writeFile(plan.entry, plan.entrySource, 'utf8')
  if (plan.generatedSource !== null) await writeFile(plan.generatedPath, plan.generatedSource, 'utf8')
}

function assertCompatibleReactProject(projectPackage) {
  const dependencyGroups = [
    projectPackage.dependencies,
    projectPackage.devDependencies,
    projectPackage.peerDependencies,
  ]
  const reactRange = dependencyGroups.find((group) => group?.react)?.react
  if (!reactRange) {
    throw new Error('Unsupported project: Visual Truth requires an existing React 18.2 or React 19 application. No files were changed.')
  }
  if (!/(^|\D)(18|19)(\D|$)/.test(String(reactRange))) {
    throw new Error(`Unsupported React range "${reactRange}". Visual Truth ${visualTruthVersion} supports React 18.2 and React 19. No files were changed.`)
  }
}

function packVisualTruth(packageRoot) {
  const result = spawnSync('npm', ['pack', '--silent', '--pack-destination', packageRoot], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || 'Unable to package Visual Truth.')
  const archiveName = result.stdout.trim().split(/\r?\n/).at(-1)
  if (!archiveName) throw new Error('The Visual Truth package archive was not created.')
  return archiveName
}

function installPackage(packageManager, packageArchive) {
  const commands = {
    npm: ['npm', ['install', '--save-dev', packageArchive]],
    pnpm: ['pnpm', ['add', '--save-dev', packageArchive]],
    yarn: ['yarn', ['add', '--dev', packageArchive]],
    bun: ['bun', ['add', '--dev', packageArchive]],
  }
  const [command, args] = commands[packageManager]
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8', stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${packageManager} could not add the Visual Truth package.`)
}

function restoreDependencies(packageManager) {
  const commands = {
    npm: ['npm', ['install', '--ignore-scripts']],
    pnpm: ['pnpm', ['install', '--frozen-lockfile', '--ignore-scripts']],
    yarn: ['yarn', ['install', '--frozen-lockfile', '--ignore-scripts']],
    bun: ['bun', ['install', '--frozen-lockfile', '--ignore-scripts']],
  }
  const selected = commands[packageManager]
  if (!selected || !commandAvailable(selected[0])) return
  const result = spawnSync(selected[0], selected[1], { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) {
    process.stderr.write(`Dependency cleanup needs manual review: ${result.stderr || `${packageManager} install failed.`}\n`)
  }
}

async function captureFiles(paths) {
  const files = new Map()
  for (const path of new Set(paths)) {
    files.set(path, (await exists(path)) ? await readFile(path) : null)
  }
  return files
}

async function restoreFiles(files) {
  for (const [path, contents] of files) {
    if (contents === null) {
      await rm(path, { force: true })
    } else {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, contents)
    }
  }
}

async function restoreStablePackage() {
  await rm(stablePackage, { recursive: true, force: true })
  if (hadStablePackage) await cp(stableBackup, stablePackage, { recursive: true })
}

async function readJson(path, message) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new Error(message)
  }
}

async function firstExisting(root, candidates) {
  for (const candidate of candidates) {
    const path = join(root, candidate)
    if (await exists(path)) return path
  }
  return null
}

async function detectPackageManager(root) {
  for (const [packageManager, lockfile] of lockfileCandidates) {
    if (await exists(join(root, lockfile))) return packageManager
  }
  return 'npm'
}

function assertCommandAvailable(command) {
  if (!commandAvailable(command)) {
    throw new Error(`The ${command} command is required for this project but is not available. No files were changed.`)
  }
}

function commandAvailable(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', stdio: 'pipe' })
  return !result.error && result.status === 0
}

function failForTest(stage) {
  if (process.env.VISUAL_TRUTH_TEST_FAIL_AFTER === stage) {
    throw new Error(`Test-only failure after ${stage}.`)
  }
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function requireFile(path, message) {
  if (!(await exists(path))) throw new Error(message)
}
