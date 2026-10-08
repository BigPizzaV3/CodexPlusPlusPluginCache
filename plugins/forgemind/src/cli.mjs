import { ForgeMindError, invalidInput } from './errors.mjs';
import { resolvePluginRoot, resolveWorkspace } from './paths.mjs';
import { activateArtifactStore, addArtifactMetadata, artifactStatePath, deactivateArtifactStore } from './artifact-store.mjs';
import { fileURLToPath } from 'node:url';

const MODULE_PLUGIN_ROOT = fileURLToPath(new URL('../', import.meta.url));

const PRIMARY_COMMANDS = [
  'help',
  'doctor',
  'validate',
  'init',
  'inspect',
  'intelligence',
  'verify',
  'gaps',
  'risks',
  'readiness',
  'evidence',
  'outcome',
  'route',
  'signals',
  'guide',
  'one',
  'status',
  'insights',
  'foundation',
  'compass',
  'hero',
  'innovation',
  'leap',
  'autopilot',
  'portfolio',
  'transform',
  'twin',
  'evolve-ui',
  'growth',
  'integration-mesh',
  'spark',
  'evolve',
  'venture',
  'council',
  'showcase',
  'ship',
  'radical',
  'operator',
  'observer',
  'experiment-autopilot',
  'ai',
  'ai-refactor',
  'truth-loop',
  'autonomy',
  'demo',
  'discovery',
  'checkpoint',
  'visual',
  'experience',
  'complete',
  'research',
  'finance',
  'telemetry',
  'discovery-loop',
  'product',
  'ui-test',
  'capabilities',
  'compose',
  'factory',
  'delegation',
  'idea-to-mvp',
  'launch-mvp',
  'testing',
  'memory',
  'dashboard',
  'forge',
  'eval',
  'package',
  'install',
  'selftest',
  'uninstall',
  'xray',
  'design-fidelity',
];

const HELP = `ForgeMind — vendor-neutral trust and evidence-driven delivery for Codex

Usage: forgemind <command> [options]

Commands:
  ${PRIMARY_COMMANDS.join('\n  ')}

Trust Fabric:
  forgemind forge help
  Nine capabilities: trust, strategy, genome, flight, tournament, shrink, loop, escrow, federate
`;

