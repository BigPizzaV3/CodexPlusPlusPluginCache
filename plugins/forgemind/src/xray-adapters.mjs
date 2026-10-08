import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';

import { artifactStatePath } from './artifact-store.mjs';
import { redactText } from './redact.mjs';

const UNSAFE_COMMAND_PATTERN = /\b(?:migrate|deploy|publish|seed|reset|delete|destroy|drop|truncate|production)\b/i;
const WINDOWS_BATCH_COMMAND_PATTERN = /\.(?:bat|cmd)$/i;
const WINDOWS_COMMAND_CHAIN_PATTERN = /[&|<>^%!\r\n]/;
const BROWSER_PROTOCOL = 'forgemind-xray-browser-v1';
const BROWSER_EVIDENCE_PREFIX = '.codex-orchestrator/xray/browser';
const BROWSER_COMPONENT_IDS = ['gui-usability', 'accessibility-visual'];
const BROWSER_STATUSES = new Set(['passed', 'failed', 'blocked', 'skipped']);
const BROWSER_FAILURE_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const SAFE_BROWSER_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BROWSER_PATTERN_TYPES = new Set(['', 'email', 'password', 'search', 'tel', 'text', 'url']);
const BROWSER_INVALID_PATTERN_PROBES = ['0', 'x', 'X', '-', '_', '!', ' ', '0000', 'xray.invalid', 'test@example.invalid'];
const DANGEROUS_BROWSER_CONTROL_PATTERN = /\b(?:admin|approve|buy|checkout|credential|delete|deploy|destroy|drop|invite|order|password|pay|payment|production|publish|purchase|release|remove|reset|save|secret|seed|send|sign[ -]?in|submit|token|transfer|truncate|upload)\b/i;
const PLAYWRIGHT_SETUP_ACTION = 'Run `npm install --save-dev playwright`, then `npx playwright install chromium`.';
const ANDROID_EVIDENCE_PREFIX = '.codex-orchestrator/xray/android';
const ANDROID_COMPONENT_IDS = ['functional-correctness', 'gui-usability', 'accessibility-visual', 'robustness-error-paths'];

