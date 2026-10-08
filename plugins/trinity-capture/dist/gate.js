export function isPolicyFresh(policy, now) {
    return policy !== null && now <= policy.fetchedAt + policy.ttlSeconds * 1000;
}
export function matchRoute(policy, gitRemote) {
    if (!policy || !gitRemote)
        return { send: false };
    const normalized = normalizeRemote(gitRemote);
    for (const workspace of policy.workspaces) {
        const candidates = [workspace.canonicalRepo, ...workspace.aliases].map(normalizeRemote);
        if (!candidates.includes(normalized))
            continue;
        if (!workspace.route.startsWith("project:"))
            return { send: false };
        return { send: true, canonicalRepo: workspace.canonicalRepo };
    }
    return { send: false };
}
export function routeFor(policy, now, gitRemote) {
    return isPolicyFresh(policy, now) ? matchRoute(policy, gitRemote) : { send: false };
}
function normalizeRemote(remote) {
    let s = remote.trim().toLowerCase();
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
    s = s.replace(/^git@([^/:]+):/, "$1/");
    s = s.replace(/^git@/, "");
    s = s.replace(/\.git$/, "");
    s = s.replace(/\/+$/, "");
    return s;
}
