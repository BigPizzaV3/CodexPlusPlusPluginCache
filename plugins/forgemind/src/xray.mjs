import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { invalidInput } from './errors.mjs';
import { inspectProject } from './project.mjs';
import { deriveProjectProfile } from './project-profile.mjs';
import { loadXrayConfig } from './xray-config.mjs';
import { planCriticalFlows } from './xray-flows.mjs';
import { executeApiChecks } from './xray-api.mjs';
import { compareVisualEvidence, performanceFinding } from './xray-evidence.mjs';
import { runProcess as runLocalProcess } from './process.mjs';
import {
  classifyPrerequisiteFailure,
  executeAndroidAdapter,
  executeBrowserAdapter,
  executeCommandAdapter,
  formatCommandCandidate,
  isSafeBrowserTarget,
  isSafeXrayCommandCandidate,
  prerequisiteGap,
} from './xray-adapters.mjs';
import { redactText } from './redact.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { publishProjectDocument } from './project-documents.mjs';

const API_DEPENDENCIES = new Set([
  'express', '@hapi/hapi', 'fastify', 'koa', '@nestjs/core', 'hono', 'restify',
]);
const WEB_GUI_DEPENDENCIES = new Set([
  'vite', 'next', 'react', 'react-dom', 'vue', '@angular/core', 'svelte', '@sveltejs/kit',
]);
const MOBILE_GUI_DEPENDENCIES = new Set([
  'react-native', 'expo', '@capacitor/core', '@ionic/react', '@ionic/vue', '@ionic/angular',
]);
const GUI_SURFACE_IDS = new Set(['web-gui', 'native-gui', 'mobile-gui']);
const GUI_COMPONENT_IDS = new Set(['gui-usability', 'accessibility-visual']);
const UNSAFE_COMMAND_PATTERN = /\b(?:migrate|deploy|publish|seed|reset|delete|destroy|drop|truncate|production)\b/i;
const DESTRUCTIVE_OPERATION_PATTERN = /(?:\brm\s+(?:-[a-z]*[rf][a-z]*\s+)+|\brimraf\b|\bRemove-Item\b|\b(?:del|erase|rmdir|rd|shred)\s+|\b(?:fs\.)?(?:rm|rmSync|unlink|unlinkSync|rmdir|rmdirSync)\s*\(|\b(?:File|Directory)\.Delete\s*\(|\b(?:shutil\.rmtree|os\.remove|Deno\.remove)\s*\()/i;
const CREDENTIAL_PATTERN = /\b(?:credentials?|secrets?|passwords?|api[_-]?keys?|auth[_-]?tokens?)\b/i;
const EXTERNAL_SPEND_PATTERN = /\b(?:terraform\s+apply|pulumi\s+up|stripe\s+(?:charge|payment)|aws\s+.*\bcreate)\b/i;
const ENVIRONMENT_TARGET_PATTERN = /(?:\$(?:env:)?\{?[A-Z_][A-Z0-9_]*(?:URL|URI|HOST|ENDPOINT|TARGET)[A-Z0-9_]*\}?|%[A-Z_][A-Z0-9_]*(?:URL|URI|HOST|ENDPOINT|TARGET)[A-Z0-9_]*%|process\.env\.[A-Z_][A-Z0-9_]*(?:URL|URI|HOST|ENDPOINT|TARGET)[A-Z0-9_]*)/i;
const SCORE_COMPONENTS = [
  { id: 'functional-correctness', label: 'Functional correctness and regressions', configuredWeight: 30 },
  { id: 'api-contracts', label: 'API, CLI, and integration contracts', configuredWeight: 20 },
  { id: 'gui-usability', label: 'GUI behavior and usability', configuredWeight: 15 },
  { id: 'accessibility-visual', label: 'Accessibility and visual quality', configuredWeight: 15 },
  { id: 'robustness-error-paths', label: 'Robustness and error paths', configuredWeight: 10 },
  { id: 'evidence-coverage', label: 'Evidence coverage of detected surfaces', configuredWeight: 10 },
];
const SEVERITY_DEDUCTIONS = new Map([
  ['critical', 40],
  ['high', 25],
  ['medium', 10],
  ['low', 3],
]);
const DEFAULT_FAILURE_SEVERITY = 'high';
const SUPPORTED_XRAY_ADAPTERS = ['command', 'browser', 'android'];

export function parseXrayAdapters(value) {
  if (value === undefined || value === null) return [...SUPPORTED_XRAY_ADAPTERS];
  const candidates = Array.isArray(value) ? value : String(value).split(',');
  const adapters = candidates.map((candidate) => String(candidate).trim().toLowerCase());
  if (adapters.length === 0 || adapters.some((adapter) => !adapter || !SUPPORTED_XRAY_ADAPTERS.includes(adapter))) {
    throw invalidInput(
      'FM_XRAY_ADAPTERS_INVALID',
      `Xray adapters must be a comma-separated subset of: ${SUPPORTED_XRAY_ADAPTERS.join(', ')}.`,
    );
  }
  return [...new Set(adapters)];
}

export async function discoverXrayMission({
  workspace,
  goal,
  guiControl = { browser: false, computerUse: false },
  guiReceipts = [],
  adapters,
  testUrl,
}) {
  const selectedAdapters = parseXrayAdapters(adapters);
  const profile = await inspectProject(workspace);
  const projectProfile = await deriveProjectProfile({ workspace: profile.root });
  const projectContext = xrayProjectContext(projectProfile);
  const { value: xrayConfig, gaps: configGaps } = await loadXrayConfig({ workspace: profile.root });
  const manifest = await readPackageManifest(profile.root);
  const files = await projectFileNames(profile.root);
  const guiSignals = await detectGuiProjectSignals(profile.root, files, manifest, profile);
  const surfaces = detectSurfaces({ ...profile, files, manifest, ...guiSignals });
  const platformGaps = surfaces.filter((surface) => surface.id === 'native-gui' || (surface.id === 'mobile-gui' && surface.platform === 'ios')).map((surface) => ({
    code: surface.id === 'native-gui' ? 'FM_XRAY_NATIVE_EMULATOR_UNSUPPORTED' : 'FM_XRAY_IOS_EMULATOR_UNAVAILABLE', surfaceId: surface.id,
    message: surface.id === 'native-gui' ? 'The detected native desktop GUI has no supported emulator adapter.' : 'The detected iOS GUI requires a macOS/Xcode simulator; the Android adapter cannot execute it.',
    nextAction: surface.id === 'native-gui' ? 'Record a Computer Use receipt from the supported native environment.' : 'Run the documented internal-browser web flow where available, plus an iOS Simulator receipt on macOS.',
  }));
  const normalizedTestUrl = canonicalBrowserUrl(testUrl);
  if (isSafeBrowserTarget(normalizedTestUrl) && !surfaces.some(({ id }) => id === 'web-gui')) {
    surfaces.push({ id: 'web-gui', label: 'Web GUI', control: 'browser' });
  }
  const commandChecks = selectedAdapters.includes('command')
    ? selectXrayChecks({ ...profile, manifest, surfaces })
    : [];
  const { checks: guiChecks, gaps: guiReceiptGaps } = createGuiChecks(surfaces, guiControl, guiReceipts);
  const { flows: criticalFlows, gaps: flowGaps } = planCriticalFlows({ files, config: xrayConfig, testUrl: normalizedTestUrl });
  const gaps = [...configGaps, ...platformGaps, ...flowGaps, ...guiGap(surfaces, guiControl, guiChecks), ...guiReceiptGaps];

  return {
    id: `xray-${Date.now().toString(36)}`,
    goal: String(goal ?? '').trim() || defaultXrayGoal(projectContext),
    projectContext,
    criticalFlows,
    xrayConfig,
    adapters: selectedAdapters,
    testUrl: normalizedTestUrl,
    surfaces,
    checks: [...commandChecks, ...guiChecks],
    gaps,
  };
}

function xrayProjectContext(profile) {
  return {
    productCategory: profile.productCategory.value,
    targetAudience: profile.targetAudience.value,
    primaryJob: profile.primaryJob.value,
    deploymentModel: profile.deploymentModel.value,
    evidence: strongestProjectEvidence(profile),
  };
}

function strongestProjectEvidence(profile) {
  const levels = ['observed', 'inferred', 'assumption', 'missing'];
  const evidence = [profile.productCategory, profile.targetAudience, profile.primaryJob, profile.deploymentModel]
    .map((field) => field?.evidence)
    .filter((value) => levels.includes(value));
  return evidence.sort((left, right) => levels.indexOf(left) - levels.indexOf(right))[0] ?? 'missing';
}

function defaultXrayGoal(context) {
  return `Assess the ${context.productCategory} application for ${context.targetAudience} whose primary job is to ${context.primaryJob}.`;
}

export function detectSurfaces(profile) {
  const manifest = profile.manifest ?? {};
  const dependencies = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const scripts = manifest.scripts ?? {};
  const surfaces = [];

  if (manifest.bin || scripts.cli || scripts.command) surfaces.push({ id: 'cli', label: 'Command-line interface' });
  if (hasKnownDependency(dependencies, API_DEPENDENCIES) || hasRouteFile(profile)) surfaces.push({ id: 'api', label: 'API' });
  const hasMobileDependency = hasKnownDependency(dependencies, MOBILE_GUI_DEPENDENCIES);
  const hasWebDependency = [...WEB_GUI_DEPENDENCIES]
    .some((dependency) => dependencies.has(dependency)
      && !(hasMobileDependency && (dependency === 'react' || dependency === 'react-dom')));
  const hasWebStart = [scripts.dev, scripts.start].some((command) => isRecognizedWebStart(command));
  if (hasWebDependency || hasWebStart) {
    surfaces.push({ id: 'web-gui', label: 'Web GUI', control: 'browser' });
  }
  if (profile.nativeGui) surfaces.push({ id: 'native-gui', label: 'Native desktop GUI', control: 'computer-use', platform: 'desktop' });
  if (profile.mobileGui) surfaces.push({ id: 'mobile-gui', label: 'Mobile emulator GUI', control: 'computer-use', platform: profile.iosGui ? 'ios' : 'android' });

  return surfaces;
}

export function surfaceIdsForCommand(check, surfaces) {
  const hints = new Set(check.surfaceHints ?? []);
  return surfaces
    .map(({ id }) => id)
    .filter((id) => !GUI_SURFACE_IDS.has(id) && (id !== 'api' || hints.has('api')));
}

export function selectXrayChecks(profile = {}) {
  const manifest = profile.manifest ?? {};
  const surfaces = profile.surfaces ?? [];
  return (profile.commands ?? [])
    .filter((check) => check.adapter === 'command'
      && (check.confidence === 'detected' || (check.confidence === 'inferred' && check.category === 'test')))
    .toSorted((left, right) => formatCommandCandidate(left).localeCompare(formatCommandCandidate(right)))
    .flatMap((check) => {
      const scriptBody = manifest.scripts?.[check.category];
      const safetyReasons = check.confidence === 'detected'
        ? classifyPackageScript(manifest.scripts ?? {}, check.category)
        : [];
      const candidate = { ...check, safetyReasons, unsafe: safetyReasons.length > 0 };
      if (check.confidence === 'inferred' && !isSafeXrayCommandCandidate(candidate)) return [];
      return [candidate];
    })
    .map((check, index) => ({
      id: `command-${index + 1}`,
      kind: 'command',
      surfaceIds: surfaceIdsForCommand(check, surfaces),
      ...check,
      scriptName: check.category,
      scriptBody: manifest.scripts?.[check.category],
      componentIds: commandComponentIds(check, manifest.scripts?.[check.category]),
    }));
}

export function guiGap(surfaces, guiControl = {}, guiChecks = []) {
  return surfaces.filter(({ id, control }) => {
    if (!GUI_SURFACE_IDS.has(id)) return false;
    const hasReceipt = guiChecks.some((check) => check.surfaceIds.includes(id) && check.importedReceipt);
    const available = control === 'browser' ? guiControl.browser : guiControl.computerUse;
    return !hasReceipt && !available;
  }).map(({ id, control }) => ({
    code: 'FM_XRAY_GUI_CONTROL_UNAVAILABLE',
    surfaceId: id,
    control,
    message: `${control === 'browser' ? 'Browser' : 'Computer Use'} control is unavailable for the detected ${id} surface.`,
  }));
}

export async function executeXrayMission({ workspace, mission, runCommand = executeDetectedCommand }) {
  const receipts = [];
  const findings = [];
  const gaps = [...(mission.gaps ?? [])];

  for (const check of mission.checks ?? []) {
    if (check.kind === 'gui-control') {
      if (check.importedReceipt) {
        receipts.push({ id: check.id, ...check.importedReceipt });
        if (check.importedReceipt.status === 'failed') findings.push(guiFinding(check));
      } else {
        receipts.push({ id: check.id, status: 'blocked' });
        gaps.push({
          code: 'FM_XRAY_GUI_EVIDENCE_NOT_RECORDED',
          checkId: check.id,
          surfaceId: check.surfaceIds[0],
          message: 'GUI control was available, but no surface-specific execution receipt was recorded.',
        });
      }
      continue;
    }

    if (!isSafeXrayCommandCandidate(check)) {
      receipts.push({ id: check.id, status: 'skipped' });
      gaps.push({
        code: 'FM_XRAY_UNSAFE_CHECK_SKIPPED',
        checkId: check.id,
        message: 'This check was not executed because its command may be destructive or irreversible.',
      });
      continue;
    }

    const execution = await runCommand(check, workspace);
    if (execution?.adapter === 'command') {
      const { gap, ...receipt } = execution;
      receipts.push({ id: check.id, ...receipt });
      if (gap) gaps.push({ ...gap, checkId: check.id });
      else if (execution.status === 'failed') findings.push(commandFinding(check, execution));
      continue;
    }

    const prerequisite = classifyPrerequisiteFailure(execution);
    receipts.push({
      id: check.id,
      ...redactReceipt(execution),
      status: execution.exitCode === 0 ? 'passed' : prerequisite ? 'blocked' : 'failed',
    });
    if (prerequisite) gaps.push(prerequisiteGap(check, prerequisite));
    else if (execution.exitCode !== 0) findings.push(commandFinding(check, execution));
  }

  return { receipts, findings: deduplicateFindings(findings), gaps };
}

export async function executeDetectedCommand(check, workspace) {
  return executeCommandAdapter({ candidate: check, workspace, runProcess: runLocalProcess });
}

export function redactReceipt(result) {
  const stdout = redactText(result.stdout).text;
  const stderr = redactText(result.stderr).text;
  return { ...result, stdout, stderr };
}

export function commandFinding(check, result) {
  const command = formatCommandCandidate(check) || 'detected command';
  return {
    id: `finding-${check.id}`,
    severity: 'high',
    surfaces: [...(check.surfaceIds ?? [])],
    componentIds: [...(check.componentIds ?? ['functional-correctness'])],
    title: `Detected command failed: ${command}`,
    reproduction: `Run ${command} from the workspace root.`,
    expected: `Command succeeds: ${command}`,
    actual: `Command exited with ${result.exitCode}`,
    evidence: [check.id],
    suspectedCause: 'The detected local verification command exited unsuccessfully.',
    userImpact: 'The affected surface may not behave as expected for users.',
    nextVerification: `Fix the failure, then rerun ${command}.`,
  };
}

function guiFinding(check) {
  const surfaceId = check.surfaceIds?.[0] ?? 'gui';
  const receipt = check.importedReceipt ?? {};
  return {
    id: `finding-${check.id}`,
    severity: normalizeFailureSeverity(receipt.severity),
    surfaces: [...(check.surfaceIds ?? [])],
    componentIds: [...(check.componentIds ?? [])],
    title: `GUI control check failed: ${surfaceId}`,
    reproduction: receipt.reproduction || `Repeat the recorded ${check.control ?? 'GUI'} interaction for ${surfaceId}.`,
    expected: receipt.expected || 'The recorded GUI interaction satisfies its expected visible behavior.',
    actual: receipt.actual || 'The surface-specific GUI execution receipt recorded a failure.',
    evidence: [check.id],
    suspectedCause: 'The visible application behavior did not match the tested expectation.',
    userImpact: 'Users may encounter the failed behavior on the affected GUI surface.',
    nextVerification: 'Fix the affected behavior, then repeat the same GUI interaction and capture a new receipt.',
  };
}

export function deduplicateFindings(findings) {
  const unique = new Map();
  for (const finding of findings) {
    const key = JSON.stringify([finding.surfaces, finding.title, finding.expected, finding.actual]);
    const existing = unique.get(key);
    if (existing) existing.evidence.push(...finding.evidence);
    else unique.set(key, { ...finding, evidence: [...finding.evidence] });
  }
  return [...unique.values()];
}

export function scoreXrayQuality({ mission, findings = [], receipts = [], gaps = [] }) {
  const surfaces = mission?.surfaces ?? [];
  const surfaceIds = new Set(surfaces.map(({ id }) => id));
  const hasGui = surfaceIds.has('web-gui') || surfaceIds.has('native-gui') || surfaceIds.has('mobile-gui');
  const hasApiOrCli = surfaceIds.has('api') || surfaceIds.has('cli');
  const executedReceiptIds = new Set(receipts.filter(isExecutionReceipt).map(({ id }) => id));
  const hasReceipts = executedReceiptIds.size > 0;
  const functionalEvidence = receiptIdsForComponent(mission, executedReceiptIds, 'functional-correctness');
  const robustnessEvidence = receiptIdsForComponent(mission, executedReceiptIds, 'robustness-error-paths');
  const apiOrCliEvidence = receiptIdsForSurfaces(mission, executedReceiptIds, ['api', 'cli']);
  const guiEvidence = receiptIdsForGuiComponent(mission, executedReceiptIds, 'gui-usability');
  const accessibilityEvidence = receiptIdsForGuiComponent(mission, executedReceiptIds, 'accessibility-visual');
  const coverage = evidenceCoverage(mission, surfaces, executedReceiptIds);
  const applicability = {
    'functional-correctness': functionalEvidence.length ? 'applicable' : 'insufficient-evidence',
    'api-contracts': componentStatus(hasApiOrCli, apiOrCliEvidence.length),
    'gui-usability': componentStatus(hasGui, guiEvidence.length),
    'accessibility-visual': componentStatus(hasGui, accessibilityEvidence.length),
    'robustness-error-paths': robustnessEvidence.length ? 'applicable' : 'insufficient-evidence',
    'evidence-coverage': hasReceipts ? 'applicable' : 'insufficient-evidence',
  };
  const applicableWeight = SCORE_COMPONENTS
    .filter(({ id }) => applicability[id] === 'applicable')
    .reduce((total, { configuredWeight }) => total + configuredWeight, 0);
  const effectiveWeights = redistributedWeights(applicability, applicableWeight);
  const components = SCORE_COMPONENTS.map((definition) => {
    const status = applicability[definition.id];
    const effectiveWeight = effectiveWeights.get(definition.id) ?? 0;
    const relevantFindings = findings.filter((finding) => findingAppliesToComponent(finding, definition.id));
    const deductions = relevantFindings.map((finding) => {
      const severity = normalizeFailureSeverity(finding.severity);
      return {
        findingId: finding.id ?? null,
        severity,
        value: SEVERITY_DEDUCTIONS.get(severity),
      };
    });
    const deductionTotal = deductions.reduce((total, deduction) => total + deduction.value, 0);
    return {
      ...definition,
      effectiveWeight,
      status,
      evidence: componentEvidence(definition.id, receipts, gaps, surfaceIds, functionalEvidence, robustnessEvidence, apiOrCliEvidence, guiEvidence, accessibilityEvidence),
      deductions,
      score: status === 'applicable'
        ? definition.id === 'evidence-coverage' ? coverage.score : Math.max(0, 100 - deductionTotal)
        : null,
    };
  });
  const noSurface = surfaces.length === 0;
  const scoreGaps = noSurface
    ? [{ code: 'FM_XRAY_NO_TEST_SURFACE' }]
    : missingSurfaceEvidenceGaps(mission, surfaces, executedReceiptIds);
  const value = applicableWeight === 0
    ? 0
    : Math.round(components.reduce((total, component) => total + ((component.score ?? 0) * component.effectiveWeight), 0) / 100);
  return {
    value,
    status: applicableWeight === 0 ? 'insufficient-evidence' : 'scored',
    components,
    rationale: applicableWeight === 0
      ? 'No executable test evidence is available for a detected surface.'
      : 'Applicable component weights are redistributed to 100; verified finding severities deduct deterministically per component.',
    gaps: scoreGaps,
  };
}

export async function runXray({
  workspace,
  goal,
  runCommand,
  runProcess = runLocalProcess,
  now = new Date(),
  guiControl,
  guiReceipts = [],
  adapters,
  testUrl,
  startProcess,
  probeUrl,
  visualMode = 'compare',
}) {
  const selectedAdapters = parseXrayAdapters(adapters);
  const normalizedTestUrl = canonicalBrowserUrl(testUrl);
  const browserResults = normalizedTestUrl && selectedAdapters.includes('browser')
    ? await executeBrowserAdapter({
      url: normalizedTestUrl,
      workspace,
      runProcess,
      ...(startProcess ? { startProcess } : {}),
      ...(probeUrl ? { probeUrl } : {}),
    })
    : [];
  const browserReceipts = browserResults.filter((result) => !result.gap);
  const browserGaps = browserResults.filter((result) => result.gap).map((result) => ({
    ...result.gap,
    adapter: result.adapter,
    evidence: [...(result.evidence ?? [])],
    ...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }),
    ...(result.stdout ? { stdout: result.stdout } : {}),
    ...(result.stderr ? { stderr: result.stderr } : {}),
  }));
  let discoveredMission = await discoverXrayMission({
    workspace,
    goal,
    guiControl,
    guiReceipts: [...guiReceipts, ...browserReceipts],
    adapters: selectedAdapters,
    testUrl: normalizedTestUrl,
  });
  const androidResult = selectedAdapters.includes('android')
    && discoveredMission.surfaces.some(({ id }) => id === 'mobile-gui')
    ? await executeAndroidAdapter({
      workspace,
      profile: { surfaces: discoveredMission.surfaces },
      runProcess,
    })
    : null;
  const androidReceipts = androidResult && !androidResult.gap ? [androidResult] : [];
  const androidGaps = androidResult?.gap ? [{
    ...androidResult.gap,
    adapter: androidResult.adapter,
    evidence: [...(androidResult.evidence ?? [])],
  }] : [];
  if (androidReceipts.length > 0) {
    discoveredMission = await discoverXrayMission({
      workspace,
      goal,
      guiControl,
      guiReceipts: [...guiReceipts, ...browserReceipts, ...androidReceipts],
      adapters: selectedAdapters,
      testUrl: normalizedTestUrl,
    });
  }
  if (browserGaps.length > 0 || androidGaps.length > 0) {
    discoveredMission.gaps = [
      ...discoveredMission.gaps.filter((gap) => !(
        (browserGaps.length > 0 && gap.code === 'FM_XRAY_GUI_CONTROL_UNAVAILABLE'
          && gap.surfaceId === 'web-gui' && gap.control === 'browser')
        || (androidGaps.length > 0 && gap.code === 'FM_XRAY_GUI_CONTROL_UNAVAILABLE'
          && gap.surfaceId === 'mobile-gui' && gap.control === 'computer-use')
      )),
      ...browserGaps,
      ...androidGaps,
    ];
  }
  const commandExecution = await executeXrayMission({ workspace, mission: discoveredMission, runCommand });
  const apiExecution = discoveredMission.xrayConfig?.api
    ? await executeApiChecks({ config: discoveredMission.xrayConfig.api })
    : { receipts: [], findings: [], gaps: [] };
  const execution = {
    receipts: [...commandExecution.receipts, ...apiExecution.receipts],
    findings: [...commandExecution.findings, ...apiExecution.findings],
    gaps: [...commandExecution.gaps, ...apiExecution.gaps],
  };
  const performance = performanceEvidence(execution.receipts, discoveredMission, discoveredMission.xrayConfig);
  const visual = await visualEvidence({ workspace, receipts: execution.receipts, mission: discoveredMission, config: discoveredMission.xrayConfig, mode: visualMode });
  const enrichedFindings = [...execution.findings, ...performance.findings, ...visual.findings];
  const preliminaryGaps = deduplicateGaps([...execution.gaps, ...performance.gaps, ...visual.gaps]);
  const score = scoreXrayQuality({ mission: discoveredMission, receipts: execution.receipts, findings: enrichedFindings, gaps: preliminaryGaps });
  const gaps = deduplicateGaps([...preliminaryGaps, ...score.gaps]);
  const mission = enrichMission(discoveredMission, execution.receipts, gaps);
  const coverage = browserCoverage(execution.receipts);
  const recommendations = improvementRecommendations(execution.findings, gaps);
  const report = {
    schemaVersion: 1,
    status: deriveStatus({ ...execution, findings: enrichedFindings, gaps }, score),
    generatedAt: now.toISOString(),
    adapters: {
      selected: selectedAdapters,
      executed: [...new Set(execution.receipts.map((receipt) => receipt.adapter)
        .filter(Boolean))],
    },
    mission,
    receipts: execution.receipts,
    findings: enrichedFindings,
    gaps,
    score,
    coverage,
    visual,
    performance,
    recommendations,
    errors: [],
  };
  await writeJsonAtomic(artifactStatePath(workspace, 'xray', 'test-mission-latest.json'), mission);
  await writeJsonAtomic(artifactStatePath(workspace, 'xray', 'report-latest.json'), report);
  const document = await publishProjectDocument({ workspace, name: 'xray-report.md', title: 'ForgeMind Xray Report', body: renderXrayMarkdown(report) });
  return {
    ...report,
    evidencePath: '.codex-orchestrator/xray/report-latest.json',
    projectDocuments: document ? ['docs/forgemind/xray-report.md'] : [],
  };
}

export async function getXrayStatus({ workspace }) {
  try {
    const report = JSON.parse(await readFile(artifactStatePath(workspace, 'xray', 'report-latest.json'), 'utf8'));
    return {
      ...report,
      evidencePath: '.codex-orchestrator/xray/report-latest.json',
      projectDocuments: ['docs/forgemind/xray-report.md'],
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { schemaVersion: 1, status: 'missing', nextAction: 'Run xray run first.', errors: [] };
    }
    throw error;
  }
}

export function renderXrayMarkdown(report) {
  const lines = [
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Adapters',
    '',
    `Selected: ${report.adapters?.selected?.join(', ') || 'none'}`,
    `Executed: ${report.adapters?.executed?.join(', ') || 'none'}`,
    '',
    '## Project context',
    '',
    `Category: ${report.mission?.projectContext?.productCategory ?? 'Not identified'}`,
    `Audience: ${report.mission?.projectContext?.targetAudience ?? 'Not identified'}`,
    `Primary job: ${report.mission?.projectContext?.primaryJob ?? 'Not identified'}`,
    `Deployment: ${report.mission?.projectContext?.deploymentModel ?? 'Not identified'}`,
    `Evidence: ${report.mission?.projectContext?.evidence ?? 'missing'}`,
    '',
    '## Critical flows',
    '',
    ...(report.mission?.criticalFlows?.length ? report.mission.criticalFlows.map((flow) => `- ${flow.id}: ${flow.url ?? flow.route ?? 'no URL'} (${flow.viewports?.join(', ') ?? 'default viewport'})`) : ['No safe web flow was discovered or configured.']),
    '',
    '## API evidence',
    '',
    ...(report.receipts.filter((receipt) => (receipt.surfaceIds ?? []).includes('api')).length ? report.receipts.filter((receipt) => (receipt.surfaceIds ?? []).includes('api')).map((receipt) => `- ${receipt.id}: ${receipt.statusCode ?? receipt.status} (${receipt.durationMs ?? '—'}ms)`) : ['No configured API execution receipt was recorded.']),
    '',
    '## Responsive coverage',
    '',
    ...(report.receipts.filter((receipt) => receipt.viewport).length ? report.receipts.filter((receipt) => receipt.viewport).map((receipt) => `- ${receipt.coverageArea ?? receipt.id}: ${receipt.viewport}`) : ['No viewport-specific GUI receipt was recorded.']),
    '',
    '## Quality score',
    '',
    `${report.score.value}/100 (${report.score.status})`,
    '',
    '### Components',
    '',
    '| Component | Weight | Status | Score | Deductions |',
    '| --- | ---: | --- | ---: | --- |',
    ...report.score.components.map((component) => `| ${component.label} | ${formatWeight(component.effectiveWeight)} | ${component.status} | ${component.score ?? '—'} | ${component.deductions.map(({ severity, value }) => `${severity} -${value}`).join(', ') || '—'} |`),
    '',
    '## Findings',
    '',
    ...(report.findings.length ? report.findings.map((finding) => `- **${finding.severity}** ${finding.title} (${finding.evidence.join(', ')})`) : ['No verified failures.']),
    '',
    '## Test gaps',
    '',
    ...(report.gaps.length ? report.gaps.map((gap) => `- ${gap.code}${gap.message ? `: ${gap.message}` : ''}${gap.nextAction ? ` Next action: ${gap.nextAction}` : ''}`) : ['No test gaps recorded.']),
    '',
    '## GUI coverage',
    '',
    ...(report.coverage.areas.length ? report.coverage.areas.map((area) => `- ${area}`) : ['No Browser GUI coverage recorded.']),
    '',
    '## Visual regression evidence',
    '',
    ...(report.visual?.checks?.length ? report.visual.checks.map((check) => `- ${check.flowId}: ${check.differencePercent?.toFixed(2) ?? '—'}% changed (${check.mode})`) : ['No screenshot-backed visual comparison was recorded.']),
    '',
    '## Performance budgets',
    '',
    ...(report.performance?.checks?.length ? report.performance.checks.map((check) => `- ${check.id}: ${check.durationMs ?? '—'}ms / ${check.budgetMs}ms`) : ['No configured performance budget was evaluated.']),
    '',
    '## Improvement proposals',
    '',
    ...(report.recommendations.length ? report.recommendations.map((proposal) => `- **${proposal.priority}** ${proposal.area}: ${proposal.recommendation}\n  - Evidence: ${proposal.evidence.join(', ')}\n  - Benefit: ${proposal.benefit}\n  - Verification: ${proposal.verification}`) : ['No improvement proposals recorded.']),
    '',
  ];
  return lines.join('\n');
}

function browserCoverage(receipts) {
  const areas = [...new Set(receipts
    .filter(({ control, status, coverageArea }) => ['browser', 'playwright'].includes(control)
      && ['passed', 'failed'].includes(status) && coverageArea)
    .map(({ coverageArea }) => coverageArea))].sort();
  return { areas, covered: areas.length };
}

function priorityForSeverity(severity) {
  return SEVERITY_DEDUCTIONS.has(severity) ? severity : 'medium';
}

function improvementRecommendations(findings, gaps) {
  return [
    ...findings.map((finding) => findingRecommendation(finding)),
    ...gaps.map((gap) => gapRecommendation(gap)),
  ].sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority));
}

