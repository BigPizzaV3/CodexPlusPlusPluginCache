import { loadPolicy, savePolicy } from "./config.js";
export const REQUEST_TIMEOUT_MS = 5_000;
export class BatchRequestError extends Error {
    status;
    constructor(status) {
        super(`ingest batch failed: ${status}`);
        this.status = status;
    }
}
export async function sendBatch(cfg, events, timeoutMs = REQUEST_TIMEOUT_MS) {
    const res = await fetch(cfg.ingestUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${cfg.token}`,
            "Content-Type": "application/json",
            "X-Trinity-Wire-Version": "1",
        },
        body: JSON.stringify({ items: events }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok)
        throw new BatchRequestError(res.status);
    const body = (await res.json());
    return body.results;
}
export async function refreshPolicy(dataDir, cfg, timeoutMs = REQUEST_TIMEOUT_MS) {
    const current = loadPolicy(dataDir);
    const policyUrl = cfg.ingestUrl.replace(/\/batches$/, "/policy");
    const headers = { Authorization: `Bearer ${cfg.token}` };
    if (current)
        headers["If-None-Match"] = current.etag;
    const res = await fetch(policyUrl, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 304 && current) {
        const refreshed = { ...current, fetchedAt: Date.now() };
        savePolicy(dataDir, refreshed);
        return refreshed;
    }
    if (!res.ok)
        return current;
    const doc = (await res.json());
    const policy = { ...doc, fetchedAt: Date.now() };
    savePolicy(dataDir, policy);
    return policy;
}
