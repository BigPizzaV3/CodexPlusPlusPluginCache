import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { listOutcomes } from './outcomes.mjs';
import { resolveWorkspace } from './paths.mjs';
import { listSignals } from './signals.mjs';

const PROFILE_CONFIGS = ['forgemind.config.json', '.forgemind.json'];
const COMMERCIAL = {
  'enterprise-operations': { addressableAccounts: 300, monthlyPrice: 1500, grossMarginPercent: 70, monthlyChurnPercent: 1.5, customerAcquisitionCost: 2200, salesCycleMonths: 6, buildCost: 60000, monthlyRunCost: 4500, monthlyNewCustomers: 2, startingCustomers: 0 },
  'creator-saas': { addressableAccounts: 5000, monthlyPrice: 29, grossMarginPercent: 68, monthlyChurnPercent: 6, customerAcquisitionCost: 45, salesCycleMonths: 0.5, buildCost: 25000, monthlyRunCost: 3000, monthlyNewCustomers: 30, startingCustomers: 0 },
  'commerce-platform': { addressableAccounts: 2500, monthlyPrice: 89, grossMarginPercent: 72, monthlyChurnPercent: 4, customerAcquisitionCost: 120, salesCycleMonths: 1, buildCost: 30000, monthlyRunCost: 2800, monthlyNewCustomers: 16, startingCustomers: 0 },
  'learning-platform': { addressableAccounts: 600, monthlyPrice: 650, grossMarginPercent: 74, monthlyChurnPercent: 2.5, customerAcquisitionCost: 900, salesCycleMonths: 3, buildCost: 42000, monthlyRunCost: 3500, monthlyNewCustomers: 4, startingCustomers: 0 },
  'developer-tools': { addressableAccounts: 1500, monthlyPrice: 79, grossMarginPercent: 78, monthlyChurnPercent: 3, customerAcquisitionCost: 250, salesCycleMonths: 1, buildCost: 35000, monthlyRunCost: 1800, monthlyNewCustomers: 8, startingCustomers: 0 },
  'b2b-software': { addressableAccounts: 1000, monthlyPrice: 50, grossMarginPercent: 75, monthlyChurnPercent: 3, customerAcquisitionCost: 400, salesCycleMonths: 2, buildCost: 25000, monthlyRunCost: 1500, monthlyNewCustomers: 8, startingCustomers: 0 },
};

export async function deriveProjectProfile({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const [pkg, readme, documents, sources, config, signals, research, telemetry, outcomes] = await Promise.all([
    readJson(path.join(root, 'package.json')), readText(path.join(root, 'README.md')), readDocs(path.join(root, 'docs', 'forgemind')), readSourceSignals(root), readConfig(root), listSignals({ workspace: root }), readJson(artifactStatePath(root, 'product-ops', 'research-latest.json')), readJson(artifactStatePath(root, 'product-ops', 'telemetry-latest.json')), listOutcomes({ workspace: root }),
  ]);
  // Historical ForgeMind reports often contain examples of other products. They
  // are useful context but must never decide what the current repository is.
  const corpus = `${pkg ? JSON.stringify(pkg) : ''}\n${readme}\n${sources.join('\n')}`.toLowerCase();
  const category = configuredCategory(config?.value?.projectProfile?.productCategory, corpus);
  const categorySources = category.matches.length ? category.matches : ['no category-specific project signal'];
  const deployment = deriveDeployment(corpus, pkg);
  const integrations = integrationSignals(pkg, corpus);
  const importedCommercial = commercialEvidence(research, telemetry);
  const commercial = Object.fromEntries(Object.entries(COMMERCIAL[category.value]).map(([key, fallback]) => {
    const imported = importedCommercial.values[key];
    const configured = config?.value?.commercial?.[key];
    if (Number.isFinite(Number(imported))) return [key, { value: Number(imported), evidence: 'observed', sources: importedCommercial.sources[key] }];
    if (Number.isFinite(Number(configured))) return [key, { value: Number(configured), evidence: 'observed', sources: [config.source] }];
    return [key, { value: fallback, evidence: category.evidence, sources: categorySources }];
  }));
  const field = (value, evidence, sources) => ({ value, evidence, sources });
  const profile = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), workspace: root,
    productCategory: field(category.value, category.evidence, categorySources),
    targetAudience: field(config?.value?.projectProfile?.targetAudience ?? audience(category.value), config?.value?.projectProfile?.targetAudience ? 'observed' : category.evidence, config?.value?.projectProfile?.targetAudience ? [config.source] : categorySources),
    primaryJob: field(config?.value?.projectProfile?.primaryJob ?? job(category.value), config?.value?.projectProfile?.primaryJob ? 'observed' : category.evidence, config?.value?.projectProfile?.primaryJob ? [config.source] : categorySources),
    deploymentModel: field(deployment.value, deployment.evidence, deployment.sources),
    differentiationApproach: field(differentiation(category.value, integrations), category.evidence, categorySources),
    technicalCostSignals: integrations.map((signal) => field(signal.value, 'observed', [signal.source])),
    commercialAssumptions: commercial,
    evidenceSummary: { importedSignals: signals.length, researchRecords: research?.records?.length ?? 0, telemetryEvents: telemetry?.events?.length ?? 0, outcomes: outcomes.length, projectDocuments: documents.length, sourceSignals: sources.length, packagePresent: Boolean(pkg), readmePresent: Boolean(readme) },
    evidenceGaps: gaps(category, deployment, signals.length + (research?.records?.length ?? 0) + (telemetry?.events?.length ?? 0) + outcomes.length, config?.value, importedCommercial),
    claimBoundary: 'Project-derived fields describe repository context. They are inferred or assumed until customer, market, pricing, or operating evidence is imported.',
    artifactPath: '.codex-orchestrator/project-profile.json', errors: [],
  };
  await writeJsonAtomic(artifactStatePath(root, 'project-profile.json'), profile);
  return profile;
}