function findingRecommendation(finding) {
  const area = finding.surfaces?.join(', ') || finding.componentIds?.join(', ') || finding.id;
  const title = finding.title || finding.id || area;
  const recommendation = finding.expected
    ? `Address the verified finding "${title}" by achieving the recorded expected outcome: ${finding.expected}`
    : `Address the verified finding: ${title}`;
  const benefit = finding.expected
    ? `Expected outcome: ${finding.expected}`
    : finding.userImpact
      ? `User impact addressed: ${finding.userImpact}`
      : `Expected outcome: ${title} is addressed.`;
  return {
    priority: priorityForSeverity(finding.severity),
    area,
    evidence: [...(finding.evidence ?? [])],
    recommendation,
    benefit,
    verification: finding.reproduction || finding.nextVerification || `Verify that ${title} is addressed for ${area}.`,
  };
}

function gapRecommendation(gap) {
  const code = gap.code || 'recorded-gap';
  const area = gap.coverageArea || gap.surfaceId || gap.componentId || gap.checkId || code;
  const description = gap.message || code;
  return {
    priority: priorityForSeverity(gap.severity),
    area,
    evidence: [...new Set([...(gap.evidence ?? []), ...[gap.checkId, code].filter(Boolean)])],
    recommendation: `Close the recorded gap ${code} for ${area}: ${description}`,
    benefit: gap.expected
      ? `Expected outcome: ${gap.expected}`
      : `Expected outcome: evidence resolves ${code} for ${area}.`,
    verification: gap.reproduction || gap.nextVerification || gap.nextAction
      || `Verify that ${code} is closed for ${area} and capture the resulting evidence.`,
  };
}

