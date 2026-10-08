import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function createMarketIntelligence({ workspace, projectProfile, financialModel }) {
  const root = await resolveWorkspace(workspace);
  const [config, research, telemetry, outcomes] = await Promise.all([readConfig(root), readJson(artifactStatePath(root, 'product-ops', 'research-latest.json')), readJson(artifactStatePath(root, 'product-ops', 'telemetry-latest.json')), readJson(artifactStatePath(root, 'outcomes', 'outcomes.jsonl'))]);
  const settings = config?.marketIntelligence ?? {};
  const sources = (research?.records ?? []).map(rankSource);
  const category = projectProfile.productCategory.value;
  const reachable = numeric(settings.reachableAccounts, projectProfile.commercialAssumptions.addressableAccounts.value);
  const reachableEvidence = Number.isFinite(Number(settings.reachableAccounts)) ? 'observed' : projectProfile.commercialAssumptions.addressableAccounts.evidence;
  const price = financialModel.assumptions.monthlyPrice;
  const competitors = (settings.competitors ?? []).map((item) => ({ name: String(item.name ?? 'unnamed alternative'), segment: String(item.segment ?? projectProfile.targetAudience.value), pricing: String(item.pricing ?? 'unknown'), workflow: String(item.workflow ?? 'unknown'), aiDepth: String(item.aiDepth ?? 'unknown'), differentiationGap: String(item.differentiationGap ?? 'validate against target workflow'), evidence: item.source ? 'observed' : 'assumption', sources: item.source ? [String(item.source)] : ['no competitor source supplied'] }));
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(),
    sources, sourceCoverage: { primary: sources.filter((item) => item.rank === 'primary').length, secondary: sources.filter((item) => item.rank === 'secondary').length, telemetryEvents: telemetry?.events?.length ?? 0, outcomeRecords: Array.isArray(outcomes) ? outcomes.length : 0 },
    competitors,
    marketSizing: { method: 'bottom-up-reachable-account-model', reachableAccounts: field(reachable, reachableEvidence, Number.isFinite(Number(settings.reachableAccounts)) ? ['forgemind.config.json#marketIntelligence.reachableAccounts'] : projectProfile.commercialAssumptions.addressableAccounts.sources), serviceableRevenueAtOnePercent: field(round(reachable * 0.01 * price * 12), 'assumption', ['1% penetration is a scenario variable, not a market fact']), formula: 'reachableAccounts × penetration × monthlyPrice × 12' },
    willingnessToPay: { valueDriver: category === 'commerce-platform' ? 'checkout setup effort and conversion workflow reliability' : `${projectProfile.primaryJob.value} and avoided manual effort`, buyer: buyer(category), pricingHypothesis: field(`${price} monthly price hypothesis`, financialModel.assumptionSources.monthlyPrice.evidence, financialModel.assumptionSources.monthlyPrice.inputs ?? [financialModel.assumptionSources.monthlyPrice.input]), validation: 'Run a price-sensitive concept test with qualified buyers; do not infer willingness to pay from repository context.' },
    buyerJourney: { economicBuyer: buyer(category), champion: projectProfile.targetAudience.value, user: projectProfile.targetAudience.value, procurement: category === 'enterprise-operations' || category === 'learning-platform' ? 'security, procurement, and data review are possible assumptions' : 'unknown until qualified buyer discovery', salesCycle: field(financialModel.assumptions.salesCycleMonths, financialModel.assumptionSources.salesCycleMonths.evidence, financialModel.assumptionSources.salesCycleMonths.inputs ?? []) },
    region: field(String(settings.region ?? 'unspecified'), settings.region ? 'observed' : 'missing', settings.region ? ['forgemind.config.json#marketIntelligence.region'] : ['no region configured']),
    sensitivity: sensitivity(financialModel.assumptions),
    marketMemory: { researchRecordIds: sources.map((item) => item.id), telemetryEvents: telemetry?.events?.length ?? 0, outcomes: Array.isArray(outcomes) ? outcomes.length : 0, rule: 'Future Venture runs must retain sources and update only the assumptions changed by newer project-local evidence.' },
    nextExperiments: experiments(projectProfile, financialModel),
    claimBoundary: 'Market sizing, competitor gaps, pricing, buyer, and sensitivity outputs are evidence-labelled scenarios, not market facts or forecasts.',
    artifactPath: '.codex-orchestrator/market-intelligence/latest.json', errors: [],
  };
  await writeJsonAtomic(artifactStatePath(root, 'market-intelligence', 'latest.json'), result);
  return result;
}

function rankSource(record) { const rank = record.evidenceType === 'primary' || /interview|customer|sales call/i.test(record.source ?? '') ? 'primary' : record.evidenceType ? 'secondary' : 'unranked'; return { id: record.id, title: record.title, url: record.url, claim: record.claim, rank, confidence: record.confidence, recency: record.publishedAt ?? null, limitations: record.limitations ?? [] }; }
function buyer(category) { return ({ 'commerce-platform': 'merchant owner or commerce lead', 'learning-platform': 'training or enablement leader', 'enterprise-operations': 'service operations leader', 'creator-saas': 'individual creator', 'developer-tools': 'engineering leader', 'b2b-software': 'business workflow owner' })[category] ?? 'unknown buyer'; }
function sensitivity(a) { const drivers = [['monthlyPrice', a.monthlyPrice], ['customerAcquisitionCost', a.customerAcquisitionCost], ['monthlyChurnPercent', a.monthlyChurnPercent], ['monthlyNewCustomers', a.monthlyNewCustomers]].map(([key, value]) => ({ key, low: round(value * 0.7), base: value, high: round(value * 1.3) })); return { method: 'deterministic-parameter-sweep', drivers, decisionRule: 'Validate the highest-impact uncertain driver before expanding scope or spend.' }; }
function experiments(profile, financial) { return [
  { question: 'Which qualified buyer has the sharpest recurring problem?', decisionValue: 'high', metric: 'problem confirmation and workflow baseline', killCondition: 'No qualified participant confirms the problem as material.' },
  { question: `Will the target buyer consider the ${financial.assumptions.monthlyPrice} monthly price hypothesis?`, decisionValue: 'high', metric: 'price-sensitive purchase intent', killCondition: 'No credible willingness-to-pay signal at the hypothesis price.' },
  { question: `Can ${profile.primaryJob.value} improve with the thin slice?`, decisionValue: 'high', metric: 'time-to-outcome and independent completion', killCondition: 'No measurable improvement against the current alternative.' },
]; }
function field(value, evidence, sources) { return { value, evidence, sources }; }
function numeric(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; }
function round(value) { return Math.round(value * 100) / 100; }
async function readJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
async function readConfig(root) { for (const name of ['forgemind.config.json', '.forgemind.json']) { const result = await readJson(path.join(root, name)); if (result) return result; } return null; }
