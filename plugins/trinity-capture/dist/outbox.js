import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BatchRequestError, refreshPolicy, sendBatch } from "./send.js";
const MAX_BATCHES = 5;
export const INLINE_DRAIN_BUDGET_MS = 2_000;
const MAX_EVENTS_PER_BATCH = 100;
const MAX_EVENT_BYTES = 256 * 1024;
const MAX_BATCH_BYTES = 3 * 1024 * 1024;
const MAX_RETRY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OUTBOX_EVENTS = 2_000;
const MAX_OUTBOX_BYTES = 16 * 1024 * 1024;
const MAX_DROP_RECORDS = 100;
function outboxDir(dataDir) {
    const dir = join(dataDir, "outbox");
    mkdirSync(dir, { recursive: true });
    return dir;
}
function fileFor(dir, ev) {
    const stamp = ev.occurredAt.replace(/[^0-9]/g, "");
    return join(dir, `${stamp}-${ev.captureEventId}.jsonl`);
}
function isAlreadyQueued(err) {
    return err instanceof Error && "code" in err && err.code === "EEXIST";
}
export function recordDrop(dataDir, drop) {
    const path = join(dataDir, "status.json");
    let drops = [];
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (typeof parsed === "object" && parsed !== null && "drops" in parsed && Array.isArray(parsed.drops)) {
            drops = parsed.drops;
        }
    }
    catch (err) {
        if (!(err instanceof Error))
            throw err;
    }
    drops.push({ at: new Date().toISOString(), ...drop });
    try {
        writeFileSync(path, JSON.stringify({ drops: drops.slice(-MAX_DROP_RECORDS) }, null, 2));
    }
    catch (err) {
        if (!(err instanceof Error))
            throw err;
    }
}
function enforceOutboxLimit(dataDir, dir) {
    const entries = [];
    let totalBytes = 0;
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".jsonl")).sort()) {
        try {
            const bytes = statSync(join(dir, file)).size;
            entries.push({ file, bytes });
            totalBytes += bytes;
        }
        catch (err) {
            if (!(err instanceof Error))
                throw err;
        }
    }
    while (entries.length > MAX_OUTBOX_EVENTS || totalBytes > MAX_OUTBOX_BYTES) {
        const oldest = entries.shift();
        if (!oldest)
            return;
        const path = join(dir, oldest.file);
        let event = null;
        try {
            event = JSON.parse(readFileSync(path, "utf8"));
        }
        catch (err) {
            if (!(err instanceof Error))
                throw err;
        }
        rmSync(path, { force: true });
        totalBytes -= oldest.bytes;
        if (event) {
            recordDrop(dataDir, { reason: "capacity", captureEventId: event.captureEventId, kind: event.kind });
        }
    }
}
export function appendEvent(dataDir, ev) {
    const line = JSON.stringify(ev) + "\n";
    if (Buffer.byteLength(line, "utf8") > MAX_EVENT_BYTES) {
        recordDrop(dataDir, { reason: "oversized", captureEventId: ev.captureEventId, kind: ev.kind });
        return;
    }
    const dir = outboxDir(dataDir);
    try {
        writeFileSync(fileFor(dir, ev), line, { flag: "wx" });
    }
    catch (err) {
        if (isAlreadyQueued(err))
            return;
        throw err;
    }
    enforceOutboxLimit(dataDir, dir);
}
export async function drain(dataDir, cfg, options = { inline: false, deadline: 0 }) {
    if (options.inline && Date.now() >= options.deadline)
        return;
    const dir = outboxDir(dataDir);
    const entries = [];
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".jsonl")).sort()) {
        const path = join(dir, file);
        let raw;
        let mtimeMs;
        try {
            mtimeMs = statSync(path).mtimeMs;
            raw = readFileSync(path, "utf8").trim();
        }
        catch (err) {
            if (!(err instanceof Error))
                throw err;
            continue;
        }
        let event;
        try {
            event = JSON.parse(raw);
        }
        catch (err) {
            if (!(err instanceof SyntaxError))
                throw err;
            rmSync(path, { force: true });
            continue;
        }
        if (Date.now() - mtimeMs > MAX_RETRY_AGE_MS) {
            rmSync(path, { force: true });
            recordDrop(dataDir, { reason: "expired", captureEventId: event.captureEventId, kind: event.kind });
            continue;
        }
        entries.push({ file, bytes: Buffer.byteLength(raw, "utf8"), event });
    }
    let offset = 0;
    let policyStale = false;
    const maxBatches = options.inline ? 1 : MAX_BATCHES;
    for (let batch = 0; batch < maxBatches && offset < entries.length; batch++) {
        const slice = [];
        let sliceBytes = 0;
        while (offset < entries.length && slice.length < MAX_EVENTS_PER_BATCH) {
            const next = entries[offset];
            if (slice.length > 0 && sliceBytes + next.bytes > MAX_BATCH_BYTES)
                break;
            slice.push(next);
            sliceBytes += next.bytes;
            offset++;
        }
        const outcome = await deliverBatch(dir, dataDir, cfg, slice, options);
        if (outcome === "abort")
            break;
        if (outcome.policyStale)
            policyStale = true;
    }
    if (policyStale && !options.inline) {
        try {
            await refreshPolicy(dataDir, cfg);
        }
        catch (err) {
            if (!(err instanceof Error))
                throw err;
        }
    }
}
async function deliverBatch(dir, dataDir, cfg, entries, options) {
    let results;
    try {
        const remaining = options.inline ? options.deadline - Date.now() : undefined;
        if (remaining !== undefined && remaining <= 0)
            return "abort";
        results = await sendBatch(cfg, entries.map((e) => e.event), remaining);
    }
    catch (err) {
        if (err instanceof BatchRequestError && err.status === 413) {
            if (entries.length === 1) {
                rmSync(join(dir, entries[0].file), { force: true });
                recordDrop(dataDir, { reason: "poison", captureEventId: entries[0].event.captureEventId, kind: entries[0].event.kind });
                return { policyStale: false };
            }
            const mid = Math.ceil(entries.length / 2);
            const left = await deliverBatch(dir, dataDir, cfg, entries.slice(0, mid), options);
            if (left === "abort")
                return "abort";
            const right = await deliverBatch(dir, dataDir, cfg, entries.slice(mid), options);
            if (right === "abort")
                return "abort";
            return { policyStale: left.policyStale || right.policyStale };
        }
        return "abort";
    }
    const resultById = new Map(results.map((r) => [r.captureEventId, r]));
    let policyStale = false;
    for (const { file, event } of entries) {
        const result = resultById.get(event.captureEventId);
        if (result === undefined)
            continue;
        if (result.outcome === "stored" || result.outcome === "duplicate" || result.outcome === "rejected_permanent") {
            rmSync(join(dir, file), { force: true });
        }
        else if (result.outcome === "retry_later" && result.code === "policy_stale") {
            policyStale = true;
        }
    }
    return { policyStale };
}