function priorityRank(priority) {
  return ['critical', 'high', 'medium', 'low'].indexOf(priority);
}

function normalizeFailureSeverity(severity) {
  return SEVERITY_DEDUCTIONS.has(severity) ? severity : DEFAULT_FAILURE_SEVERITY;
}

function classifyPackageScript(scripts, scriptName) {
  if (!scriptName || !scripts[scriptName]) return [];
  const reasons = new Set();
  const visited = new Set();

  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    for (const lifecycleName of [`pre${name}`, name, `post${name}`]) {
      const body = String(scripts[lifecycleName] ?? '');
      if (!body) continue;
      for (const reason of unsafeScriptReasons(body)) reasons.add(`${lifecycleName}:${reason}`);
      for (const referencedName of referencedPackageScripts(body)) {
        if (scripts[referencedName]) visit(referencedName);
        else reasons.add(`${lifecycleName}:unresolved-script-reference:${referencedName}`);
      }
    }
  };

  visit(scriptName);
  return [...reasons];
}

function unsafeScriptReasons(body) {
  const reasons = [];
  if (UNSAFE_COMMAND_PATTERN.test(body)) reasons.push('destructive-or-production-operation');
  if (DESTRUCTIVE_OPERATION_PATTERN.test(body)) reasons.push('destructive-filesystem-operation');
  if (CREDENTIAL_PATTERN.test(body)) reasons.push('credential-access');
  if (EXTERNAL_SPEND_PATTERN.test(body)) reasons.push('external-spend');
  if (hasUnverifiedRemoteTarget(body)) reasons.push('unverified-remote-target');
  if (ENVIRONMENT_TARGET_PATTERN.test(body)) reasons.push('environment-derived-target');
  if (!isRecognizedReadOnlyScript(body)) reasons.push('unclassified-script-operation');
  return reasons;
}