export async function runCli(argv, context = {}) {
  const stdout = context.stdout ?? process.stdout;
  const stderr = context.stderr ?? process.stderr;
  let artifactStoreActive = false;
  const startedAt = Date.now();
  try {
    const command = argv[0] ?? 'help';
    if (command === 'help' || command === '--help' || command === '-h') {
      const data = addArtifactMetadata({ commands: PRIMARY_COMMANDS });
      if (argv.includes('--json')) stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      else stdout.write(HELP);
      return { exitCode: 0, data };
    }
    const { options, positionals } = parseOptions(argv.slice(1));
    if (!['validate', 'package', 'install', 'selftest', 'uninstall', 'eval', 'legacy'].includes(command)) {
      await activateArtifactStore({
        workspace: options.workspace ?? context.cwd ?? process.cwd(),
        mode: options.artifacts === true ? 'workspace' : options.artifacts ?? 'workspace',
        artifactDir: options['artifact-dir'],
      });
      artifactStoreActive = true;
    }
    let data;
    if (command === 'validate') {
      const { validatePlugin } = await import('./validate.mjs');
      const pluginRoot = await resolvePluginRoot(options.plugin ?? MODULE_PLUGIN_ROOT);
      data = await validatePlugin(pluginRoot, { strictRelease: Boolean(options['strict-release']) });
    } else if (command === 'doctor') {
      const { diagnose } = await import('./doctor.mjs');
      const pluginRoot = await resolvePluginRoot(options.plugin ?? MODULE_PLUGIN_ROOT);
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      data = await diagnose({ pluginRoot, workspace, installation: Boolean(options.installation) });
    } else if (command === 'foundation') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'run';
      const foundation = await import('./foundation.mjs');
      if (action === 'run') data = await foundation.runFoundation({ workspace, goal: options.goal, mode: 'direct' });
      else if (action === 'status') data = await foundation.getFoundationStatus({ workspace });
      else if (action === 'refresh') data = await foundation.refreshFoundation({ workspace });
      else throw invalidInput('FM_FOUNDATION_ACTION_INVALID', 'Foundation supports run, status, and refresh.');
    } else if (command === 'one') {
      const { runForgeMindOne } = await import('./one.mjs');
      data = await runForgeMindOne({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal });
    } else if (command === 'status') {
      const { getForgeMindStatus } = await import('./one.mjs');
      data = await getForgeMindStatus({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'insights') {
      const { getCommandMetrics } = await import('./command-metrics.mjs');
      data = await getCommandMetrics({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'inspect') {
      const { inspectProject } = await import('./project.mjs');
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      data = { status: 'passed', ...await inspectProject(workspace), errors: [] };
    } else if (command === 'intelligence') {
      const { scanAppIntelligence } = await import('./app-intelligence.mjs');
      data = await scanAppIntelligence({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'evidence' && positionals[0] === 'import') {
      const { importEvidence } = await import('./evidence-engine.mjs');
      data = await importEvidence({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), input: options.input });
    } else if (command === 'evidence' && positionals[0] === 'assess') {
      const { assessEvidence } = await import('./evidence-engine.mjs');
      data = await assessEvidence({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal });
    } else if (command === 'init') {
      const { initializeWorkspace } = await import('./artifacts.mjs');
      const pluginRoot = await resolvePluginRoot(options.plugin ?? MODULE_PLUGIN_ROOT);
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      data = await initializeWorkspace({
        pluginRoot,
        workspace,
        withMemory: Boolean(options.memory),
        withArtifacts: Boolean(options.artifacts),
      });
    } else if (command === 'verify') {
      const { verifyWorkspace } = await import('./verify.mjs');
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      data = await verifyWorkspace({ workspace, run: Boolean(options.run), allowInferred: Boolean(options['allow-inferred']) });
    } else if (command === 'gaps') {
      const { scanGaps } = await import('./gaps.mjs');
      data = await scanGaps({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'risks') {
      const { scanRisks } = await import('./risks.mjs');
      data = await scanRisks({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'readiness') {
      const { scoreReadiness } = await import('./readiness.mjs');
      data = await scoreReadiness({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'memory') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'list';
      const { appendMemoryEntry, findMemoryConflicts, readActiveMemory } = await import('./memory.mjs');
      if (action === 'add') {
        data = await appendMemoryEntry({
          workspace,
          scope: options.scope ?? 'shared',
          entry: {
            type: options.type,
            subject: options.subject,
            statement: options.statement,
            source: options.source,
            evidence: options.evidence ? String(options.evidence).split(',') : [],
            author: options.author ?? process.env.USERNAME ?? process.env.USER ?? 'unknown',
            confidence: Number(options.confidence ?? 0.5),
            reviewState: options['review-state'] ?? 'pending',
            sensitivity: options.sensitivity ?? 'internal',
            nonExpiring: Boolean(options['non-expiring']),
            expiresAt: options.expires,
            supersedes: options.supersedes,
          },
        });
      } else if (action === 'migrate') {
        const { migrateMarkdownMemory } = await import('./migrate-memory.mjs');
        data = await migrateMarkdownMemory({ workspace, author: options.author });
      } else {
        const entries = await readActiveMemory({ workspace, scope: options.scope ?? 'shared' });
        data = action === 'conflicts'
          ? { schemaVersion: 1, status: 'passed', conflicts: findMemoryConflicts(entries), errors: [] }
          : { schemaVersion: 1, status: 'passed', entries, errors: [] };
      }
    } else if (command === 'evidence') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'verify';
      const { createDeliveryProof, verifyDeliveryProof } = await import('./evidence.mjs');
      if (action === 'create') {
        data = await createDeliveryProof({
          workspace,
          intent: options.intent,
          acceptanceCriteria: splitList(options.acceptance),
          verification: await readWorkspaceReport(workspace, 'verification-latest.json', { status: 'missing', commands: [], errors: [] }),
          risks: await readWorkspaceReport(workspace, 'risk-radar-latest.json', { status: 'missing', risks: [] }),
          decisions: splitList(options.decisions),
          rollback: splitList(options.rollback),
          unresolved: splitList(options.unresolved),
        });
      } else {
        const latest = await readLatestProof(workspace);
        data = await verifyDeliveryProof({ workspace, proofPath: options.proof ?? latest.proofPath });
      }
    } else if (command === 'outcome') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'list';
      const { listOutcomes, recordOutcome } = await import('./outcomes.mjs');
      if (action === 'record') {
        data = await recordOutcome({ workspace, outcome: {
          task: options.task,
          taskCategory: options.category,
          route: options.route,
          project: { stacks: splitList(options.stacks), packageManager: options['package-manager'] ?? null },
          durationMinutes: Number(options.duration ?? 0),
          verificationStatus: options.verification ?? 'missing',
          correctionCount: Number(options.corrections ?? 0),
          userAccepted: String(options.accepted).toLowerCase() === 'true',
          residualDefects: Number(options.defects ?? 0),
          evidence: splitList(options.evidence),
        } });
      } else {
        data = { schemaVersion: 1, status: 'passed', outcomes: await listOutcomes({ workspace }), errors: [] };
      }
    } else if (command === 'route') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const { listOutcomes } = await import('./outcomes.mjs');
      const { inspectProject } = await import('./project.mjs');
      const { recommendRoute } = await import('./router.mjs');
      const { loadConfig } = await import('./config.mjs');
      const config = await loadConfig(workspace);
      data = { status: 'passed', ...recommendRoute({
        profile: await inspectProject(workspace),
        task: { category: options.category ?? 'unknown', risk: options.risk, path: options.path },
        outcomes: await listOutcomes({ workspace }),
        policy: config.policy,
        routing: config.routing,
      }), errors: [] };
    } else if (command === 'signals') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'cluster';
      const { clusterSignals, createUspRecords, importSignals, listSignals, saveUspRecords } = await import('./signals.mjs');
      if (action === 'import') {
        data = await importSignals({ workspace, input: options.input, format: options.format, sourceType: options.source ?? 'external-export' });
      } else {
        const clusters = clusterSignals(await listSignals({ workspace }));
        data = action === 'usps'
          ? await saveUspRecords({ workspace, records: createUspRecords(clusters) })
          : { schemaVersion: 1, status: 'passed', clusters, errors: [] };
      }
    } else if (command === 'hero') {
      const action = positionals[0] ?? 'run';
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const hero = await import('./hero-control.mjs');
      if (action === 'run' || action === 'status') data = await hero.runHeroControl({ workspace });
      else if (action === 'execute') data = await hero.executeHeroControl({ workspace, run: Boolean(options.run) });
      else if (action === 'advance') data = await hero.advanceHeroMission({ workspace, packet: options.packet, outcome: options.outcome, evidence: options.evidence });
      else throw invalidInput('FM_HERO_ACTION_INVALID', 'Hero supports run, status, execute, and advance.');
    } else if (command === 'guide' || command === 'start') {
      const { runStart } = await import('./start.mjs');
      data = await runStart({
        workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()),
        context: options.context,
        outcome: options.outcome,
        mode: options.mode,
      });
    } else if (command === 'compass') {
      const action = positionals[0] ?? 'run';
      if (action !== 'run') throw invalidInput('FM_COMPASS_ACTION_INVALID', 'Compass supports run.');
      const { runCompass } = await import('./primary-journeys.mjs');
      data = await runCompass({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal });
    } else if (command === 'xray') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'run';
      const xray = await import('./xray.mjs');
      if (action === 'run' || action === 'baseline') data = await xray.runXray({
        workspace,
        goal: options.goal,
        testUrl: options['test-url'],
        adapters: xray.parseXrayAdapters(options.adapters),
        guiReceipts: parseJsonArray(options['gui-receipts'], 'FM_XRAY_GUI_RECEIPTS_INVALID'),
        visualMode: action === 'baseline' ? 'baseline' : 'compare',
      });
      else if (action === 'status') data = await xray.getXrayStatus({ workspace });
      else throw invalidInput('FM_XRAY_ACTION_INVALID', 'Xray supports run, baseline, and status.');
    } else if (command === 'design-fidelity') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'run';
      const designFidelity = await import('./design-fidelity.mjs');
      if (action === 'run') data = await designFidelity.runDesignFidelity({ workspace, references: options.references, route: options.route, viewport: options.viewport, thresholdPercent: options.threshold, maxIterations: options['max-iterations'], controlContractId: options['control-contract'], controlObservations: parseJsonArray(options['control-observations'], 'FM_DESIGN_FIDELITY_CONTROLS_INVALID'), draftId: options['draft-id'] });
      else if (action === 'import-draft') { const drafts = await import('./design-fidelity-drafts.mjs'); data = await drafts.importProductDesignDraft({ workspace, input: options.input, route: options.route, viewport: options.viewport }); }
      else if (action === 'propose') { const drafts = await import('./design-fidelity-drafts.mjs'); data = await drafts.createProductDesignProposals({ workspace, inputs: options.inputs, route: options.route, viewport: options.viewport, goal: options.goal }); }
      else if (action === 'proposals') { const drafts = await import('./design-fidelity-drafts.mjs'); data = await drafts.loadProductDesignProposals({ workspace, proposalSetId: options['proposal-set'] }); if (!data) throw invalidInput('FM_DESIGN_FIDELITY_PROPOSALS_MISSING', 'Create a Product Design proposal set first.'); }
      else if (action === 'select') { const drafts = await import('./design-fidelity-drafts.mjs'); data = await drafts.selectProductDesignProposal({ workspace, proposalSetId: options['proposal-set'], proposalId: options.proposal, reason: options.reason }); }
      else if (action === 'prepare' || action === 'apply') { const drafts = await import('./design-fidelity-drafts.mjs'); data = await drafts.prepareSelectedProductDesignProposal({ workspace, proposalSetId: options['proposal-set'], proposalId: options.proposal, controlContractId: options['control-contract'] }); if (action === 'apply') data.deprecation = 'Use design-fidelity prepare; it creates an implementation plan but does not itself edit source files.'; }
      else if (action === 'contract') { const controls = await import('./design-fidelity-controls.mjs'); data = await controls.saveControlContract({ workspace, contract: parseJson(options.contract, 'FM_DESIGN_FIDELITY_CONTROL_INVALID') }); }
      else if (action === 'status') data = await designFidelity.getDesignFidelityStatus({ workspace });
      else throw invalidInput('FM_DESIGN_FIDELITY_ACTION_INVALID', 'Design Fidelity supports run, import-draft, propose, proposals, select, prepare, contract, and status.');
    } else if (command === 'leap') {
      const action = positionals[0] ?? 'run';
      const { advanceLeap, continueLeap, getLeapStatus, runLeap } = await import('./leap.mjs');
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      if (action === 'run') data = await runLeap({ workspace, goal: options.goal, mode: options.mode, autonomy: parseJson(options.autonomy, 'FM_LEAP_AUTONOMY_INVALID') });
      else if (action === 'continue') data = await continueLeap({ workspace });
      else if (action === 'status') data = await getLeapStatus({ workspace });
      else if (action === 'advance') data = await advanceLeap({ workspace, packet: options.packet, outcome: options.outcome, evidence: splitList(options.evidence) });
      else throw invalidInput('FM_LEAP_ACTION_INVALID', 'Leap supports run, continue, status, and advance.');
    } else if (command === 'autopilot') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'status';
      const autopilot = await import('./autopilot.mjs');
      if (action === 'start' && options.mode === 'portfolio') { const portfolio = await import('./portfolio-autopilot.mjs'); data = await portfolio.discoverPortfolio({ workspace, goal: options.goal, maxConcurrentCandidates: options.concurrency }); }
      else if (action === 'start') data = await autopilot.startAutopilot({ workspace, goal: options.goal, autonomy: parseJson(options.autonomy, 'FM_AUTOPILOT_AUTONOMY_INVALID') });
      else if (action === 'status') data = await autopilot.getAutopilotStatus({ workspace });
      else if (action === 'resume') data = await autopilot.resumeAutopilot({ workspace });
      else if (action === 'hold') data = await autopilot.holdAutopilot({ workspace, reason: options.reason });
      else if (action === 'run') {
        const { loadConfig } = await import('./config.mjs');
        const { executeAdapter } = await import('./adapters.mjs');
        const adapterAction = options.action ? parseJson(options.action, 'FM_AUTOPILOT_ACTION_INVALID') : null;
        const grant = options.grant ? parseJson(options.grant, 'FM_AUTOPILOT_GRANT_INVALID') : null;
        const config = await loadConfig(workspace);
        data = await autopilot.runAutopilot({ workspace, executeAction: adapterAction ? (mission) => executeAdapter({ workspace, mission, action: { ...adapterAction, missionId: mission.id }, grant, policy: config.policy, config: config.redaction }) : null });
      } else throw invalidInput('FM_AUTOPILOT_ACTION_INVALID', 'Autopilot supports start, run, status, resume, and hold.');
    } else if (command === 'portfolio') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'status'; const portfolio = await import('./portfolio-autopilot.mjs');
      if (action === 'plan') { const { runPortfolio } = await import('./primary-journeys.mjs'); data = await runPortfolio({ workspace, goal: options.goal }); }
      else if (action === 'discover') data = await portfolio.discoverPortfolio({ workspace, goal: options.goal, maxConcurrentCandidates: options.concurrency });
      else if (action === 'status' || action === 'candidate') data = await portfolio.getPortfolio({ workspace });
      else if (action === 'run' || action === 'resume') data = await portfolio.runPortfolio({ workspace });
      else if (action === 'stop') data = await portfolio.stopCandidate({ workspace, id: options.id, reason: options.reason });
      else throw invalidInput('FM_PORTFOLIO_ACTION_INVALID', 'Portfolio supports discover, status, run, resume, candidate, and stop.');
    } else if (command === 'transform') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'run'; const portfolio = await import('./portfolio-autopilot.mjs');
      if (action === 'run') { const discovered = await portfolio.discoverPortfolio({ workspace, goal: options.goal, maxConcurrentCandidates: options.concurrency }); const { createIntegrationMesh } = await import('./integration-mesh.mjs'); const mesh = await createIntegrationMesh({ workspace }); data = await portfolio.runPortfolio({ workspace }); data.discoveredCandidates = discovered.candidates.length; data.integrationMesh = mesh; }
      else if (action === 'status') data = await portfolio.getPortfolio({ workspace });
      else if (action === 'resume') data = await portfolio.runPortfolio({ workspace });
      else throw invalidInput('FM_TRANSFORM_ACTION_INVALID', 'Transform supports run, status, and resume.');
    } else if (command === 'twin') {
      const { createApplicationTwin } = await import('./application-twin.mjs'); data = await createApplicationTwin({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'evolve-ui') {
      const { createUxEvolution } = await import('./ux-evolution.mjs'); data = await createUxEvolution({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), workflowId: options.workflow });
    } else if (command === 'growth') {
      const { createGrowthLoop } = await import('./growth-loop.mjs'); data = await createGrowthLoop({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal });
    } else if (command === 'integration-mesh') {
      const { createIntegrationMesh } = await import('./integration-mesh.mjs'); data = await createIntegrationMesh({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), integrations: options.integrations ? parseJson(options.integrations, 'FM_MESH_INTEGRATIONS_INVALID') : [] });
    } else if (['spark', 'evolve', 'venture', 'council', 'showcase', 'ship'].includes(command)) {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? (command === 'council' ? 'decide' : 'run');
      const valid = { spark: 'run', evolve: 'run', venture: 'run', council: 'decide', showcase: 'create', ship: 'plan' };
      if (action !== valid[command]) throw invalidInput('FM_PRIMARY_JOURNEY_ACTION_INVALID', `${command} supports ${valid[command]}.`);
      const journeys = await import('./primary-journeys.mjs');
      const runners = { spark: journeys.runSpark, evolve: journeys.runEvolve, venture: journeys.runVenture, council: journeys.runCouncil, showcase: journeys.runShowcase, ship: journeys.runShip };
      data = await runners[command]({ workspace, goal: options.goal, options });
    } else if (command === 'innovation') {
      const action = positionals[0] ?? 'portfolio';
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      if (action === 'portfolio') {
        const { createInnovationPortfolio } = await import('./innovation-portfolio.mjs');
        data = await createInnovationPortfolio({ workspace, goal: options.goal });
      } else if (action === 'saas') {
        const { createSaasOpportunityEngine } = await import('./saas-opportunity-engine.mjs');
        data = await createSaasOpportunityEngine({ workspace, goal: options.goal });
      } else throw invalidInput('FM_INNOVATION_ACTION_INVALID', 'Innovation supports portfolio and saas.');
    } else if (command === 'discovery') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'list';
      const { createExperiment, decideExperiment, listExperiments, scoreDiscovery } = await import('./discovery.mjs');
      if (action === 'create') data = await createExperiment({ workspace, experiment: { title: options.title, hypothesis: options.hypothesis, metric: options.metric, audience: options.audience, owner: options.owner, timeframe: options.timeframe, assumptions: options.assumptions, interviewSignals: options['interview-signals'], evidence: options.evidence } });
      else if (action === 'decide') data = await decideExperiment({ workspace, id: options.id, decision: options.decision, evidence: options.evidence });
      else if (action === 'scorecard') data = await scoreDiscovery({ workspace });
      else data = { schemaVersion: 1, status: 'passed', experiments: await listExperiments({ workspace }), errors: [] };
    } else if (command === 'checkpoint') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const { listCheckpoints, resumeCheckpoint, saveCheckpoint } = await import('./checkpoints.mjs');
      data = positionals[0] === 'save'
        ? await saveCheckpoint({ workspace, summary: options.summary, next: options.next })
        : positionals[0] === 'resume'
          ? await resumeCheckpoint({ workspace, id: options.id })
        : { schemaVersion: 1, status: 'passed', checkpoints: await listCheckpoints({ workspace }), errors: [] };
    } else if (command === 'visual') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const { captureBrowserScreenshot, compareVisualEvidence, recordVisualEvidence } = await import('./visual-qa.mjs');
      data = positionals[0] === 'capture'
        ? await captureBrowserScreenshot({ workspace, url: options.url, output: options.output, label: options.label, viewport: options.viewport })
        : positionals[0] === 'compare'
          ? await compareVisualEvidence({ workspace, baseline: options.baseline, candidate: options.candidate, label: options.label })
          : await recordVisualEvidence({ workspace, input: options.input, label: options.label, viewport: options.viewport });
    } else if (command === 'experience') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'canvas';
      const { createExperienceCanvas, createOpportunityCase, createTrustworthyDemo, detectDesignDrift, proposeTestRepair, recordExperienceEvidence } = await import('./experience-lab.mjs');
      if (action === 'canvas') data = await createExperienceCanvas({ workspace, goal: options.goal, options });
      else if (action === 'market-case') data = await createOpportunityCase({ workspace, goal: options.goal, options });
      else if (action === 'evidence') data = await recordExperienceEvidence({ workspace, task: options.task, states: options.states, layers: options.layers, viewport: options.viewport });
      else if (action === 'drift') data = await detectDesignDrift({ workspace, baseline: options.baseline, candidate: options.candidate });
      else if (action === 'test-repair') data = await proposeTestRepair({ workspace, failure: options.failure, selector: options.selector });
      else if (action === 'demo') data = await createTrustworthyDemo({ workspace, title: options.title });
      else throw invalidInput('FM_EXPERIENCE_ACTION_INVALID', 'Experience supports canvas, market-case, evidence, drift, test-repair, and demo.');
    } else if (['operator', 'observer', 'experiment-autopilot', 'ai', 'ai-refactor', 'truth-loop', 'autonomy', 'demo'].includes(command)) {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const suite = await import('./ai-native-suite.mjs');
      if (command === 'operator') data = await suite.operator({ workspace, action: positionals[0] ?? 'plan', goal: options.goal, approved: Boolean(options.approved) });
      else if (command === 'observer') data = await suite.observeWorkflow({ workspace, input: options.input });
      else if (command === 'experiment-autopilot') data = await suite.experimentAutopilot({ workspace, action: positionals[0] ?? 'create', goal: options.goal });
      else if (command === 'ai') data = await suite.providerRegistry({ workspace });
      else if (command === 'ai-refactor') data = await suite.refactorPortfolio({ workspace });
      else if (command === 'truth-loop') data = await suite.truthLoop({ workspace, goal: options.goal });
      else if (command === 'autonomy') data = await suite.autonomyReadiness({ workspace });
      else data = await suite.truthfulDemo({ workspace, title: options.title });
    } else if (command === 'radical') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'analyze';
      const { createRadicalBlueprint, createRadicalPortfolio, createShadowModePlan, selectRadicalIdea } = await import('./radical-product.mjs');
      if (action === 'analyze' || action === 'portfolio') data = await createRadicalPortfolio({ workspace, goal: options.goal });
      else if (action === 'select') data = await selectRadicalIdea({ workspace, id: options.id });
      else if (action === 'blueprint') data = await createRadicalBlueprint({ workspace, id: options.id });
      else if (action === 'shadow-mode') data = await createShadowModePlan({ workspace, id: options.id });
      else throw invalidInput('FM_RADICAL_ACTION_INVALID', 'Radical supports analyze, portfolio, select, blueprint, and shadow-mode.');
    } else if (command === 'complete') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const { createCompletionContract, getCompletionContract } = await import('./completion.mjs');
      data = positionals[0] === 'status'
        ? await getCompletionContract({ workspace })
        : await createCompletionContract({ workspace, goal: options.goal, acceptance: splitList(options.acceptance) });
    } else if (command === 'research') {
      const { recordResearch } = await import('./product-ops-lab.mjs');
      data = await recordResearch({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), input: options.input, source: options.source });
    } else if (command === 'finance') {
      const { createFinancialModel } = await import('./product-ops-lab.mjs');
      data = await createFinancialModel({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), options });
    } else if (command === 'telemetry') {
      const { recordTelemetry } = await import('./product-ops-lab.mjs');
      data = await recordTelemetry({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), input: options.input, source: options.source });
    } else if (command === 'discovery-loop') {
      const { runDiscoveryLoop } = await import('./product-ops-lab.mjs');
      data = await runDiscoveryLoop({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal });
    } else if (command === 'portfolio') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      if (positionals[0] === 'plan') {
        const { runPortfolio } = await import('./primary-journeys.mjs');
        data = await runPortfolio({ workspace, goal: options.goal });
      } else {
        const { createPortfolioCockpit } = await import('./product-ops-lab.mjs');
        data = await createPortfolioCockpit({ workspace });
      }
    } else if (command === 'product') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'scan';
      const productOs = await import('./product-os.mjs');
      if (action === 'launch') data = await productOs.launchProductRun({ workspace, goal: options.goal, mode: options.mode });
      else if (action === 'continue' || action === 'status') data = await productOs.continueProductRun({ workspace });
      else if (action === 'scan') data = await productOs.scanProduct({ workspace, goal: options.goal });
      else if (action === 'action') data = await productOs.createAction({ workspace, action: { title: options.title, lane: options.lane, owner: options.owner, hypothesis: options.hypothesis, metric: options.metric, impact: options.impact, confidence: options.confidence, evidence: options.evidence } });
      else if (action === 'measure') data = await productOs.measureAction({ workspace, id: options.id, outcome: options.outcome, evidence: options.evidence });
      else if (action === 'evidence') data = await productOs.evidenceGraph({ workspace });
      else if (action === 'simulate') data = await productOs.simulateRelease({ workspace, goal: options.goal });
      else if (action === 'benchmark') data = await productOs.benchmarkProduct({ workspace });
      else throw invalidInput('FM_PRODUCT_ACTION_INVALID', 'Product supports launch, continue, status, scan, action, measure, evidence, simulate, and benchmark.');
    } else if (command === 'ui-test') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'plan';
      const { planUiTesting, recordPerceptualComparison, runUiTest, stageTestRepair } = await import('./product-ops-lab.mjs');
      if (action === 'plan') data = await planUiTesting({ workspace, url: options.url });
      else if (action === 'run') data = await runUiTest({ workspace, command: options.command, timeoutSeconds: options.timeout });
      else if (action === 'perceptual') data = await recordPerceptualComparison({ workspace, input: options.input, threshold: options.threshold });
      else if (action === 'repair') data = await stageTestRepair({ workspace, failure: options.failure, replacement: options.replacement });
      else throw invalidInput('FM_UI_TEST_ACTION_INVALID', 'UI testing supports plan, run, perceptual, and repair.');
    } else if (command === 'capabilities') {
      const { buildCapabilityManifest } = await import('./capabilities.mjs');
      data = await buildCapabilityManifest({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'compose') {
      const { composeTeam } = await import('./composition.mjs');
      data = await composeTeam({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal, risk: options.risk });
    } else if (command === 'factory') {
      const { createWorkspaceSkill } = await import('./skill-factory.mjs');
      data = await createWorkspaceSkill({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), name: options.name, description: options.description, journey: options.journey });
    } else if (command === 'delegation') {
      const { createDelegationPlan } = await import('./delegation.mjs');
      data = await createDelegationPlan({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal, budget: options.budget });
    } else if (command === 'idea-to-mvp') {
      const { createIdeaToMvpBrief } = await import('./idea-to-mvp.mjs');
      data = await createIdeaToMvpBrief({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()), goal: options.goal });
    } else if (command === 'launch-mvp') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'start';
      const { advanceMvpLaunch, getMvpLaunch, launchMvp } = await import('./mvp-launch.mjs');
      data = action === 'status' ? await getMvpLaunch({ workspace })
        : action === 'advance' ? await advanceMvpLaunch({ workspace, stage: options.stage, evidence: options.evidence })
          : await launchMvp({ workspace, goal: options.goal, audience: options.audience });
    } else if (command === 'testing') {
      const workspace = await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd());
      const action = positionals[0] ?? 'plan';
      const { createMvpTestPlan, evaluateMvpTests, recordMvpTestResult } = await import('./mvp-testing.mjs');
      data = action === 'record' ? await recordMvpTestResult({ workspace, result: { panel: options.panel, outcome: options.outcome, completed: options.completed, critical: options.critical, simulated: options.simulated, evidence: options.evidence, note: options.note } })
        : action === 'evaluate' ? await evaluateMvpTests({ workspace })
          : action === 'plan' ? await createMvpTestPlan({ workspace, goal: options.goal, audience: options.audience })
            : (() => { throw invalidInput('FM_TESTING_ACTION_INVALID', 'Testing supports plan, record, and evaluate.'); })();
    } else if (command === 'dashboard') {
      const { generateDashboard } = await import('./dashboard.mjs');
      data = await generateDashboard({ workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()) });
    } else if (command === 'forge') {
      const { runForge } = await import('./forge/index.mjs');
      data = await runForge({
        workspace: await resolveWorkspace(options.workspace ?? context.cwd ?? process.cwd()),
        positionals,
        options,
      });
    } else if (command === 'eval') {
      const path = await import('node:path');
      const { loadEvalFixtures, runStructuralEvals } = await import('./evals.mjs');
      const pluginRoot = await resolvePluginRoot(options.plugin ?? MODULE_PLUGIN_ROOT);
      const fixturesRoot = path.resolve(options.fixtures ?? path.join(pluginRoot, 'evals', 'fixtures'));
      data = await runStructuralEvals(await loadEvalFixtures(fixturesRoot));
    } else if (command === 'package') {
      const { buildPackages, syncMarketplaceSources } = await import('./package.mjs');
      const pluginRoot = await resolvePluginRoot(options.plugin ?? MODULE_PLUGIN_ROOT);
      data = await buildPackages({ pluginRoot, outputRoot: options.output });
      if (!options.output) data.marketplaceSync = await syncMarketplaceSources({ pluginRoot, marketplacePath: data.marketplacePath });
    } else if (command === 'install') {
      const { installPlugin } = await import('./lifecycle.mjs');
      data = await installPlugin({ packagePath: options.package ?? options.source, home: options.home ?? options.destination ?? await defaultHome(), pluginPath: options['plugin-path'] });
    } else if (command === 'selftest') {
      const { runInstallationSelfTest } = await import('./lifecycle.mjs');
      data = await runInstallationSelfTest({ home: options.home ?? options.destination ?? await defaultHome(), pluginPath: options['plugin-path'] });
    } else if (command === 'uninstall') {
      const { uninstallPlugin } = await import('./lifecycle.mjs');
      data = await uninstallPlugin({
        home: options.home ?? options.destination ?? await defaultHome(),
        pluginPath: options['plugin-path'],
        workspace: options.workspace,
        purgeData: Boolean(options['purge-data']),
        approvedPurge: Boolean(options.approved),
      });
    } else if (command === 'legacy') {
      const { runLegacy } = await import('./legacy.mjs');
      const pluginRoot = await resolvePluginRoot(MODULE_PLUGIN_ROOT);
      data = await runLegacy(positionals[0], positionals.slice(1), { pluginRoot, cwd: context.cwd ?? process.cwd() });
    } else {
      throw invalidInput('FM_COMMAND_UNKNOWN', `Unknown command: ${command}`);
    }

    if (artifactStoreActive && !['status', 'insights'].includes(command)) {
      const { recordCommandOutcome } = await import('./command-metrics.mjs');
      await recordCommandOutcome({ workspace: options.workspace ?? context.cwd ?? process.cwd(), command, status: data.status, durationMs: Date.now() - startedAt });
    }
    data = addArtifactMetadata(data);
    if (options.json) {
      stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    } else {
      stdout.write(`${command}: ${data.status}\n`);
      for (const error of data.errors ?? []) stderr.write(`${error.code}: ${error.message}\n`);
    }
    return { exitCode: isOperationalFailure(data.status) ? 1 : 0, data };
  } catch (error) {
    const normalized = normalizeError(error);
    stderr.write(`${normalized.code}: ${normalized.message}\n`);
    return { exitCode: normalized.exitCode, data: addArtifactMetadata({ error: normalized.code }) };
  } finally {
    if (artifactStoreActive) await deactivateArtifactStore();
  }
}