export async function executeAndroidAdapter({ workspace, profile = {}, runProcess }) {
  const devices = await executeAdb(runProcess, ['devices'], workspace);
  if (isUnavailableTool(devices)) {
    return androidGapResult('FM_XRAY_ADB_UNAVAILABLE', 'Android Debug Bridge (adb) is unavailable, so Xray cannot test the Android emulator.', 'Install Android platform-tools, ensure `adb` is on PATH, then rerun Xray.');
  }
  if (devices.truncated) return androidTruncationGap('device discovery');
  const emulator = selectAndroidEmulator(devices);
  if (emulator.gap) return emulator.gap;
  const { serial } = emulator;

  const manifestResult = await findAndroidManifest(workspace, profile);
  if (manifestResult?.gap) return manifestResult.gap;
  const manifest = manifestResult?.manifest;
  if (!manifest?.packageName) {
    return androidGapResult('FM_XRAY_ANDROID_PACKAGE_UNAVAILABLE', 'Xray could not resolve an Android package name from a local AndroidManifest.xml.', 'Add a valid local AndroidManifest.xml with a package name, then rerun Xray.', { serial });
  }

  const baseArgs = ['-s', serial];
  const boundaryResult = await executeAdb(runProcess, [...baseArgs, 'shell', 'date', '+%m-%d %H:%M:%S.000'], workspace);
  if (boundaryResult.truncated) return androidTruncationGap('log boundary', { serial, packageName: manifest.packageName });
  const logBoundary = parseAndroidLogBoundary(boundaryResult);
  if (!logBoundary) {
    return androidGapResult('FM_XRAY_ANDROID_LOG_BOUNDARY_UNAVAILABLE', 'Xray could not establish an Android log timestamp boundary before app launch.', 'Ensure the emulator shell date command is available, then rerun Xray.', { serial, packageName: manifest.packageName });
  }
  const resolved = await executeAdb(runProcess, [...baseArgs, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', manifest.packageName], workspace);
  if (resolved.truncated) return androidTruncationGap('activity resolution', { serial, packageName: manifest.packageName });
  const activity = resolveAndroidActivity(resolved, manifest.packageName);
  if (!activity) {
    return androidGapResult('FM_XRAY_ANDROID_ACTIVITY_UNAVAILABLE', `The installed Android package ${manifest.packageName} has no resolvable launch activity on ${serial}.`, 'Install a runnable debug build on the selected emulator and verify its launch activity, then rerun Xray.', { serial, packageName: manifest.packageName });
  }

  const launched = await executeAdb(runProcess, [...baseArgs, 'shell', 'am', 'start', '-n', activity], workspace);
  if (launched.truncated) return androidTruncationGap('activity launch', { serial, packageName: manifest.packageName, activity });
  if (launched.exitCode !== 0) {
    return androidGapResult('FM_XRAY_ANDROID_ACTIVITY_UNAVAILABLE', `Xray could not start the resolved Android activity ${activity} on ${serial}.`, 'Install a runnable debug build and verify its launch activity, then rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }

  const pidResult = await executeAdb(runProcess, [...baseArgs, 'shell', 'pidof', '-s', manifest.packageName], workspace);
  if (pidResult.truncated) return androidTruncationGap('process discovery', { serial, packageName: manifest.packageName, activity });
  const pid = String(pidResult.stdout ?? '').trim().match(/^\d+$/)?.[0] ?? null;
  if (!pid) {
    return androidGapResult('FM_XRAY_ANDROID_LOG_UNAVAILABLE', `The launched package ${manifest.packageName} did not expose a process id for package-scoped log collection.`, 'Keep the debug app running on the emulator and rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }

  const beforeUiTree = await executeAdb(runProcess, [...baseArgs, 'exec-out', 'uiautomator', 'dump', '/dev/tty'], workspace);
  if (beforeUiTree.truncated) return androidTruncationGap('pre-flow UI tree', { serial, packageName: manifest.packageName, activity });
  if (beforeUiTree.exitCode !== 0 || !isAndroidUiTree(beforeUiTree.stdout)) {
    return androidGapResult('FM_XRAY_ANDROID_UI_EVIDENCE_UNAVAILABLE', `Xray could not capture the Android UI tree for ${activity} on ${serial}.`, 'Unlock the emulator, keep the app foregrounded, and rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  const controls = androidControls(String(beforeUiTree.stdout ?? ''));
  const control = selectSafeAndroidControl(controls);
  if (!control) {
    return androidGapResult('FM_XRAY_ANDROID_SAFE_FLOW_UNAVAILABLE', `Xray found no non-destructive, UI-tree-derived control to exercise in ${activity} on ${serial}.`, 'Expose a safe help, details, menu, or view control in the debug app, then rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  const tapped = await executeAdb(runProcess, [...baseArgs, 'shell', 'input', 'tap', String(control.center.x), String(control.center.y)], workspace);
  if (tapped.truncated) return androidTruncationGap('safe UI interaction', { serial, packageName: manifest.packageName, activity });
  if (tapped.exitCode !== 0) {
    return androidGapResult('FM_XRAY_ANDROID_SAFE_FLOW_UNAVAILABLE', `Xray could not exercise the safe ${control.label} control in ${activity} on ${serial}.`, 'Unlock the emulator and verify that the safe control remains actionable, then rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  const uiTree = await executeAdb(runProcess, [...baseArgs, 'exec-out', 'uiautomator', 'dump', '/dev/tty'], workspace);
  if (uiTree.truncated) return androidTruncationGap('post-flow UI tree', { serial, packageName: manifest.packageName, activity });
  if (uiTree.exitCode !== 0 || !isAndroidUiTree(uiTree.stdout)) {
    return androidGapResult('FM_XRAY_ANDROID_SAFE_FLOW_UNAVAILABLE', `The ${control.label} interaction did not leave observable Android UI evidence.`, 'Inspect the safe interaction in the emulator and rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  if (!isMeaningfulUiTransition(beforeUiTree.stdout, uiTree.stdout)) {
    return androidGapResult('FM_XRAY_ANDROID_FLOW_ASSERTION_UNAVAILABLE', `The ${control.label} interaction did not produce an observable Android UI transition.`, 'Choose a safe informational control with a visible state change, then rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  const foreground = await executeAdb(runProcess, [...baseArgs, 'shell', 'dumpsys', 'window', 'windows'], workspace);
  if (foreground.truncated) return androidTruncationGap('foreground verification', { serial, packageName: manifest.packageName, activity });
  if (foreground.exitCode !== 0 || !isAndroidPackageForeground(foreground.stdout, manifest.packageName)) {
    return androidGapResult('FM_XRAY_ANDROID_FLOW_ASSERTION_UNAVAILABLE', `The ${control.label} interaction did not leave ${manifest.packageName} as the foreground Android package.`, 'Choose a safe in-app informational control and rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  const screenshot = await executeAdb(runProcess, [...baseArgs, 'exec-out', 'screencap', '-p'], workspace);
  if (screenshot.truncated) return androidTruncationGap('screenshot', { serial, packageName: manifest.packageName, activity });
  if (screenshot.exitCode !== 0 || !isPngScreenshot(screenshot)) {
    return androidGapResult('FM_XRAY_ANDROID_SCREENSHOT_UNAVAILABLE', `Xray could not capture an Android screenshot for ${activity} on ${serial}.`, 'Unlock the emulator, keep the app foregrounded, and rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }
  const logcat = await executeAdb(runProcess, [...baseArgs, 'logcat', '-d', '-T', logBoundary, '--pid', pid], workspace);
  if (logcat.truncated) return androidTruncationGap('package-scoped logcat', { serial, packageName: manifest.packageName, activity });
  if (logcat.exitCode !== 0) {
    return androidGapResult('FM_XRAY_ANDROID_LOG_UNAVAILABLE', `Xray could not collect package-scoped logcat evidence for ${manifest.packageName} on ${serial}.`, 'Ensure the debug app process remains available and rerun Xray.', { serial, packageName: manifest.packageName, activity });
  }

  const artifactDirectory = artifactStatePath(workspace, 'xray', 'android', 'latest');
  await mkdir(artifactDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(artifactDirectory, 'ui-tree-before.xml'), String(beforeUiTree.stdout ?? ''), 'utf8'),
    writeFile(path.join(artifactDirectory, 'ui-tree.xml'), String(uiTree.stdout ?? ''), 'utf8'),
    writeFile(path.join(artifactDirectory, 'screenshot.png'), processOutputBuffer(screenshot)),
    writeFile(path.join(artifactDirectory, 'logcat.txt'), redactText(String(logcat.stdout ?? '')).text, 'utf8'),
  ]);
  const evidence = [`${ANDROID_EVIDENCE_PREFIX}/latest/ui-tree-before.xml`, `${ANDROID_EVIDENCE_PREFIX}/latest/ui-tree.xml`, `${ANDROID_EVIDENCE_PREFIX}/latest/screenshot.png`, `${ANDROID_EVIDENCE_PREFIX}/latest/logcat.txt`];
  const logText = redactText(String(logcat.stdout ?? '')).text;
  const logFailure = /(?:FATAL EXCEPTION|AndroidRuntime|\bE\/[A-Za-z0-9_.-]+\s*\()/i.test(logText);
  return {
    adapter: 'android-adb', control: 'computer-use', surfaceId: 'mobile-gui', surfaceIds: ['mobile-gui'],
    componentIds: [...ANDROID_COMPONENT_IDS], status: logFailure ? 'failed' : 'passed', ...(logFailure ? { severity: 'high' } : {}), serial, packageName: manifest.packageName, activity,
    controls, evidence, screenshot: evidence[2], beforeUiTree: evidence[0], afterUiTree: evidence[1], uiTree: evidence[1], log: evidence[3], logBoundary,
    controlLabel: control.label, action: 'tap safe control',
    expected: `The non-destructive ${control.label} control remains actionable and leaves observable UI evidence.`,
    actual: logFailure ? 'Android logcat recorded an application error after the safe control interaction.' : `The ${control.label} control was tapped, changed the visible UI, and kept the application foregrounded.`,
    reproduction: `Launch ${activity} on ${serial}, then tap the UI-tree-derived ${control.label} control at ${control.bounds}.`,
  };
}

async function executeAdb(runProcess, args, workspace) {
  try {
    const capture = args.includes('screencap') ? { binaryOutput: true, maxOutputBytes: 8 * 1024 * 1024 }
      : args.includes('uiautomator') || args.includes('logcat') ? { maxOutputBytes: 1024 * 1024 } : {};
    return await runProcess('adb', args, { cwd: workspace, ...capture });
  } catch (error) {
    return { exitCode: 127, stdout: '', stderr: error?.message ?? String(error) };
  }
}

function isUnavailableTool(result = {}) {
  return result.exitCode === 127 || /\b(?:adb: command not found|ENOENT|not recognized as an internal or external command)\b/i.test(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
}

function selectAndroidEmulator(result = {}) {
  if (result.exitCode !== 0) return { gap: androidGapResult('FM_XRAY_ANDROID_EMULATOR_UNAVAILABLE', 'adb could not enumerate an authorized Android emulator.', 'Start exactly one authorized Android emulator, then rerun Xray.') };
  const emulators = String(result.stdout ?? '').split(/\r?\n/)
    .map((line) => line.trim().match(/^(emulator-\d+)\s+device(?:\s|$)/)?.[1])
    .filter(Boolean);
  if (emulators.length === 1) return { serial: emulators[0] };
  if (emulators.length > 1) {
    return { gap: androidGapResult('FM_XRAY_ANDROID_EMULATOR_AMBIGUOUS', 'More than one authorized Android emulator is connected; Xray will not choose one autonomously.', 'Stop all but one emulator or provide an explicit approved emulator serial policy.') };
  }
  return { gap: androidGapResult('FM_XRAY_ANDROID_EMULATOR_UNAVAILABLE', 'No authorized Android emulator is available through adb; physical devices are not selected autonomously.', 'Start exactly one Android emulator, then rerun Xray.') };
}

async function findAndroidManifest(workspace, profile) {
  const profileManifest = profile.androidManifest;
  if (typeof profileManifest === 'string') return { manifest: parseAndroidManifest(profileManifest) };
  if (typeof profile.androidManifestPath === 'string') {
    const explicitPath = path.resolve(workspace, profile.androidManifestPath);
    const relative = path.relative(path.resolve(workspace), explicitPath);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      try {
        return { manifest: parseAndroidManifest(await readFile(explicitPath, 'utf8')) };
      } catch {
        return { gap: androidGapResult('FM_XRAY_ANDROID_PACKAGE_UNAVAILABLE', 'The explicitly configured Android manifest cannot be read.', 'Provide a readable workspace-local Android manifest path, then rerun Xray.') };
      }
    }
    return { gap: androidGapResult('FM_XRAY_ANDROID_PACKAGE_UNAVAILABLE', 'The configured Android manifest path is outside the workspace.', 'Provide a workspace-local Android manifest path, then rerun Xray.') };
  }
  const manifests = (await findFilesNamed(workspace, 'AndroidManifest.xml')).toSorted((left, right) => left.localeCompare(right));
  const appManifests = manifests.filter((manifestPath) => /(?:^|[\\/])app[\\/]src[\\/]main[\\/]AndroidManifest\.xml$/i.test(manifestPath));
  const candidates = appManifests.length > 0 ? appManifests : manifests.filter((manifestPath) => /(?:^|[\\/])src[\\/]main[\\/]AndroidManifest\.xml$/i.test(manifestPath));
  if (candidates.length > 1) {
    return { gap: androidGapResult('FM_XRAY_ANDROID_MANIFEST_AMBIGUOUS', 'Multiple Android application manifests are eligible and Xray will not guess a package.', 'Provide an explicit Android manifest profile path or retain one app src/main manifest.') };
  }
  for (const manifestPath of candidates) {
    try {
      const parsed = parseAndroidManifest(await readFile(manifestPath, 'utf8'));
      if (parsed?.packageName) return { manifest: parsed };
    } catch {
      // Continue to the next local manifest.
    }
  }
  return { manifest: null };
}

function parseAndroidManifest(xml) {
  const packageName = String(xml ?? '').match(/<manifest\b[^>]*\bpackage\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
  return packageName ? { packageName } : null;
}

async function findFilesNamed(root, fileName, relative = '') {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.codex-orchestrator') continue;
    const target = path.join(root, relative, entry.name);
    if (entry.isFile() && entry.name === fileName) files.push(target);
    else if (entry.isDirectory()) files.push(...await findFilesNamed(root, fileName, path.join(relative, entry.name)));
  }
  return files;
}

function resolveAndroidActivity(result, packageName) {
  if (result?.exitCode !== 0) return null;
  const candidate = String(result.stdout ?? '').trim().split(/\s+/)[0] ?? '';
  if (!candidate) return null;
  if (candidate.includes('/')) return candidate.startsWith(`${packageName}/`) ? candidate : null;
  if (candidate.startsWith('.')) return `${packageName}/${candidate}`;
  return candidate.startsWith(packageName) ? `${packageName}/${candidate}` : null;
}

function androidControls(xml) {
  const controls = [];
  for (const node of String(xml ?? '').matchAll(/<node\b([^>]*)\/?>(?:<\/node>)?/g)) {
    const attributes = node[1];
    if (!/\bclickable\s*=\s*["']true["']/i.test(attributes)) continue;
    const bounds = attributes.match(/\bbounds\s*=\s*["'](\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\])["']/i);
    if (!bounds) continue;
    const label = attributes.match(/\b(?:text|content-desc|resource-id)\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() || 'Unnamed control';
    const [left, top, right, bottom] = bounds.slice(2).map(Number);
    controls.push({ label: redactText(label).text, bounds: bounds[1], center: { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2) } });
  }
  return controls;
}

function selectSafeAndroidControl(controls) {
  const safe = /^(?:help(?:\s+(?:center|info|information|details))?|details|info(?:rmation)?|learn\s+more|more\s+(?:info|details)|view\s+details|menu)$/i;
  const consequential = /\b(?:account|subscription|billing|payment|plan|profile|settings?|sign|login|logout|delete|remove|purchase|order|send|save|submit|continue|next|back|cancel|close|toggle)\b/i;
  return controls.find((control) => safe.test(control.label) && !consequential.test(control.label) && !DANGEROUS_BROWSER_CONTROL_PATTERN.test(control.label)) ?? null;
}

function parseAndroidLogBoundary(result = {}) {
  return String(result.stdout ?? '').trim().match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}$/)?.[0] ?? null;
}

function isMeaningfulUiTransition(before, after) {
  return String(before ?? '').replace(/\s+/g, ' ').trim() !== String(after ?? '').replace(/\s+/g, ' ').trim();
}

function isAndroidPackageForeground(value, packageName) {
  const escapedPackage = escapeRegExp(packageName);
  const packagePattern = new RegExp(`(?:^|[^A-Za-z0-9_.])${escapedPackage}(?=[/.]|$)`);
  return String(value ?? '').split(/\r?\n/).some((line) => /\bm(?:CurrentFocus|FocusedApp|ResumedActivity)\b/i.test(line)
    && packagePattern.test(line));
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAndroidUiTree(value) {
  return /<hierarchy\b[\s\S]*<\/hierarchy>|<hierarchy\b[^>]*\/>/i.test(String(value ?? '').trim());
}

function isPngScreenshot(result = {}) {
  const output = processOutputBuffer(result);
  return output.length >= 8 && output.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function processOutputBuffer(result = {}) {
  if (Buffer.isBuffer(result.stdoutBuffer)) return result.stdoutBuffer;
  return Buffer.from(String(result.stdout ?? ''), 'binary');
}

function androidGapResult(code, message, nextAction, details = {}) {
  return {
    adapter: 'android-adb', control: 'computer-use', surfaceId: 'mobile-gui', surfaceIds: ['mobile-gui'],
    componentIds: [...ANDROID_COMPONENT_IDS], status: 'blocked', evidence: [], ...details,
    gap: { code, surfaceId: 'mobile-gui', control: 'computer-use', message, nextAction },
  };
}

function androidTruncationGap(stage, details = {}) {
  return androidGapResult('FM_XRAY_ANDROID_EVIDENCE_TRUNCATED', `Android ${stage} output exceeded Xray's bounded capture limit and cannot be treated as valid evidence.`, 'Reduce the captured surface or log volume and rerun Xray.', details);
}

export async function executeBrowserAdapter({
  url,
  workspace,
  runProcess,
  startProcess = startManagedBrowserProcess,
  probeUrl = probeBrowserUrl,
}) {
  const target = normalizeBrowserTarget(url);
  if (!target) {
    return [browserGapResult(
      'FM_XRAY_BROWSER_TARGET_UNSAFE',
      'Browser execution is restricted to explicit loopback or reserved .test URLs.',
      'Provide --test-url with an http(s) localhost, 127.0.0.0/8, ::1, or reserved .test target.',
    )];
  }

  const runner = await resolveLocalPlaywright(workspace);
  if (!runner) {
    return [browserGapResult(
      'FM_XRAY_PLAYWRIGHT_UNAVAILABLE',
      'A declared workspace-local playwright or @playwright/test package is unavailable.',
      PLAYWRIGHT_SETUP_ACTION,
    )];
  }

  const runId = randomUUID();
  const artifactDirectory = artifactStatePath(workspace, 'xray', 'browser');
  const flowArtifactDirectory = path.join(artifactDirectory, `run-${runId}`);
  const flowEvidencePrefix = `${BROWSER_EVIDENCE_PREFIX}/run-${runId}`;
  const scriptPath = path.join(artifactDirectory, `run-${runId}.spec.mjs`);
  const configPath = path.join(artifactDirectory, `run-${runId}.config.mjs`);
  const outputDirectory = path.join(flowArtifactDirectory, 'playwright-output');
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(scriptPath, createBrowserRunnerScript({
    target,
    artifactDirectory: flowArtifactDirectory,
    evidencePrefix: flowEvidencePrefix,
    importSpecifier: runner.importSpecifier,
    adapterImportSpecifier: import.meta.url,
  }), { encoding: 'utf8', flag: 'wx' });
  await writeFile(configPath, createBrowserRunnerConfig({
    artifactDirectory,
    outputDirectory,
    scriptName: path.basename(scriptPath),
  }), { encoding: 'utf8', flag: 'wx' });

  const invokeRunner = async () => {
    try {
      const scriptArgument = workspaceRelativePath(workspace, scriptPath);
      const configArgument = workspaceRelativePath(workspace, configPath);
      return await runProcess(process.execPath, [
        runner.cliPath,
        'test',
        scriptArgument,
        '--config',
        configArgument,
        '--reporter=line',
        '--workers=1',
      ], { cwd: workspace });
    } catch (error) {
      return { exitCode: 127, stdout: '', stderr: error?.message ?? String(error) };
    }
  };

  let result;
  let protocol = { receipts: [], invalidEvidenceCount: 0, invalidReceiptCount: 0, invalidReceipts: [] };
  let serverFailure = null;
  let managedServer = null;
  try {
    result = await invokeRunner();
    protocol = await parseBrowserProtocol(result?.stdout, target, {
      workspace,
      flowArtifactDirectory,
      flowEvidencePrefix,
    });

    const initialFailure = classifyBrowserRunnerFailure(result, protocol);
    if (protocol.receipts.length === 0 && initialFailure.code === 'FM_XRAY_BROWSER_TARGET_UNAVAILABLE') {
      const serverCandidate = await resolveLocalBrowserServer(workspace, target);
      if (serverCandidate) {
        try {
          managedServer = await startProcess(serverCandidate.command, serverCandidate.args, serverCandidate.options);
          const ready = managedServer && await waitForBrowserTarget(target, probeUrl, managedServer);
          if (!ready) {
            result = withManagedServerDiagnostics(result, managedServer);
            serverFailure = {
              code: 'FM_XRAY_BROWSER_SERVER_START_FAILED',
              message: `The detected local ${serverCandidate.label} server did not become reachable at the explicit test URL.`,
              nextAction: 'Inspect the local server startup output, correct the test URL or development-server configuration, and rerun Xray.',
            };
          } else {
            result = await invokeRunner();
            protocol = await parseBrowserProtocol(result?.stdout, target, {
              workspace,
              flowArtifactDirectory,
              flowEvidencePrefix,
            });
          }
        } catch (error) {
          result = {
            exitCode: 1,
            stdout: '',
            stderr: redactText(error?.message ?? String(error)).text,
          };
          serverFailure = {
            code: 'FM_XRAY_BROWSER_SERVER_START_FAILED',
            message: `The detected local ${serverCandidate.label} server could not be started safely.`,
            nextAction: 'Repair the declared workspace-local development server, then rerun Xray against the same explicit test URL.',
          };
        }
      }
    }
  } finally {
    await stopManagedBrowserProcess(managedServer);
    await Promise.allSettled([
      rm(scriptPath, { force: true }),
      rm(configPath, { force: true }),
    ]);
  }

  const { receipts } = protocol;
  const invalidReceiptGaps = protocol.invalidReceipts
    .map((candidate, index) => browserInvalidReceiptGap(candidate, index + 1));
  if ((receipts.length > 0 || invalidReceiptGaps.length > 0)
    && result?.exitCode === 0 && !result?.truncated && protocol.invalidEvidenceCount === 0) {
    return [...receipts, ...invalidReceiptGaps];
  }

  const failure = serverFailure ?? classifyBrowserRunnerFailure(result, protocol);
  const gap = browserGapResult(failure.code, failure.message, failure.nextAction, {
    stdout: redactText(result?.stdout ?? '').text,
    stderr: redactText(result?.stderr ?? '').text,
    exitCode: result?.exitCode,
  });
  const partialResults = [...receipts, ...invalidReceiptGaps];
  return partialResults.length > 0 ? [...partialResults, gap] : [gap];
}

export function isSafeBrowserTarget(value) {
  return Boolean(normalizeBrowserTarget(value));
}

export const isLocalOrTestBrowserUrl = isSafeBrowserTarget;

export function isSafeBrowserHttpRequest({ targetUrl, url, method = 'GET' } = {}) {
  const normalizedTarget = normalizeBrowserTarget(targetUrl);
  if (!normalizedTarget || !SAFE_BROWSER_HTTP_METHODS.has(String(method).toUpperCase())) return false;
  try {
    const candidate = new URL(String(url ?? ''), normalizedTarget);
    if (['http:', 'https:'].includes(candidate.protocol)) {
      return candidate.origin === new URL(normalizedTarget).origin;
    }
    if (candidate.protocol === 'blob:') return candidate.origin === new URL(normalizedTarget).origin;
    return ['about:', 'data:'].includes(candidate.protocol);
  } catch {
    return false;
  }
}

export function isSafeBrowserLink({
  targetUrl,
  currentUrl,
  linkUrl,
  explicitlySafe = false,
  download = false,
} = {}) {
  const normalizedTarget = normalizeBrowserTarget(targetUrl);
  if (!normalizedTarget || download) return false;
  try {
    const current = new URL(String(currentUrl ?? ''), normalizedTarget);
    const candidate = new URL(String(linkUrl ?? ''), current);
    if (!['http:', 'https:'].includes(candidate.protocol)
      || candidate.origin !== new URL(normalizedTarget).origin) return false;
    const sameDocument = Boolean(candidate.hash)
      && `${candidate.origin}${candidate.pathname}${candidate.search}`
        === `${current.origin}${current.pathname}${current.search}`;
    return sameDocument || explicitlySafe === true;
  } catch {
    return false;
  }
}

export function browserValidationCandidates({ required = false, type = '', pattern } = {}) {
  const normalizedType = String(type ?? '').trim().toLowerCase();
  if (normalizedType === 'email') return ['xray-invalid-email'];
  if (pattern !== undefined && pattern !== null && BROWSER_PATTERN_TYPES.has(normalizedType)) {
    let matcher = null;
    for (const flags of ['v', 'u']) {
      try {
        matcher = new RegExp(`^(?:${String(pattern)})$`, flags);
        break;
      } catch {
        // Try the legacy Unicode pattern semantics used by older browsers.
      }
    }
    if (matcher) {
      const invalidCandidate = BROWSER_INVALID_PATTERN_PROBES.find((candidate) => !matcher.test(candidate));
      if (invalidCandidate) return [invalidCandidate];
    }
  }
  if (required && !['checkbox', 'file', 'radio'].includes(normalizedType)) return [''];
  return [];
}

async function resolveLocalPlaywright(workspace) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  for (const packageName of ['playwright', '@playwright/test']) {
    if (!declared.has(packageName)) continue;
    const packageDirectory = path.join(workspace, 'node_modules', ...packageName.split('/'));
    try {
      const packageManifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
      const bin = packageManifest.bin;
      const relativeCli = typeof bin === 'string' ? bin : bin?.playwright ?? 'cli.js';
      const cliPath = path.resolve(packageDirectory, relativeCli);
      const relative = path.relative(path.resolve(packageDirectory), cliPath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
      await access(cliPath);
      return {
        packageName,
        cliPath,
        importSpecifier: packageName === 'playwright' ? 'playwright/test' : '@playwright/test',
      };
    } catch {
      // Try the other explicitly declared supported package.
    }
  }
  return null;
}

async function resolveLocalBrowserServer(workspace, target) {
  const parsedTarget = new URL(target);
  if (parsedTarget.protocol !== 'http:') return null;
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  const scripts = [manifest.scripts?.dev, manifest.scripts?.start, manifest.scripts?.serve]
    .map((script) => String(script ?? '').trim())
    .filter(Boolean);
  const hostname = parsedTarget.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const bindHost = hostname === '::1' || isIP(hostname) === 4 ? hostname : '127.0.0.1';
  const port = parsedTarget.port || '80';
  const definitions = [
    {
      packageName: 'vite', binName: 'vite', label: 'Vite',
      detected: scripts.some((script) => /\bvite\b/i.test(script) && !/\bvite\s+(?:build|preview)\b/i.test(script)),
      args: ['--host', bindHost, '--port', port, '--strictPort'],
    },
    {
      packageName: 'next', binName: 'next', label: 'Next.js',
      detected: scripts.some((script) => /\bnext\s+dev\b/i.test(script)),
      args: ['dev', '--hostname', bindHost, '--port', port],
    },
    {
      packageName: 'astro', binName: 'astro', label: 'Astro',
      detected: scripts.some((script) => /\bastro\s+dev\b/i.test(script)),
      args: ['dev', '--host', bindHost, '--port', port],
    },
    {
      packageName: 'nuxt', binName: 'nuxt', label: 'Nuxt',
      detected: scripts.some((script) => /\bnuxt\s+dev\b/i.test(script)),
      args: ['dev', '--host', bindHost, '--port', port],
    },
  ];
  for (const definition of definitions) {
    if (!definition.detected || !declared.has(definition.packageName)) continue;
    const cliPath = await resolveDeclaredPackageBinary(workspace, definition.packageName, definition.binName);
    if (!cliPath) continue;
    return {
      command: process.execPath,
      args: [cliPath, ...definition.args],
      label: definition.label,
      options: {
        cwd: workspace,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    };
  }
  return null;
}

async function resolveDeclaredPackageBinary(workspace, packageName, binName) {
  const packageDirectory = path.join(workspace, 'node_modules', ...packageName.split('/'));
  try {
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
    const bin = manifest.bin;
    const relativeCli = typeof bin === 'string' ? bin : bin?.[binName];
    if (!relativeCli) return null;
    const cliPath = path.resolve(packageDirectory, relativeCli);
    const relative = path.relative(path.resolve(packageDirectory), cliPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    await access(cliPath);
    return cliPath;
  } catch {
    return null;
  }
}

async function startManagedBrowserProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stderr = '';
    let stdout = '';
    child.stdout?.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12_000); });
    child.stderr?.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12_000); });
    child.once('error', reject);
    child.once('spawn', () => resolve({
      child,
      get exited() { return child.exitCode !== null || child.signalCode !== null; },
      get stdout() { return stdout; },
      get stderr() { return stderr; },
      stop: async () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const closed = new Promise((done) => child.once('close', done));
        child.kill();
        const timer = new Promise((done) => {
          const timeout = setTimeout(done, 3_000);
          timeout.unref?.();
        });
        await Promise.race([closed, timer]);
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      },
    }));
  });
}

async function stopManagedBrowserProcess(server) {
  if (!server) return;
  try {
    if (typeof server.stop === 'function') await server.stop();
    else if (typeof server.kill === 'function') server.kill();
  } catch {
    // Cleanup is best effort after the Browser result has already been captured.
  }
}

function withManagedServerDiagnostics(result = {}, server = {}) {
  const append = (primary, diagnostic, label) => [
    String(primary ?? '').trim(),
    String(diagnostic ?? '').trim() ? `[${label}]\n${String(diagnostic).trim()}` : '',
  ].filter(Boolean).join('\n');
  return {
    ...result,
    stdout: append(result.stdout, server.stdout, 'managed server stdout'),
    stderr: append(result.stderr, server.stderr, 'managed server stderr'),
  };
}

async function waitForBrowserTarget(target, probeUrl, server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if (await probeUrl(target)) return true;
    } catch {
      // Retry until the bounded startup window expires.
    }
    if (server?.exited) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function probeBrowserUrl(target) {
  if (!normalizeBrowserTarget(target)) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);
  timeout.unref?.();
  try {
    await fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'ForgeMind-Xray/1' },
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBrowserTarget(value) {
  try {
    const target = new URL(String(value ?? '').trim());
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isIpv4Loopback = isIP(hostname) === 4 && hostname.split('.')[0] === '127';
    const safeHostname = hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '::1'
      || isIpv4Loopback
      || hostname === 'test'
      || hostname.endsWith('.test');
    return safeHostname ? target.href : null;
  } catch {
    return null;
  }
}

function browserGapResult(code, message, nextAction, execution = {}, gapDetails = {}) {
  return {
    adapter: 'browser',
    control: 'playwright',
    surfaceId: 'web-gui',
    surfaceIds: ['web-gui'],
    componentIds: [...BROWSER_COMPONENT_IDS],
    status: 'blocked',
    evidence: [],
    ...execution,
    gap: {
      code,
      surfaceId: 'web-gui',
      control: 'playwright',
      message,
      nextAction,
      ...gapDetails,
    },
  };
}

function browserInvalidReceiptGap(candidate, index) {
  const coverageArea = redactField(candidate?.coverageArea) || `unknown-flow-${index}`;
  const controlLabel = redactField(candidate?.controlLabel) || 'Unidentified browser control';
  return browserGapResult(
    'FM_XRAY_BROWSER_RECEIPT_INVALID',
    `The Browser receipt for ${controlLabel} in ${coverageArea} was incomplete or unsafe and was not scored.`,
    'Rerun Xray and inspect the generated Browser flow for missing fields or an off-target URL.',
    {},
    {
      checkId: `browser-invalid-receipt-${index}`,
      coverageArea,
      controlLabel,
    },
  );
}

function classifyBrowserRunnerFailure(result = {}, protocol = {}) {
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`;
  if (result.truncated) {
    return {
      code: 'FM_XRAY_BROWSER_PROTOCOL_TRUNCATED',
      message: 'The Playwright protocol output was truncated before all browser flows could be recorded.',
      nextAction: 'Reduce the mapped test surface or rerun Xray after increasing the local process output limit.',
    };
  }
  if (/executable doesn'?t exist|browser executable|please run .*playwright install|browserType\.launch|failed to launch.*(?:chromium|browser)/i.test(output)) {
    return {
      code: 'FM_XRAY_PLAYWRIGHT_UNAVAILABLE',
      message: 'The local Playwright package is installed, but its Chromium runtime is unavailable.',
      nextAction: PLAYWRIGHT_SETUP_ACTION,
    };
  }
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|connection refused|net::ERR_|NS_ERROR_CONNECTION_REFUSED|timed out while (?:waiting|connecting)/i.test(output)) {
    return {
      code: 'FM_XRAY_BROWSER_TARGET_UNAVAILABLE',
      message: 'Playwright could not reach the explicit local/test browser target.',
      nextAction: 'Start the local test server, verify the supplied --test-url, and rerun Xray.',
    };
  }
  if (protocol.invalidEvidenceCount > 0) {
    return {
      code: 'FM_XRAY_BROWSER_EVIDENCE_INVALID',
      message: 'The Playwright runner emitted a receipt whose screenshot, trace, or snapshot evidence was missing or did not belong to this Xray run.',
      nextAction: 'Rerun Xray and inspect the current run artifact directory before treating the Browser flow as scored evidence.',
    };
  }
  if (result.exitCode === 0) {
    return {
      code: 'FM_XRAY_BROWSER_PROTOCOL_INVALID',
      message: 'The isolated Playwright runner completed without a valid ForgeMind browser receipt.',
      nextAction: 'Rerun Xray and inspect the redacted Playwright output for a runner or protocol error.',
    };
  }
  return {
    code: 'FM_XRAY_BROWSER_EXECUTION_UNAVAILABLE',
    message: 'The isolated Playwright runner stopped before it could record a browser flow.',
    nextAction: 'Resolve the reported local runner prerequisite, then rerun Xray against the same test URL.',
  };
}

async function parseBrowserProtocol(stdout, target, evidenceContext) {
  const receipts = [];
  let invalidEvidenceCount = 0;
  let invalidReceiptCount = 0;
  const invalidReceipts = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    let envelope;
    try {
      envelope = JSON.parse(line);
    } catch {
      continue;
    }
    if (envelope?.protocol !== BROWSER_PROTOCOL || envelope?.type !== 'receipt') continue;
    const normalized = await normalizeBrowserReceipt(envelope.receipt, target, evidenceContext);
    if (normalized.receipt) receipts.push(normalized.receipt);
    else if (normalized.invalidEvidence) invalidEvidenceCount += 1;
    else {
      invalidReceiptCount += 1;
      invalidReceipts.push(envelope.receipt);
    }
  }
  return { receipts, invalidEvidenceCount, invalidReceiptCount, invalidReceipts };
}

async function normalizeBrowserReceipt(candidate, target, evidenceContext) {
  if (!candidate || !BROWSER_STATUSES.has(candidate.status)) return {};
  const fields = ['coverageArea', 'controlLabel', 'action', 'expected', 'actual', 'reproduction'];
  const flow = Object.fromEntries(fields.map((field) => [field, redactField(candidate[field])]));
  if (fields.some((field) => !flow[field])) return {};
  const receiptUrl = normalizeBrowserTarget(candidate.url);
  if (!receiptUrl || new URL(receiptUrl).origin !== new URL(target).origin) return {};
  const candidateEvidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
  const evidence = [...new Set(candidateEvidence
    .map((value) => normalizeBrowserEvidence(value, evidenceContext.flowEvidencePrefix))
    .filter(Boolean))];
  const screenshot = normalizeBrowserEvidence(candidate.screenshot, evidenceContext.flowEvidencePrefix);
  const trace = normalizeBrowserEvidence(candidate.trace, evidenceContext.flowEvidencePrefix);
  if (!screenshot || !trace || evidence.length !== candidateEvidence.length) return { invalidEvidence: true };
  if (!evidence.includes(screenshot) || !evidence.includes(trace)) return { invalidEvidence: true };
  if (!/\.png$/i.test(screenshot) || !/\.zip$/i.test(trace)) return { invalidEvidence: true };
  if (!evidence.some((value) => /-before\.json$/i.test(value))
    || !evidence.some((value) => /-after\.json$/i.test(value))) return { invalidEvidence: true };
  const artifactsExist = await Promise.all(evidence.map((value) => browserEvidenceExists(value, evidenceContext)));
  if (artifactsExist.some((exists) => !exists)) return { invalidEvidence: true };
  const safetyAction = flow.action.replace(/\bwithout\s+(?:submit|submitting|submission)\b/gi, '');
  const dangerous = DANGEROUS_BROWSER_CONTROL_PATTERN.test(`${flow.controlLabel} ${safetyAction}`);
  const status = dangerous && ['passed', 'failed'].includes(candidate.status) ? 'skipped' : candidate.status;
  return {
    receipt: {
      adapter: 'browser',
      control: 'playwright',
      surfaceId: 'web-gui',
      surfaceIds: ['web-gui'],
      componentIds: [...BROWSER_COMPONENT_IDS],
      status,
      ...(status === 'failed' ? {
        severity: BROWSER_FAILURE_SEVERITIES.has(candidate.severity) ? candidate.severity : 'high',
      } : {}),
      url: redactField(receiptUrl),
      ...flow,
      ...(dangerous ? {
        actual: 'The unsafe browser control was intentionally not exercised.',
      } : {}),
      evidence,
      screenshot,
      trace,
    },
  };
}

function normalizeBrowserEvidence(value, evidencePrefix = BROWSER_EVIDENCE_PREFIX) {
  const normalized = String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized.startsWith(`${evidencePrefix}/`)) return null;
  if (normalized.split('/').some((segment) => segment === '..') || normalized.includes('\0')) return null;
  return redactText(normalized).text;
}

async function browserEvidenceExists(value, { workspace, flowArtifactDirectory, flowEvidencePrefix }) {
  const relativeEvidence = value.slice(flowEvidencePrefix.length + 1);
  const artifactRoot = path.resolve(flowArtifactDirectory);
  const artifactPath = path.resolve(artifactRoot, ...relativeEvidence.split('/'));
  const relative = path.relative(artifactRoot, artifactPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  try {
    const metadata = await lstat(artifactPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size === 0) return false;
    const [realWorkspace, realRoot, realArtifact] = await Promise.all([
      realpath(path.resolve(workspace)),
      realpath(artifactRoot),
      realpath(artifactPath),
    ]);
    const workspaceRelative = path.relative(realWorkspace, realRoot);
    if (!workspaceRelative || workspaceRelative.startsWith('..') || path.isAbsolute(workspaceRelative)) return false;
    const realRelative = path.relative(realRoot, realArtifact);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) return false;
    if (/\.json$/i.test(artifactPath)) JSON.parse(await readFile(artifactPath, 'utf8'));
    return true;
  } catch {
    return false;
  }
}

function redactField(value) {
  return redactText(String(value ?? '').trim()).text;
}

function workspaceRelativePath(workspace, target) {
  return path.relative(path.resolve(workspace), target).replaceAll(path.sep, '/');
}

function createBrowserRunnerConfig({ artifactDirectory, outputDirectory, scriptName }) {
  return `export default ${JSON.stringify({
    testDir: artifactDirectory,
    testMatch: `**/${scriptName}`,
    timeout: 120_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    outputDir: outputDirectory,
    projects: [{
      name: 'xray-chromium',
      use: {
        browserName: 'chromium',
        headless: true,
        acceptDownloads: false,
        serviceWorkers: 'block',
      },
    }],
  }, null, 2)};\n`;
}

function createBrowserRunnerScript({
  target,
  artifactDirectory,
  evidencePrefix,
  importSpecifier,
  adapterImportSpecifier,
}) {
  return String.raw`import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from ${JSON.stringify(importSpecifier)};
import { browserValidationCandidates, isSafeBrowserHttpRequest, isSafeBrowserLink } from ${JSON.stringify(adapterImportSpecifier)};

const PROTOCOL = ${JSON.stringify(BROWSER_PROTOCOL)};
const TEST_URL = ${JSON.stringify(target)};
const ARTIFACT_DIRECTORY = ${JSON.stringify(artifactDirectory)};
const EVIDENCE_PREFIX = ${JSON.stringify(evidencePrefix)};
const MAX_PAGES = 12;
const MAX_CONTROLS = 8;
const DANGEROUS = /\b(?:admin|approve|buy|checkout|credential|delete|deploy|destroy|drop|invite|order|password|pay|payment|production|publish|purchase|release|remove|reset|save|secret|seed|send|sign[ -]?in|submit|token|transfer|truncate|upload)\b/i;
const SAFE_BUTTON = /\b(?:back|cancel|close|continue|details|get started|help|learn|menu|more|next|open|previous|show|start|toggle|view)\b/i;
let flowNumber = 0;

function cleanText(value) {
  return String(value ?? '')
    .replace(/\b(?:API[_-]?KEY|TOKEN|PASSWORD|SECRET|CREDENTIALS?)\s*=\s*[^\s]+/gi, '[REDACTED:SECRET_ASSIGNMENT]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g, '[REDACTED:TOKEN]')
    .trim()
    .slice(0, 500);
}

function cleanValue(value) {
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cleanValue(child)]));
  }
  return value;
}

function emit(receipt) {
  process.stdout.write(JSON.stringify({ protocol: PROTOCOL, type: 'receipt', receipt: cleanValue(receipt) }) + '\n');
}

function slug(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'flow';
}

function evidencePath(fileName) {
  return EVIDENCE_PREFIX + '/' + fileName;
}

function coverageArea(url) {
  const parsed = new URL(url);
  const pathArea = parsed.pathname.replace(/^\/+|\/+$/g, '');
  return slug(pathArea || 'home');
}

function isAllowedNavigation(value) {
  try {
    const candidate = new URL(value);
    return ['http:', 'https:'].includes(candidate.protocol) && candidate.origin === new URL(TEST_URL).origin;
  } catch {
    return false;
  }
}

function isAllowedSocket(value) {
  try {
    const candidate = new URL(value);
    const base = new URL(TEST_URL);
    const expectedProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    return candidate.protocol === expectedProtocol && candidate.host === base.host;
  } catch {
    return false;
  }
}

async function domSnapshot(page, targetPath) {
  const snapshot = await page.locator('body').evaluate((body) => [...body.querySelectorAll('*')]
    .slice(0, 800)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || '',
      label: element.getAttribute('aria-label') || element.getAttribute('title') || '',
      name: element.getAttribute('name') || '',
      type: element.getAttribute('type') || '',
      href: element instanceof HTMLAnchorElement ? element.href : '',
      visible: Boolean(element.getClientRects().length),
    })));
  await writeFile(targetPath, JSON.stringify(cleanValue(snapshot), null, 2), 'utf8');
}

async function recordFlow({ page, context, url, area, controlLabel, action, expected, reproduction, operation, skipReason }) {
  flowNumber += 1;
  const baseName = String(flowNumber).padStart(3, '0') + '-' + slug(area + '-' + controlLabel + '-' + action);
  const beforeScreenshot = baseName + '-before.png';
  const afterScreenshot = baseName + '-after.png';
  const beforeSnapshot = baseName + '-before.json';
  const afterSnapshot = baseName + '-after.json';
  const traceName = baseName + '-trace.zip';
  const evidence = [beforeScreenshot, beforeSnapshot, afterScreenshot, afterSnapshot, traceName].map(evidencePath);
  let status = skipReason ? 'skipped' : 'passed';
  let actual = skipReason || '';
  let tracing = false;
  let prerequisiteError = null;
  try {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    tracing = true;
    await page.screenshot({ path: path.join(ARTIFACT_DIRECTORY, beforeScreenshot), fullPage: true });
    await domSnapshot(page, path.join(ARTIFACT_DIRECTORY, beforeSnapshot));
    if (!skipReason) {
      const outcome = await operation();
      if (outcome && typeof outcome === 'object') {
        if (outcome.status === 'skipped' || outcome.status === 'passed') status = outcome.status;
        actual = cleanText(outcome.actual);
      } else {
        actual = cleanText(outcome);
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIRECTORY, afterScreenshot), fullPage: true });
    await domSnapshot(page, path.join(ARTIFACT_DIRECTORY, afterSnapshot));
  } catch (error) {
    status = 'failed';
    actual = cleanText(error?.message || error);
    if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|NS_ERROR_CONNECTION_REFUSED|page\.goto: Timeout/i.test(actual)) {
      prerequisiteError = error;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIRECTORY, afterScreenshot), fullPage: true }).catch(() => {});
    await domSnapshot(page, path.join(ARTIFACT_DIRECTORY, afterSnapshot)).catch(() => {});
  } finally {
    if (tracing) {
      try {
        await context.tracing.stop({ path: path.join(ARTIFACT_DIRECTORY, traceName) });
      } catch (error) {
        status = 'failed';
        actual = cleanText(error?.message || error);
      }
    }
  }
  if (prerequisiteError) throw prerequisiteError;
  emit({
    status,
    ...(status === 'failed' ? { severity: 'high' } : {}),
    url: cleanText(page.url() === 'about:blank' ? url : page.url()),
    coverageArea: cleanText(area),
    controlLabel: cleanText(controlLabel),
    action: cleanText(action),
    expected: cleanText(expected),
    actual: actual || 'The expected visible state was observed.',
    reproduction: cleanText(reproduction),
    evidence,
    screenshot: evidencePath(afterScreenshot),
    trace: evidencePath(traceName),
  });
  return status;
}

test('ForgeMind Xray maps safe local browser flows', async ({ page, context }) => {
  await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (!isSafeBrowserHttpRequest({ targetUrl: TEST_URL, url: request.url(), method: request.method() })
      || (route.request().isNavigationRequest() && !isAllowedNavigation(route.request().url()))) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  if (typeof context.routeWebSocket === 'function') {
    await context.routeWebSocket('**/*', async (socket) => {
      if (isAllowedSocket(socket.url())) socket.connectToServer();
      else await socket.close({ code: 1008, reason: 'ForgeMind Xray blocks non-test WebSocket targets.' });
    });
  }

  const queue = [TEST_URL];
  const visited = new Set();
  while (queue.length && visited.size < MAX_PAGES) {
    const requestedUrl = queue.shift();
    if (!isAllowedNavigation(requestedUrl) || visited.has(requestedUrl)) continue;
    visited.add(requestedUrl);
    const area = coverageArea(requestedUrl);
    const pageStatus = await recordFlow({
      page,
      context,
      url: requestedUrl,
      area,
      controlLabel: area === 'home' ? 'Home page' : area,
      action: 'open page',
      expected: 'The explicit local/test page loads and exposes a visible state.',
      reproduction: 'Open ' + requestedUrl + ' in the local Playwright test browser.',
      operation: async () => {
        const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {});
        if (!isAllowedNavigation(page.url())) throw new Error('Navigation left the explicit local/test origin.');
        if (response && !response.ok()) throw new Error('The page returned HTTP ' + response.status() + '.');
        if (await page.locator('body').count() === 0) throw new Error('The page did not expose a document body.');
        return 'The page loaded at ' + page.url() + '.';
      },
    });
    if (pageStatus === 'failed' || !isAllowedNavigation(page.url())) continue;
    const currentUrl = page.url();

    const links = await page.locator('a[href]').evaluateAll((elements) => elements.slice(0, 100).map((element) => ({
      href: element.href,
      label: element.getAttribute('aria-label') || element.textContent || element.href,
      explicitlySafe: element.getAttribute('data-xray-safe') === 'true',
      download: element.hasAttribute('download'),
      visible: Boolean(element.getClientRects().length),
    })));
    let recordedUnsafeLinks = 0;
    for (const link of links.filter(({ visible }) => visible)) {
      const label = cleanText(link.label);
      if (!isAllowedNavigation(link.href)) continue;
      if (!isSafeBrowserLink({
        targetUrl: TEST_URL,
        currentUrl,
        linkUrl: link.href,
        explicitlySafe: link.explicitlySafe,
        download: link.download,
      })) {
        if (recordedUnsafeLinks < MAX_CONTROLS) {
          recordedUnsafeLinks += 1;
          await recordFlow({
            page, context, url: currentUrl, area, controlLabel: label || 'Unclassified link', action: 'inspect local link without navigation',
            expected: 'The link remains unvisited unless it is a same-document anchor or explicitly marked safe for Xray.',
            reproduction: 'Open ' + currentUrl + ' and inspect ' + (label || link.href) + ' without activating it.',
            skipReason: 'The link was not structurally opted in for safe Browser navigation and was intentionally not exercised.',
          });
        }
        continue;
      }
      if (!visited.has(link.href) && !queue.includes(link.href)) {
        queue.push(link.href);
      }
    }

    const dialogs = await page.locator('dialog,[role="dialog"]').evaluateAll((elements) => elements.slice(0, MAX_CONTROLS).map((element) => ({
      label: element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || 'Dialog',
      visible: Boolean(element.getClientRects().length),
    })));
    for (const dialog of dialogs.filter(({ visible }) => visible)) {
      await recordFlow({
        page, context, url: currentUrl, area, controlLabel: cleanText(dialog.label), action: 'inspect visible dialog',
        expected: 'The visible dialog can be inspected without a state-changing action.',
        reproduction: 'Open ' + currentUrl + ' and inspect the visible dialog.',
        operation: async () => 'The visible dialog was present and inspectable.',
      });
    }

    const buttons = await page.locator('button,[role="button"],input[type="button"]').evaluateAll((elements) => elements.slice(0, MAX_CONTROLS).map((element, index) => ({
      index,
      label: element.getAttribute('aria-label') || element.value || element.textContent || 'Button',
      disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
      submitsForm: element instanceof HTMLButtonElement && element.type === 'submit',
      visible: Boolean(element.getClientRects().length),
    })));
    for (const button of buttons.filter(({ visible, disabled }) => visible && !disabled)) {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const label = cleanText(button.label);
      const unsafeReason = button.submitsForm
        ? 'The button can submit a form and was intentionally not exercised.'
        : DANGEROUS.test(label) || !SAFE_BUTTON.test(label)
        ? 'The control was not in the non-destructive browser allowlist and was intentionally not exercised.'
        : '';
      await recordFlow({
        page, context, url: currentUrl, area, controlLabel: label, action: 'click safe button',
        expected: unsafeReason
          ? 'The unclassified or dangerous button remains unclicked.'
          : 'The safe local control responds with a visible state or same-origin navigation.',
        reproduction: 'Open ' + currentUrl + ' and locate the ' + label + ' control.',
        skipReason: unsafeReason,
        operation: async () => {
          const beforeUrl = page.url();
          const beforeState = await page.locator('body').evaluate((element) => element.outerHTML);
          await page.locator('button,[role="button"],input[type="button"]').nth(button.index).click({ timeout: 5_000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 2_000 }).catch(() => {});
          if (!isAllowedNavigation(page.url())) throw new Error('The control attempted navigation outside the test origin.');
          const afterState = await page.locator('body').evaluate((element) => element.outerHTML);
          if (page.url() === beforeUrl && afterState === beforeState) {
            throw new Error('The control produced no visible page or navigation change.');
          }
          return 'The safe control responded at ' + page.url() + '.';
        },
      });
      if (isAllowedNavigation(page.url()) && !visited.has(page.url()) && !queue.includes(page.url())) queue.push(page.url());
    }

    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const forms = await page.locator('form').evaluateAll((elements) => elements.slice(0, MAX_CONTROLS).map((form, index) => {
      const controls = [...form.querySelectorAll('input,textarea,select')];
      return {
        index,
        label: form.getAttribute('aria-label') || form.getAttribute('name') || 'Form ' + (index + 1),
        dangerous: controls.some((control) => /admin|credential|delete|destroy|password|payment|publish|secret|token|transfer|truncate|upload|card/i.test([
          control.getAttribute('name'), control.getAttribute('type'), control.getAttribute('autocomplete'),
        ].join(' '))),
        validationCapable: controls.some((control) => control.required || control.hasAttribute('pattern') || control.getAttribute('type') === 'email'),
        visible: Boolean(form.getClientRects().length),
      };
    }));
    for (const form of forms.filter(({ visible }) => visible)) {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const label = cleanText(form.label);
      const skipReason = form.dangerous || DANGEROUS.test(label)
        ? 'The credential, payment, or privileged form was intentionally not exercised.'
        : !form.validationCapable
          ? 'The form has no safe browser-native validation flow and was not submitted.'
          : '';
      await recordFlow({
        page, context, url: currentUrl, area, controlLabel: label, action: 'exercise validation without submit',
        expected: skipReason
          ? 'The form remains unsubmitted.'
          : 'Invalid isolated test input is rejected without submitting the form.',
        reproduction: 'Open ' + currentUrl + ', locate ' + label + ', and trigger validation without submitting.',
        skipReason,
        operation: async () => {
          const formLocator = page.locator('form').nth(form.index);
          const fields = formLocator.locator('input:not([type="hidden"]):not([type="submit"]),textarea');
          for (let index = 0; index < Math.min(await fields.count(), MAX_CONTROLS); index += 1) {
            const field = fields.nth(index);
            const details = await field.evaluate((element) => ({
              required: element.required,
              type: element.getAttribute('type') || '',
              pattern: element.hasAttribute('pattern') ? element.getAttribute('pattern') : null,
            }));
            for (const candidate of browserValidationCandidates(details)) {
              await field.fill(candidate);
              if (!await field.evaluate((element) => element.checkValidity())) break;
            }
          }
          const valid = await formLocator.evaluate((element) => {
            const result = element.checkValidity();
            element.reportValidity();
            return result;
          });
          if (valid) {
            return {
              status: 'skipped',
              actual: 'Xray could not induce a browser-native invalid state with isolated non-submitting test data.',
            };
          }
          return 'Browser validation rejected the isolated invalid input without submission.';
        },
      });
    }
  }
});
`;
}

export async function executeCommandAdapter({ candidate, workspace, runProcess }) {
  if (!isSafeXrayCommandCandidate(candidate)) {
    return {
      adapter: 'command',
      status: 'skipped',
      surfaceIds: commandSurfaceIds(candidate),
      evidence: commandEvidence(candidate),
      stdout: '',
      stderr: '',
      command: formatCommandCandidate(candidate),
      gap: unsafeCommandGap(candidate),
    };
  }

  let result;
  try {
    result = await runProcess(candidate.command, candidate.args ?? [], { cwd: workspace });
  } catch (error) {
    result = { exitCode: 127, stdout: '', stderr: error?.message ?? String(error) };
  }
  const prerequisite = classifyPrerequisiteFailure(result);
  return {
    adapter: 'command',
    status: result.exitCode === 0 ? 'passed' : prerequisite ? 'blocked' : 'failed',
    surfaceIds: commandSurfaceIds(candidate),
    evidence: commandEvidence(candidate),
    stdout: redactText(result.stdout ?? '').text,
    stderr: redactText(result.stderr ?? '').text,
    command: formatCommandCandidate(candidate),
    exitCode: result.exitCode,
    ...(prerequisite ? { gap: prerequisiteGap(candidate, prerequisite) } : {}),
  };
}

export function formatCommandCandidate(candidate = {}) {
  return [candidate.command, ...(candidate.args ?? [])]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function isSafeXrayCommandCandidate(candidate = {}) {
  return !candidate.unsafe
    && !(candidate.safetyReasons?.length)
    && !UNSAFE_COMMAND_PATTERN.test(formatCommandCandidate(candidate))
    && (!WINDOWS_BATCH_COMMAND_PATTERN.test(String(candidate.command ?? ''))
      || ![candidate.command, ...(candidate.args ?? [])].some((value) => WINDOWS_COMMAND_CHAIN_PATTERN.test(String(value))));
}

export function classifyPrerequisiteFailure(result) {
  const output = `${result?.stderr ?? ''}\n${result?.stdout ?? ''}`;
  if (result?.exitCode === 127 || /\b(?:ENOENT|command not found|not recognized as an internal or external command|cannot find (?:the )?(?:file|command|executable))\b/i.test(output)) {
    return 'tool';
  }
  const localServiceUnavailable = /(?:\b(?:localhost|127\.0\.0\.1|\[?::1\]?|local (?:service|server|database))\b[^\n]*(?:unavailable|not running|failed to connect|ECONNREFUSED|connection refused)|(?:unavailable|not running|failed to connect|ECONNREFUSED|connection refused)[^\n]*\b(?:localhost|127\.0\.0\.1|\[?::1\]?|local (?:service|server|database))\b)/i.test(output);
  if (/\b(?:no (?:running )?(?:emulator|simulator|device)|(?:credential|api[_-]?key|token).*(?:missing|not configured|unavailable|required))\b/i.test(output)
    || localServiceUnavailable) {
    return 'prerequisite';
  }
  return null;
}

export function prerequisiteGap(candidate, kind) {
  return {
    code: kind === 'tool' ? 'FM_XRAY_TOOL_UNAVAILABLE' : 'FM_XRAY_PREREQUISITE_UNAVAILABLE',
    ...(candidate?.id ? { checkId: candidate.id } : {}),
    message: kind === 'tool'
      ? 'The detected check could not start because its executable is unavailable.'
      : 'The detected check could not assess application behavior because a local prerequisite is unavailable.',
  };
}

function commandSurfaceIds(candidate = {}) {
  return [...(candidate.surfaceIds ?? candidate.surfaceHints ?? [])];
}

function commandEvidence(candidate = {}) {
  return candidate.id ? [candidate.id] : [];
}

function unsafeCommandGap(candidate) {
  return {
    code: 'FM_XRAY_UNSAFE_CHECK_SKIPPED',
    ...(candidate?.id ? { checkId: candidate.id } : {}),
    message: 'This check was not executed because its command may be destructive or irreversible.',
  };
}