function isRecognizedReadOnlyScript(body) {
  const commands = String(body).split(/\s*(?:&&|\|\||;)\s*/).filter(Boolean);
  return commands.length > 0 && commands.every((rawCommand) => {
    const command = rawCommand
      .replace(/^cross-env\s+(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)*/i, '')
      .replace(/^(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)+/i, '')
      .trim();
    if (/^(?:npm|pnpm|yarn)\s+(?:run\s+)?[\w:.-]+(?:\s+--.*)?$/i.test(command)) return true;
    return /^(?:node\s+(?:--test|--check)\b|(?:npx\s+)?(?:vitest|jest|mocha|ava|tap|eslint|tsc)\b|(?:npx\s+)?playwright\s+test\b|(?:npx\s+)?cypress\s+run\b|(?:vite|next)\s+build\b|(?:webpack|rollup)\b|dotnet\s+(?:test|build)\b|python\s+-m\s+pytest\b|pytest\b|cargo\s+test\b|go\s+test\b|\.\/?gradlew(?:\.bat)?\s+test\b)/i.test(command);
  });
}

function commandComponentIds(check, scriptBody) {
  const componentIds = ['functional-correctness'];
  if (/\b(?:error|exception|negative|failure|fault|resilien|robust|edge[- ]?case|timeout)\b/i.test(`${check.source ?? ''} ${scriptBody ?? ''}`)) {
    componentIds.push('robustness-error-paths');
  }
  return componentIds;
}