export function deriveVentureContext(profile) {
  const contexts = {
    'enterprise-operations': { targetSegment: 'service operations teams with incident-management workflows', alternatives: 'manual triage and existing ITSM routing workflows', pricingHypothesis: 'enterprise workspace subscription with implementation scope validated separately', goToMarket: 'recruit a small set of qualified operations design partners through existing enterprise channels', validationPlan: 'test incident-resolution workflow completion, approval rate, and willingness to pilot with qualified operators' },
    'creator-saas': { targetSegment: 'independent creators producing repeatable video content', alternatives: 'manual editing workflows and general-purpose creation tools', pricingHypothesis: 'self-serve creator subscription tested against a limited free-to-paid conversion path', goToMarket: 'recruit creators through focused content communities and product-led trials', validationPlan: 'test time-to-publish, repeat use, and conversion intent with qualified creators' },
    'commerce-platform': { targetSegment: 'independent merchants operating online storefronts', alternatives: 'manual storefront configuration and existing commerce platforms', pricingHypothesis: 'merchant subscription or transaction-adjacent plan validated separately', goToMarket: 'recruit a focused merchant cohort through commerce communities and platform partners', validationPlan: 'test checkout setup time, repeat merchant use, and willingness to pay with qualified merchants' },
    'learning-platform': { targetSegment: 'training and enablement teams managing internal learning programs', alternatives: 'manual course coordination and existing learning-management workflows', pricingHypothesis: 'team or organization subscription validated with a bounded learning-program pilot', goToMarket: 'recruit training leaders as design partners through enablement communities', validationPlan: 'test program setup time, learner completion, and team purchase intent with qualified users' },
    'developer-tools': { targetSegment: 'software development teams maintaining active codebases', alternatives: 'manual engineering workflows and general-purpose developer tooling', pricingHypothesis: 'team subscription validated with a bounded developer trial', goToMarket: 'recruit developer design partners from repositories and technical communities', validationPlan: 'test verified delivery time, repeat adoption, and team purchase intent' },
    'b2b-software': { targetSegment: 'business teams with a recurring workflow', alternatives: 'manual work and existing workflow software', pricingHypothesis: 'subscription pricing to be tested with qualified users', goToMarket: 'recruit a narrow user cohort before scaling distribution', validationPlan: 'test task completion, repeat use, and willingness to pay with qualified users' },
  };
  const context = contexts[profile.productCategory.value] ?? contexts['b2b-software'];
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, { value, evidence: profile.productCategory.evidence === 'missing' ? 'assumption' : 'inferred', sources: profile.productCategory.sources }]));
}

