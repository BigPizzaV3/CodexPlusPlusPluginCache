import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createProcessSignalController } from "../core/cancellation.js";
import { exitCodeForError, isToolkitRuntimeError, ToolkitRuntimeError } from "../core/errors.js";
import { contextGuidance, getExecutionContext } from "./context.js";
import { SKILL_SCRIPT_SCHEMA_VERSION, } from "./types.js";
function errorForUnknown(error) {
    if (isToolkitRuntimeError(error))
        return error;
    return new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Unexpected Skill script failure.", {
        cause: error,
    });
}
function errorPayload(error) {
    const payload = {
        code: error.code,
        message: error.message,
        category: error.category,
        retryable: error.retryable,
    };
    if (error.details !== undefined)
        payload.details = error.details;
    if (error.code === "E_ABORTED") {
        payload.failedPhase = "execution";
        payload.recovery = "Retry the same script after confirming the input and output paths.";
    }
    return payload;
}
function statusForError(error) {
    return error.code === "E_ABORTED" ? "cancelled" : "failed";
}
function serialized(value) {
    return JSON.stringify(value, null, 2) + "\n";
}
function outputInput(value) {
    if (value === undefined)
        return undefined;
    if (value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value))
        return value.map(outputInput);
    if (typeof value === "object") {
        const result = {};
        for (const [key, item] of Object.entries(value)) {
            if (/token|secret|password|credential|authorization|api[-_]?key/i.test(key)) {
                result[key] = "[redacted]";
            }
            else {
                result[key] = outputInput(item);
            }
        }
        return result;
    }
    return String(value);
}
function baseEnvelope(operation, context, requestId, startedAt, startedMonotonicMs, values) {
    return {
        schemaVersion: SKILL_SCRIPT_SCHEMA_VERSION,
        operation,
        status: values.status,
        ok: values.ok,
        context: context.name,
        requestId,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, performance.now() - startedMonotonicMs),
        ...(values.input !== undefined ? { input: outputInput(values.input) } : {}),
        ...(values.output !== undefined ? { output: values.output } : {}),
        artifacts: [...(values.artifacts ?? [])],
        warnings: [...(values.warnings ?? [])],
        next: [...(values.next ?? [])],
        ...(values.error !== undefined ? { error: values.error } : {}),
    };
}
/**
 * Execute one Skill-associated handler and emit exactly one machine-readable
 * envelope. The handler never receives raw process signals or a shell command.
 */
export async function runSkillScript(options) {
    const startedAt = new Date().toISOString();
    const startedMonotonicMs = performance.now();
    const context = getExecutionContext(options.request.context, options.environment);
    const requestId = options.request.requestId ?? randomUUID();
    const writeStdout = options.writeStdout ?? ((value) => process.stdout.write(value));
    const writeStderr = options.writeStderr ?? ((value) => process.stderr.write(value));
    const signals = createProcessSignalController();
    const signal = options.signal === undefined
        ? signals.signal
        : AbortSignal.any([signals.signal, options.signal]);
    let envelope;
    try {
        if (signal.aborted) {
            throw new ToolkitRuntimeError("E_ABORTED", "Skill script execution was cancelled before start.", {
                cause: signal.reason,
            });
        }
        if (options.request.schemaVersion !== undefined &&
            options.request.schemaVersion !== SKILL_SCRIPT_SCHEMA_VERSION) {
            throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Unsupported Skill script request schema version.", {
                details: {
                    received: options.request.schemaVersion,
                    supported: SKILL_SCRIPT_SCHEMA_VERSION,
                },
            });
        }
        if (options.request.operation !== undefined &&
            options.request.operation !== options.operation) {
            throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Skill script operation does not match the selected script.", {
                details: { requested: options.request.operation, expected: options.operation },
            });
        }
        const result = await options.handler({
            request: options.request,
            context,
            signal,
        });
        const guidance = contextGuidance(context);
        envelope = baseEnvelope(options.operation, context, requestId, startedAt, startedMonotonicMs, {
            ok: true,
            status: result.status ?? (context.canExecuteScripts ? "completed" : "planned"),
            ...(result.input !== undefined ? { input: result.input } : {}),
            ...(result.output !== undefined ? { output: result.output } : {}),
            ...(result.artifacts !== undefined ? { artifacts: result.artifacts } : {}),
            ...(result.warnings !== undefined ? { warnings: result.warnings } : {}),
            next: [...new Set([...(result.next ?? []), ...guidance])],
            error: null,
        });
    }
    catch (caught) {
        const error = errorForUnknown(caught);
        const guidance = contextGuidance(context);
        envelope = baseEnvelope(options.operation, context, requestId, startedAt, startedMonotonicMs, {
            ok: false,
            status: statusForError(error),
            artifacts: [],
            warnings: [],
            next: [...new Set(guidance)],
            error: errorPayload(error),
        });
        if (error.code === "E_INTERNAL_INVARIANT" && error.cause !== undefined) {
            writeStderr("Skill script failed unexpectedly. Re-run with the host diagnostics enabled.\n");
        }
    }
    finally {
        signals.dispose();
    }
    writeStdout(serialized(envelope));
    return envelope.ok ? 0 : exitCodeForError(envelope.error?.code ?? "E_INTERNAL_INVARIANT");
}
//# sourceMappingURL=runner.js.map