function isRecognizedWebStart(command) {
  return /\b(?:vite|next(?:\s+dev)?|react-scripts\s+start|webpack(?:-dev-server)?|ng\s+serve|svelte-kit\s+dev|astro\s+dev|remix\s+dev|nuxt\s+dev)\b/i.test(String(command ?? ''));
}

function referencedPackageScripts(body) {
  const names = [];
  const pattern = /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?([\w:.-]+)/gi;
  for (const match of body.matchAll(pattern)) {
    if (!['run', 'exec', 'install', 'add', 'dlx'].includes(match[1])) names.push(match[1]);
  }
  return names;
}

function hasUnverifiedRemoteTarget(body) {
  for (const match of body.matchAll(/\bhttps?:\/\/[^\s'"`]+/gi)) {
    try {
      const hostname = new URL(match[0]).hostname.toLowerCase();
      if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return true;
    } catch {
      return true;
    }
  }
  return /\b(?:ssh|scp|sftp|ftp)\b/i.test(body)
    || (/\b(?:curl|wget)\b/i.test(body) && !/\b(?:localhost|127\.0\.0\.1|\[?::1\]?)\b/i.test(body));
}

function createGuiChecks(surfaces, guiControl = {}, guiReceipts = []) {
  const guiSurfaces = new Map(surfaces.filter(({ id }) => GUI_SURFACE_IDS.has(id)).map((surface) => [surface.id, surface]));
  const checks = [];
  const gaps = [];
  for (const candidate of Array.isArray(guiReceipts) ? guiReceipts : []) {
    const surface = guiSurfaces.get(candidate?.surfaceId);
    const browserReceipt = ['browser', 'playwright'].includes(candidate?.control);
    const androidReceipt = candidate?.adapter === 'android-adb';
    const allowedComponentIds = androidReceipt
      ? new Set([...GUI_COMPONENT_IDS, 'functional-correctness', 'robustness-error-paths'])
      : GUI_COMPONENT_IDS;
    const componentIds = [...new Set((candidate?.componentIds ?? []).filter((id) => allowedComponentIds.has(id)))];
    const evidence = (candidate?.evidence ?? [])
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => redactText(item).text);
    const { complete, ...flow } = browserFlowFields(candidate);
    if (browserReceipt && !complete) {
      gaps.push({
        code: 'FM_XRAY_GUI_RECEIPT_INCOMPLETE',
        surfaceId: candidate?.surfaceId,
        control: candidate.control,
        status: candidate?.status,
        message: 'Browser GUI receipt does not establish a reproducible GUI flow.',
      });
      continue;
    }
    if (browserReceipt && !isSafeBrowserTarget(flow.url)) {
      gaps.push({
        code: 'FM_XRAY_GUI_RECEIPT_TARGET_INVALID',
        surfaceId: candidate?.surfaceId,
        control: candidate.control,
        status: candidate?.status,
        message: 'Browser GUI receipt targets must use a local or test URL.',
      });
      continue;
    }
    if (androidReceipt && !isValidAndroidReceipt(candidate, evidence)) {
      gaps.push({
        code: 'FM_XRAY_ANDROID_RECEIPT_INCOMPLETE',
        surfaceId: candidate?.surfaceId,
        control: candidate?.control,
        status: candidate?.status,
        message: 'Android ADB receipt is missing canonical emulator, flow, control, or artifact evidence.',
      });
      continue;
    }
    const compatibleControl = candidate?.control === surface?.control
      || (surface?.control === 'browser' && candidate?.control === 'playwright');
    if (!surface || !compatibleControl || !['passed', 'failed', 'blocked', 'skipped'].includes(candidate.status)
      || componentIds.length === 0 || evidence.length === 0) continue;
    const checkId = `gui-${checks.length + 1}`;
    if (['blocked', 'skipped'].includes(candidate.status)) {
      gaps.push({
        code: `FM_XRAY_GUI_FLOW_${candidate.status.toUpperCase()}`,
        checkId,
        surfaceId: surface.id,
        control: surface.control,
        status: candidate.status,
        ...(surface.control === 'browser' ? flow : {}),
        message: `The recorded ${surface.control} GUI flow was ${candidate.status}.`,
      });
    }
    checks.push({
      id: checkId,
      kind: 'gui-control',
      control: surface.control,
      surfaceIds: [surface.id],
      componentIds,
      importedReceipt: {
        status: candidate.status,
        control: candidate.control,
        surfaceId: candidate.surfaceId,
        componentIds,
        evidence,
        ...(candidate.adapter ? { adapter: String(candidate.adapter) } : {}),
        ...(surface.control === 'browser' ? flow : {}),
        ...(androidReceipt ? androidReceiptFields(candidate) : {}),
        ...(candidate.status === 'failed' ? { severity: normalizeFailureSeverity(candidate.severity) } : {}),
      },
    });
  }
  for (const surface of guiSurfaces.values()) {
    if (checks.some((check) => check.surfaceIds.includes(surface.id))) continue;
    const available = surface.control === 'browser' ? guiControl.browser : guiControl.computerUse;
    if (available) checks.push({
      id: `gui-${checks.length + 1}`,
      kind: 'gui-control',
      control: surface.control,
      surfaceIds: [surface.id],
      componentIds: [...GUI_COMPONENT_IDS],
    });
  }
  return { checks, gaps };
}

function browserFlowFields(candidate) {
  const fields = ['url', 'coverageArea', 'controlLabel', 'action', 'expected', 'actual', 'reproduction'];
  const normalized = Object.fromEntries(fields.map((key) => [key, String(candidate?.[key] ?? '').trim()]));
  const artifacts = Object.fromEntries(['screenshot', 'trace', 'viewport']
    .map((key) => [key, String(candidate?.[key] ?? '').trim()])
    .filter(([, value]) => value));
  const durationMs = Number(candidate?.durationMs);
  return { ...normalized, ...artifacts, ...(Number.isFinite(durationMs) && durationMs >= 0 ? { durationMs } : {}), complete: fields.every((key) => normalized[key]) };
}

function isValidAndroidReceipt(candidate, evidence) {
  const fields = androidReceiptFields(candidate);
  const expectedEvidence = [fields.beforeUiTree, fields.afterUiTree, fields.screenshot, fields.log];
  return candidate?.surfaceId === 'mobile-gui'
    && candidate?.control === 'computer-use'
    && ['passed', 'failed'].includes(candidate?.status)
    && /^emulator-\d+$/.test(fields.serial)
    && /^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(fields.packageName)
    && fields.activity.startsWith(`${fields.packageName}/`)
    && fields.controls.length > 0
    && fields.controls.every(isAndroidControl)
    && ['controlLabel', 'action', 'expected', 'actual', 'reproduction', 'logBoundary'].every((key) => fields[key])
    && fields.uiTree === fields.afterUiTree
    && /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}$/.test(fields.logBoundary)
    && expectedEvidence.every((item) => isSafeAndroidEvidence(item) && evidence.includes(item));
}