function classify(corpus) {
  const patterns = [
    ['commerce-platform', /checkout|storefront|merchant|e-?commerce|cart|payment|order/g],
    ['learning-platform', /learning|training|course|lesson|education|curriculum|learner/g],
    ['enterprise-operations', /incident|service ?desk|itsm|servicenow|microsoft graph|enterprise operations/g],
    ['creator-saas', /creator|video|stripe|self-serve|subscription|studio/g],
    ['developer-tools', /developer|cli|github|repository|sdk|api platform/g],
  ];
  for (const [value, pattern] of patterns) { const matches = [...corpus.matchAll(pattern)].map((item) => item[0]); if (matches.length) return { value, evidence: 'inferred', matches: [...new Set(matches)].slice(0, 5) }; }
  return { value: 'b2b-software', evidence: 'assumption', matches: ['generic fallback; no category-specific signal'] };
}
function configuredCategory(value, corpus) { const configured = String(value ?? '').trim(); return configured && COMMERCIAL[configured] ? { value: configured, evidence: 'observed', matches: ['project profile configuration'] } : classify(corpus); }
function audience(category) { return ({ 'enterprise-operations': 'service operations teams', 'creator-saas': 'independent creators', 'commerce-platform': 'independent online merchants', 'learning-platform': 'training and enablement teams', 'developer-tools': 'software development teams', 'b2b-software': 'business teams' })[category]; }
function job(category) { return ({ 'enterprise-operations': 'resolve operational incidents faster', 'creator-saas': 'produce publishable media faster', 'commerce-platform': 'operate merchant checkout and storefront workflows with less effort', 'learning-platform': 'create, assign, and measure learning programs with less manual coordination', 'developer-tools': 'ship and maintain software with less friction', 'b2b-software': 'complete a recurring business workflow with less effort' })[category]; }
function differentiation(category, integrations) { return integrations.length ? `${category} workflow with existing integration context` : `${category} workflow automation hypothesis`; }
function deriveDeployment(corpus, pkg) { if (/private cloud|self-host|on-prem|azure/.test(corpus)) return { value: 'private-or-enterprise-cloud', evidence: 'inferred', sources: ['project documentation or dependency signal'] }; if (pkg?.dependencies?.next || /web app|saas|stripe/.test(corpus)) return { value: 'hosted-web-application', evidence: 'inferred', sources: ['package.json or project documentation'] }; return { value: 'unknown', evidence: 'missing', sources: ['no deployment signal'] }; }
function integrationSignals(pkg, corpus) { const manifest = pkg ?? {}; const deps = Object.keys({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }).join(' ').toLowerCase(); const text = `${deps} ${corpus}`; return [ ['ai-inference', /openai|azure.*openai/, 'AI inference dependency or documentation'], ['enterprise-integration', /servicenow|microsoft-graph|teams/, 'enterprise integration dependency or documentation'], ['payments', /stripe/, 'payment integration dependency'] ].filter(([, pattern]) => pattern.test(text)).map(([value,, source]) => ({ value, source })); }
function gaps(category, deployment, signalCount, config, importedCommercial) { return [ category.evidence !== 'observed' && 'customer segment is inferred from repository context; validate with qualified users', !signalCount && 'no imported customer or behavioral signals', !Object.keys(importedCommercial.values).length && 'no structured commercial evidence was imported from research or telemetry', !config?.commercial && 'pricing, market size, CAC, churn, and cost values are project-derived assumptions', deployment.evidence === 'missing' && 'deployment model is unknown; validate operating cost assumptions' ].filter(Boolean); }
function commercialEvidence(research, telemetry) { const values = {}; const sources = {}; const accept = (candidate, source) => { for (const [key, value] of Object.entries(candidate ?? {})) if (key in COMMERCIAL['b2b-software'] && Number.isFinite(Number(value))) { values[key] = Number(value); sources[key] = [source]; } }; for (const record of research?.records ?? []) accept(record.commercial, `research:${record.id}`); for (const event of telemetry?.events ?? []) accept(event.properties?.forgemindCommercial, `telemetry:${event.id}`); return { values, sources }; }
async function readJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
async function readText(file) { try { return (await readFile(file, 'utf8')).slice(0, 20000); } catch { return ''; } }
async function readDocs(root) { try { const generated = new Set(['venture-case.md', 'financial-model.md', 'market-opportunity.md', 'project-profile.md', 'evolution-brief.md', 'council-decision.md', 'leap-decision.md', 'product-bet.md', 'release-readiness.md', 'traceability.md']); const names = await readdir(root, { withFileTypes: true }); const files = names.filter((item) => item.isFile() && item.name.endsWith('.md') && !generated.has(item.name)).slice(0, 20); return Promise.all(files.map((item) => readText(path.join(root, item.name)))); } catch { return []; } }
async function readSourceSignals(root) { return walkSourceSignals(root, path.join(root, 'src'), []); }
async function walkSourceSignals(root, directory, collected) { try { const names = await readdir(directory, { withFileTypes: true }); for (const item of names) { if (collected.length >= 60 || ['node_modules', '.git', 'dist', '.codex-orchestrator'].includes(item.name)) continue; const full = path.join(directory, item.name); if (item.isDirectory()) await walkSourceSignals(root, full, collected); else if (item.isFile() && /\.(?:[cm]?[jt]sx?|py|cs)$/i.test(item.name)) collected.push(path.relative(root, full).replaceAll(path.sep, '/')); } return collected; } catch { return collected; } }
async function readConfig(root) { for (const name of PROFILE_CONFIGS) { const value = await readJson(path.join(root, name)); if (value) return { value, source: name }; } const pkg = await readJson(path.join(root, 'package.json')); return pkg?.forgemind ? { value: pkg.forgemind, source: 'package.json#forgemind' } : null; }
