import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { toToolkitError } from "./errors.js";
export function createResultContext(command, requestId = randomUUID()) {
    return {
        command,
        requestId,
        startedAt: new Date().toISOString(),
        startedMonotonicMs: performance.now(),
    };
}
function executionSummary(execution) {
    return {
        binary: execution.binary,
        args: [...execution.args],
        ...(execution.cwd !== undefined ? { cwd: execution.cwd } : {}),
        exitCode: execution.exitCode,
        ...(execution.signal !== undefined ? { signal: execution.signal } : {}),
        executed: execution.executed,
        stdoutTruncated: execution.stdoutTruncated,
        stderrTruncated: execution.stderrTruncated,
    };
}
function timing(context) {
    return {
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, performance.now() - context.startedMonotonicMs),
    };
}
export function createSuccessEnvelope(context, data, options = {}) {
    return {
        schemaVersion: "1.0",
        ok: true,
        command: context.command,
        requestId: context.requestId,
        startedAt: context.startedAt,
        ...timing(context),
        data,
        warnings: [...(options.warnings ?? [])],
        error: null,
        ...(options.execution !== undefined ? { execution: executionSummary(options.execution) } : {}),
        ...(options.progress !== undefined ? { progress: options.progress } : {}),
    };
}
export function createFailureEnvelope(context, error, options = {}) {
    return {
        schemaVersion: "1.0",
        ok: false,
        command: context.command,
        requestId: context.requestId,
        startedAt: context.startedAt,
        ...timing(context),
        warnings: [...(options.warnings ?? [])],
        error: toToolkitError(error),
        ...(options.execution !== undefined ? { execution: executionSummary(options.execution) } : {}),
        ...(options.progress !== undefined ? { progress: options.progress } : {}),
    };
}
//# sourceMappingURL=result-envelope.js.map