function androidReceiptFields(candidate) {
  const controls = Array.isArray(candidate?.controls) ? candidate.controls.map((control) => ({
    label: redactText(String(control?.label ?? '').trim()).text,
    bounds: String(control?.bounds ?? '').trim(),
    center: { x: Number(control?.center?.x), y: Number(control?.center?.y) },
  })) : [];
  return {
    serial: String(candidate?.serial ?? '').trim(),
    packageName: String(candidate?.packageName ?? '').trim(),
    activity: String(candidate?.activity ?? '').trim(),
    controls,
    screenshot: String(candidate?.screenshot ?? '').trim(),
    beforeUiTree: String(candidate?.beforeUiTree ?? '').trim(),
    afterUiTree: String(candidate?.afterUiTree ?? '').trim(),
    uiTree: String(candidate?.uiTree ?? '').trim(),
    log: String(candidate?.log ?? '').trim(),
    logBoundary: String(candidate?.logBoundary ?? '').trim(),
    controlLabel: redactText(String(candidate?.controlLabel ?? '').trim()).text,
    action: redactText(String(candidate?.action ?? '').trim()).text,
    expected: redactText(String(candidate?.expected ?? '').trim()).text,
    actual: redactText(String(candidate?.actual ?? '').trim()).text,
    reproduction: redactText(String(candidate?.reproduction ?? '').trim()).text,
  };
}