async function readWorkspaceReport(workspace, name, fallback) {
  try {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    return JSON.parse(await readFile(artifactStatePath(workspace, 'reports', name), 'utf8'));
  } catch {
    return fallback;
  }
}

async function defaultHome() {
  const { homedir } = await import('node:os');
  const path = await import('node:path');
  return process.env.CODEX_HOME ?? path.join(homedir(), '.codex');
}

async function readLatestProof(workspace) {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  return JSON.parse(await readFile(artifactStatePath(workspace, 'evidence', 'latest.json'), 'utf8'));
}

function splitList(value) {
  return value ? String(value).split('|').map((item) => item.trim()).filter(Boolean) : [];
}
function parseJson(value, code) { if (!value) return {}; try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { throw invalidInput(code, '--autonomy must be a JSON object.'); } }
function parseJsonArray(value, code) { if (!value) return []; try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; throw new Error('not array'); } catch { throw invalidInput(code, '--gui-receipts must be a JSON array.'); } }

function parseOptions(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      continue;
    }
    const key = argument.slice(2);
    if (key === 'artifacts') {
      const next = args[index + 1];
      if (['local', 'workspace', 'none'].includes(String(next).toLowerCase())) {
        options[key] = String(next).toLowerCase();
        index += 1;
      } else {
        options[key] = true;
      }
      continue;
    }
    if (['json', 'strict-release', 'memory', 'run', 'allow-inferred', 'non-expiring', 'purge-data', 'approved', 'critical', 'simulated', 'installation'].includes(key)) {
      options[key] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw invalidInput('FM_OPTION_VALUE_MISSING', `Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return { options, positionals };
}

function normalizeError(error) {
  if (error instanceof ForgeMindError) {
    return error;
  }
  return new ForgeMindError('FM_INTERNAL', error instanceof Error ? error.message : String(error));
}

function isOperationalFailure(status) {
  return ['failed', 'blocked', 'rejected', 'invalid', 'held', 'no-eligible-candidate'].includes(status);
}
