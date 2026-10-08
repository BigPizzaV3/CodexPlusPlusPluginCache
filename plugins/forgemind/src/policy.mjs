import path from 'node:path';

const EFFECT_RANK = { allow: 0, approval: 1, deny: 2 };

export const DEFAULT_POLICY = Object.freeze({
  actions: {
    read: 'allow',
    write: 'allow',
    command: 'allow',
    destructive: 'approval',
    deployment: 'approval',
    migration: 'approval',
    network: 'approval',
    cost: 'approval',
  },
  protectedPaths: ['.git/', '.env', '.forgemind.local.json'],
});

export function mergePolicies(defaults = DEFAULT_POLICY, shared = {}, personal = {}, options = {}) {
  const policy = {
    actions: { ...(defaults.actions ?? {}) },
    protectedPaths: [...new Set(defaults.protectedPaths ?? [])],
  };
  const sources = Object.fromEntries(Object.keys(policy.actions).map((key) => [`actions.${key}`, 'default']));
  const rejections = [];
  applyLayer(policy, sources, shared, 'shared', true, rejections, options);
  applyLayer(policy, sources, personal, 'personal', false, rejections, options);
  Object.defineProperty(policy, '_sources', { value: sources, enumerable: false });
  return { policy, rejections };
}

export function evaluateAction(policy, action) {
  const normalizedPath = action.path?.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalizedPath && (policy.protectedPaths ?? []).some((entry) => isProtected(entry, normalizedPath))) {
    return { decision: 'deny', source: 'protectedPaths', rationale: `Protected path cannot be modified: ${normalizedPath}` };
  }
  const effect = policy.actions?.[action.kind] ?? policy.actions?.command ?? 'approval';
  const layer = policy._sources?.[`actions.${action.kind}`] ?? 'default';
  const owner = layer === 'shared' ? 'Team policy' : layer === 'personal' ? 'Personal policy' : 'Secure default policy';
  const verb = effect === 'deny' ? 'denies' : effect === 'approval' ? 'requires approval for' : 'allows';
  return { decision: effect, source: `actions.${action.kind}`, rationale: `${owner} ${verb} ${action.kind}.` };
}

export function evaluateMissionGrant({ policy, grant, action, now = new Date() }) {
  if (!grant || grant.missionId !== action.missionId) return { decision: 'deny', source: 'grant', rationale: 'A matching mission grant is required.' };
  if (!grant.expiresAt || new Date(grant.expiresAt) <= now) return { decision: 'deny', source: 'grant', rationale: 'Grant is absent or expired.' };
  if (!Array.isArray(grant.operations) || !grant.operations.includes(action.operation)) return { decision: 'deny', source: 'grant', rationale: 'Grant does not allow this operation.' };
  if (Number.isInteger(grant.maxActions) && grant.maxActions < 1) return { decision: 'deny', source: 'grant', rationale: 'Grant action budget is exhausted.' };
  const policyDecision = evaluateAction(policy, action);
  return policyDecision.decision === 'allow' ? { decision: 'allow', source: 'grant', rationale: 'Policy and scoped grant allow this action.' } : policyDecision;
}

function applyLayer(policy, sources, layer, source, canReplace, rejections, options) {
  for (const [kind, requested] of Object.entries(layer.actions ?? {})) {
    if (!Object.hasOwn(EFFECT_RANK, requested)) continue;
    const retained = policy.actions[kind] ?? 'allow';
    const weakens = EFFECT_RANK[requested] < EFFECT_RANK[retained];
    if (weakens && !canReplace && !options.approvedWeakening) {
      rejections.push({ path: `actions.${kind}`, requested, retained });
      continue;
    }
    if (canReplace || EFFECT_RANK[requested] >= EFFECT_RANK[retained] || options.approvedWeakening) {
      policy.actions[kind] = requested;
      sources[`actions.${kind}`] = source;
    }
  }
  policy.protectedPaths = [...new Set([...policy.protectedPaths, ...(layer.protectedPaths ?? [])])];
}

function isProtected(entry, candidate) {
  const normalized = entry.replaceAll('\\', '/').replace(/^\.\//, '');
  return candidate === normalized.replace(/\/$/, '') || candidate.startsWith(normalized.endsWith('/') ? normalized : `${normalized}/`);
}