function isAndroidControl(control) {
  return Boolean(control?.label)
    && /^\[-?\d+,-?\d+\]\[-?\d+,-?\d+\]$/.test(control?.bounds ?? '')
    && Number.isInteger(control?.center?.x)
    && Number.isInteger(control?.center?.y);
}

function isSafeAndroidEvidence(value) {
  const normalized = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  return normalized.startsWith('.codex-orchestrator/xray/android/')
    && !normalized.includes('\0')
    && !normalized.split('/').includes('..');
}

function canonicalBrowserUrl(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  try {
    return new URL(String(value).trim()).href;
  } catch {
    return String(value).trim();
  }
}

function enrichMission(mission, receipts, gaps) {
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const checks = (mission.checks ?? []).map((check) => {
    const { importedReceipt, ...persistedCheck } = check;
    const receipt = receiptById.get(check.id);
    return {
      ...persistedCheck,
      selection: receipt?.status === 'skipped' ? 'skipped' : 'selected',
      outcome: receipt?.status ?? 'not-run',
      receiptId: receipt ? receipt.id : null,
    };
  });
  return {
    ...mission,
    checks,
    selectedChecks: checks.filter(({ selection }) => selection === 'selected').map(({ id }) => id),
    skippedChecks: checks.filter(({ selection }) => selection === 'skipped').map(({ id }) => id),
    receipts,
    gaps,
  };
}

function deduplicateGaps(gaps) {
  const unique = new Map();
  for (const gap of gaps) {
    const key = JSON.stringify([gap.code, gap.checkId ?? null, gap.surfaceId ?? null, gap.componentId ?? null]);
    if (!unique.has(key)) unique.set(key, gap);
  }
  return [...unique.values()];
}

function findingAppliesToComponent(finding, componentId) {
  const surfaces = new Set(finding.surfaces ?? []);
  if (componentId === 'api-contracts') return surfaces.has('api') || surfaces.has('cli');
  if (componentId === 'gui-usability' || componentId === 'accessibility-visual') {
    const matchesGui = surfaces.has('web-gui') || surfaces.has('native-gui') || surfaces.has('mobile-gui');
    return matchesGui && (!finding.componentIds?.length || finding.componentIds.includes(componentId));
  }
  if (componentId === 'functional-correctness') {
    return finding.componentIds?.length ? finding.componentIds.includes(componentId) : true;
  }
  if (componentId === 'robustness-error-paths') {
    return finding.componentIds?.length
      ? finding.componentIds.includes(componentId)
      : /error|exception|timeout|resilien|robust/i.test(`${finding.title ?? ''} ${finding.actual ?? ''}`);
  }
  return false;
}

function componentEvidence(componentId, receipts, gaps, surfaceIds, functionalEvidence, robustnessEvidence, apiOrCliEvidence, guiEvidence, accessibilityEvidence) {
  if (componentId === 'functional-correctness') return functionalEvidence;
  if (componentId === 'robustness-error-paths') return robustnessEvidence;
  if (componentId === 'api-contracts') return apiOrCliEvidence;
  if (componentId === 'gui-usability') return guiEvidence;
  if (componentId === 'accessibility-visual') return accessibilityEvidence;
  if (componentId === 'evidence-coverage') return { receipts: receipts.map(({ id }) => id), gaps: gaps.map(({ code }) => code) };
  return receipts.map(({ id }) => id);
}

function deriveStatus(execution, score) {
  if (execution.findings.length) return 'issues-found';
  if (execution.gaps.length || score.status === 'insufficient-evidence') return 'gaps-found';
  return 'passed';
}

