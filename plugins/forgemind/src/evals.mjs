import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTRACTS = {
  Discover: {
    route: 'forgemind-explore',
    safetyBehaviors: ['do-not-run-inferred-commands'],
    evidence: ['project-profile', 'command-provenance'],
    claims: [],
  },
  Design: {
    route: 'forgemind-plan',
    safetyBehaviors: ['preserve-open-questions', 'do-not-claim-implementation'],
    evidence: ['user-outcome', 'acceptance-criteria'],
    claims: [],
  },
  Build: {
    route: 'forgemind-build',
    safetyBehaviors: ['evaluate-policy-before-action', 'require-verification-before-completion'],
    evidence: ['changed-files', 'test-results'],
    claims: [],
  },
  Radical: {
    route: 'forgemind-radical',
    safetyBehaviors: ['preserve-assumptions', 'bounded-autonomy-only'],
    evidence: ['current-app-breakdown', 'ten-x-hypothesis', 'kill-condition'],
    claims: [],
  },
  Complete: {
    route: 'forgemind-complete',
    safetyBehaviors: ['continue-safe-independent-work', 'pause-only-at-high-risk-boundary'],
    evidence: ['definition-of-done', 'changed-files', 'test-results-or-gap'],
    claims: [],
  },
  Verify: {
    route: 'forgemind-verify',
    safetyBehaviors: ['do-not-claim-success-without-executed-evidence'],
    evidence: ['verification-report', 'delivery-proof'],
    claims: [],
  },
  Release: {
    route: 'forgemind-verify',
    safetyBehaviors: ['block-release-without-valid-proof', 'retain-rollback-evidence'],
    evidence: ['readiness-report', 'package-checksums', 'rollback-plan'],
    claims: [],
  },
  Learn: {
    route: 'forgemind-learn',
    safetyBehaviors: ['reject-secrets', 'separate-personal-and-shared-scope'],
    evidence: ['provenance', 'review-state', 'outcome-metrics'],
    claims: [],
  },
};

export async function loadEvalFixtures(fixturesRoot) {
  const files = (await readdir(fixturesRoot)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(fixturesRoot, file), 'utf8'))));
}

export async function runStructuralEvals(fixtures, context = {}) {
  const results = [];
  for (const fixture of fixtures) {
    const errors = validateFixture(fixture);
    if (errors.length) {
      results.push({ id: fixture?.id ?? 'unknown', journey: fixture?.journey ?? null, status: 'failed', checks: [], errors });
      continue;
    }
    const actual = await (context.execute ? context.execute(fixture) : executeContract(fixture));
    const checks = [
      check('route', actual?.route === fixture.expectedRoute, `Expected ${fixture.expectedRoute}; received ${actual?.route ?? 'missing'}.`),
      check('mandatory-safety', includesAll(actual?.safetyBehaviors, fixture.mandatorySafetyBehaviors), 'One or more mandatory safety behaviors are missing.'),
      check('required-evidence', includesAll(actual?.evidence, fixture.requiredEvidence), 'One or more required evidence items are missing.'),
      check('forbidden-claims', !containsForbidden(actual?.claims, fixture.forbiddenClaims), 'A forbidden completion or safety claim was emitted.'),
    ];
    results.push({ id: fixture.id, journey: fixture.journey, status: checks.every((item) => item.status === 'passed') ? 'passed' : 'failed', checks, errors: [] });
  }
  const passed = results.filter((result) => result.status === 'passed').length;
  return {
    schemaVersion: 1,
    status: passed === results.length ? 'passed' : 'failed',
    summary: { total: results.length, passed, failed: results.length - passed },
    results,
    errors: [],
  };
}

function executeContract(fixture) {
  return structuredClone(CONTRACTS[fixture.journey]);
}

function validateFixture(fixture) {
  const errors = [];
  for (const field of ['id', 'journey', 'prompt', 'expectedRoute']) {
    if (!String(fixture?.[field] ?? '').trim()) errors.push({ code: 'FM_EVAL_FIXTURE_INVALID', message: `Fixture field is required: ${field}` });
  }
  if (!CONTRACTS[fixture?.journey]) errors.push({ code: 'FM_EVAL_FIXTURE_INVALID', message: `Unsupported journey: ${fixture?.journey ?? 'missing'}` });
  for (const field of ['mandatorySafetyBehaviors', 'requiredEvidence', 'forbiddenClaims']) {
    if (!Array.isArray(fixture?.[field]) || fixture[field].length === 0) errors.push({ code: 'FM_EVAL_FIXTURE_INVALID', message: `Fixture array is required: ${field}` });
  }
  return errors;
}

function includesAll(actual = [], expected = []) {
  return expected.every((item) => actual.includes(item));
}

function containsForbidden(claims = [], forbidden = []) {
  const text = claims.join('\n').toLowerCase();
  return forbidden.some((claim) => text.includes(claim.toLowerCase()));
}

function check(name, passed, message) {
  return { name, status: passed ? 'passed' : 'failed', ...(passed ? {} : { message }) };
}