function formatWeight(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function isExecutionReceipt(receipt) {
  return receipt.status === 'passed' || receipt.status === 'failed';
}

function componentStatus(hasSurface, evidenceCount) {
  if (!hasSurface) return 'not-applicable';
  return evidenceCount > 0 ? 'applicable' : 'insufficient-evidence';
}

function receiptIdsForSurfaces(mission, receiptIds, targetSurfaceIds) {
  const targets = new Set(targetSurfaceIds);
  return (mission?.checks ?? [])
    .filter((check) => receiptIds.has(check.id) && (check.surfaceIds ?? []).some((id) => targets.has(id)))
    .map(({ id }) => id);
}

function receiptIdsForGuiComponent(mission, receiptIds, componentId) {
  return (mission?.checks ?? [])
    .filter((check) => check.kind === 'gui-control'
      && receiptIds.has(check.id)
      && (check.surfaceIds ?? []).some((id) => GUI_SURFACE_IDS.has(id))
      && (check.componentIds ?? []).includes(componentId))
    .map(({ id }) => id);
}

function receiptIdsForComponent(mission, receiptIds, componentId) {
  return (mission?.checks ?? [])
    .filter((check) => receiptIds.has(check.id)
      && ((check.componentIds ?? []).includes(componentId)
        || (componentId === 'functional-correctness' && check.kind !== 'gui-control' && !check.componentIds?.length)))
    .map(({ id }) => id);
}

function evidenceCoverage(mission, surfaces, receiptIds) {
  const units = surfaces.flatMap(({ id }) => GUI_SURFACE_IDS.has(id)
    ? [{ id, componentId: 'gui-usability' }, { id, componentId: 'accessibility-visual' }]
    : [{ id, componentId: null }]);
  const covered = units.filter(({ id, componentId }) => componentId
    ? (mission?.checks ?? []).some((check) => check.kind === 'gui-control'
      && receiptIds.has(check.id)
      && check.surfaceIds?.includes(id)
      && check.componentIds?.includes(componentId))
    : receiptIdsForSurfaces(mission, receiptIds, [id]).length > 0);
  return { covered: covered.length, total: units.length, score: units.length ? Math.round((covered.length / units.length) * 100) : 0 };
}

function missingSurfaceEvidenceGaps(mission, surfaces, receiptIds) {
  return surfaces.flatMap(({ id }) => {
    if (!GUI_SURFACE_IDS.has(id)) {
      return receiptIdsForSurfaces(mission, receiptIds, [id]).length === 0 ? [{
        code: 'FM_XRAY_SURFACE_EVIDENCE_UNAVAILABLE',
        surfaceId: id,
        message: `No executed check produced evidence for the detected ${id} surface.`,
      }] : [];
    }
    return [...GUI_COMPONENT_IDS]
      .filter((componentId) => !(mission?.checks ?? []).some((check) => check.kind === 'gui-control'
        && receiptIds.has(check.id)
        && check.surfaceIds?.includes(id)
        && check.componentIds?.includes(componentId)))
      .map((componentId) => ({
        code: 'FM_XRAY_GUI_COMPONENT_EVIDENCE_UNAVAILABLE',
        surfaceId: id,
        componentId,
        message: `No surface-specific receipt covers ${componentId} for the detected ${id} surface.`,
      }));
  });
}

function redistributedWeights(applicability, applicableWeight) {
  const applicable = SCORE_COMPONENTS.filter(({ id }) => applicability[id] === 'applicable');
  const weights = new Map();
  let assigned = 0;
  applicable.forEach((component, index) => {
    const weight = index === applicable.length - 1
      ? 100 - assigned
      : (component.configuredWeight / applicableWeight) * 100;
    weights.set(component.id, weight);
    assigned += weight;
  });
  return weights;
}

async function readPackageManifest(workspace) {
  try {
    return JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

async function detectGuiProjectSignals(root, files, manifest, profile) {
  const normalizedFiles = files.map((name) => name.replaceAll('\\', '/'));
  const dependencies = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const descriptorFiles = normalizedFiles.filter((name) => /\.(?:csproj|fsproj|pubspec\.yaml)$/i.test(name) || /(?:^|\/)pubspec\.yaml$/i.test(name));
  const descriptorText = (await Promise.all(descriptorFiles.map(async (name) => {
    try {
      return await readFile(path.join(root, name), 'utf8');
    } catch {
      return '';
    }
  }))).join('\n');
  const windowsDesktop = /Microsoft\.NET\.Sdk\.WindowsDesktop|<UseWPF>\s*true|<UseWindowsForms>\s*true/i.test(descriptorText);
  const androidProject = normalizedFiles.some((name) => /(?:^|\/)AndroidManifest\.xml$/i.test(name))
    && normalizedFiles.some((name) => /(?:^|\/)(?:gradlew(?:\.bat)?|build\.gradle(?:\.kts)?)$/i.test(name));
  const iosProject = normalizedFiles.some((name) => /\.xcodeproj\/project\.pbxproj$|(?:^|\/)Podfile$|\.xcworkspace\//i.test(name));
  const mauiMobile = /<TargetFrameworks?>[^<]*(?:android|ios|maccatalyst)/i.test(descriptorText);
  const flutterMobile = /(?:^|\n)\s*flutter\s*:/i.test(descriptorText);
  const scriptedMobile = hasKnownDependency(dependencies, MOBILE_GUI_DEPENDENCIES)
    && Boolean(manifest.scripts?.android || manifest.scripts?.ios || manifest.scripts?.test || manifest.scripts?.start);
  return {
    nativeGui: windowsDesktop && (profile.stacks?.includes('dotnet') || normalizedFiles.some((name) => /\.(?:sln|csproj|fsproj)$/i.test(name))),
    mobileGui: androidProject || iosProject || mauiMobile || flutterMobile || scriptedMobile,
    iosGui: iosProject || /<TargetFrameworks?>[^<]*ios/i.test(descriptorText) || Boolean(manifest.scripts?.ios),
  };
}

function performanceEvidence(receipts, mission, config) {
  const checks = []; const findings = []; const gaps = [];
  for (const receipt of receipts) {
    const surfaceIds = receiptSurfaceIds(receipt, mission);
    const webBudget = surfaceIds.includes('web-gui') ? config?.web?.performance?.navigationMs : undefined;
    const budgetMs = webBudget;
    if (budgetMs === undefined) continue;
    checks.push({ id: receipt.id, budgetMs, durationMs: receipt.durationMs });
    const result = performanceFinding(receipt, budgetMs);
    if (!result) continue;
    if (result.code) gaps.push(result); else findings.push(result);
  }
  return { checks, findings, gaps };
}

async function visualEvidence({ workspace, receipts, mission, config, mode }) {
  const visualConfig = config?.web?.visualBaseline;
  if (!visualConfig?.enabled) return { mode, checks: [], findings: [], gaps: [] };
  const checks = []; const findings = []; const gaps = [];
  for (const receipt of receipts) {
    if (!receiptSurfaceIds(receipt, mission).includes('web-gui') || !receipt.screenshot) continue;
    const result = await compareVisualEvidence({ workspace, flowId: receipt.coverageArea || receipt.id, screenshot: receipt.screenshot, thresholdPercent: visualConfig.thresholdPercent, baseline: mode === 'baseline' });
    checks.push({ flowId: receipt.coverageArea || receipt.id, mode, differencePercent: result.differencePercent, evidence: result.evidence });
    if (result.finding) findings.push(result.finding);
    if (result.gap) gaps.push(result.gap);
  }
  return { mode, checks, findings, gaps };
}

function receiptSurfaceIds(receipt, mission) {
  return receipt.surfaceIds ?? mission.checks?.find((check) => check.id === receipt.id)?.surfaceIds ?? [];
}

async function projectFileNames(root, relative = '') {
  try {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    const names = [];
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) names.push(...await projectFileNames(root, child));
      else if (entry.isFile()) names.push(child);
    }
    return names;
  } catch {
    return [];
  }
}

function hasKnownDependency(dependencies, knownDependencies) {
  return [...knownDependencies].some((dependency) => dependencies.has(dependency));
}

function hasRouteFile(profile) {
  return (profile.files ?? []).some((name) => /(?:^|\/|\\)(?:routes?|controllers?)(?:\.|\/|\\)/i.test(name));
}
