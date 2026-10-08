import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { ToolkitRuntimeError } from "./errors.js";
const DEFAULT_CAPTURE_LIMIT_BYTES = 4 * 1024 * 1024;
const DEFAULT_ABORT_GRACE_MS = 1_500;
class TailCapture {
    // Explicitly use Buffer's default ArrayBufferLike backing-store type.
    // Without this annotation, Buffer.alloc(0) can be inferred as
    // Buffer<ArrayBuffer>, which is too narrow for chunks/subarrays backed by
    // ArrayBufferLike (including SharedArrayBuffer in current Node typings).
    value = Buffer.alloc(0);
    limit;
    truncated = false;
    constructor(limit) {
        this.limit = Math.max(0, limit);
    }
    push(chunk) {
        if (this.limit === 0) {
            if (chunk.length > 0)
                this.truncated = true;
            return;
        }
        if (chunk.length >= this.limit) {
            this.value = chunk.subarray(chunk.length - this.limit);
            this.truncated = true;
            return;
        }
        if (this.value.length + chunk.length <= this.limit) {
            this.value = Buffer.concat([this.value, chunk]);
            return;
        }
        const excess = this.value.length + chunk.length - this.limit;
        this.value = Buffer.concat([this.value.subarray(excess), chunk]);
        this.truncated = true;
    }
    text() {
        return this.value.toString("utf8");
    }
}
function quoteForDisplay(value) {
    if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value))
        return value;
    return `'${value.replaceAll("'", `'\\''`)}'`;
}
/** Render an invocation for logs only. The returned string is never executed. */
export function renderCommandForDisplay(invocation) {
    return [invocation.binary, ...invocation.args].map(quoteForDisplay).join(" ");
}
function elapsedMs(startedAt) {
    return Math.max(0, performance.now() - startedAt);
}
/**
 * Execute a process using an argument array and `shell: false`.
 * Non-zero exit codes are returned to the caller; domain runners decide how to
 * classify them. Spawn failures and cancellations are raised as typed errors.
 */
export async function runCommand(invocation, options = {}) {
    const startedAt = performance.now();
    const commandDisplay = renderCommandForDisplay(invocation);
    const diagnostic = options.onDiagnostic ?? ((message) => process.stderr.write(`${message}\n`));
    if (options.verbose)
        diagnostic(`[runtime] ${commandDisplay}`);
    if (options.signal?.aborted) {
        throw new ToolkitRuntimeError("E_ABORTED", "Process execution was cancelled before start.", {
            details: { command: commandDisplay },
            cause: options.signal.reason,
        });
    }
    if (options.dryRun) {
        return {
            binary: invocation.binary,
            args: [...invocation.args],
            ...(invocation.cwd !== undefined ? { cwd: invocation.cwd } : {}),
            exitCode: 0,
            durationMs: elapsedMs(startedAt),
            executed: false,
            stdoutTruncated: false,
            stderrTruncated: false,
        };
    }
    const captureLimit = options.maxCaptureBytes ?? DEFAULT_CAPTURE_LIMIT_BYTES;
    const stdoutCapture = new TailCapture(captureLimit);
    const stderrCapture = new TailCapture(captureLimit);
    return await new Promise((resolve, reject) => {
        let settled = false;
        let aborted = false;
        let hardKillTimer;
        const child = spawn(invocation.binary, invocation.args, {
            ...(invocation.cwd !== undefined ? { cwd: invocation.cwd } : {}),
            env: { ...process.env, ...(invocation.env ?? {}) },
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
            windowsHide: true,
        });
        const cleanup = () => {
            if (hardKillTimer !== undefined)
                clearTimeout(hardKillTimer);
            options.signal?.removeEventListener("abort", onAbort);
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const onAbort = () => {
            if (settled || aborted)
                return;
            aborted = true;
            child.kill(process.platform === "win32" ? "SIGTERM" : "SIGINT");
            hardKillTimer = setTimeout(() => {
                if (!settled)
                    child.kill("SIGKILL");
            }, options.abortGraceMs ?? DEFAULT_ABORT_GRACE_MS);
            hardKillTimer.unref?.();
        };
        options.signal?.addEventListener("abort", onAbort, { once: true });
        child.stdout.on("data", (chunk) => {
            stdoutCapture.push(chunk);
            const text = chunk.toString("utf8");
            options.onStdout?.(text);
            if (options.teeStdout)
                process.stdout.write(chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderrCapture.push(chunk);
            const text = chunk.toString("utf8");
            options.onStderr?.(text);
            if (options.teeStderr)
                process.stderr.write(chunk);
        });
        child.once("error", (error) => {
            const systemCode = error.code;
            fail(new ToolkitRuntimeError("E_INTERNAL_INVARIANT", `Failed to spawn process: ${commandDisplay}`, {
                details: {
                    ...(systemCode !== undefined ? { systemCode } : {}),
                    command: commandDisplay,
                },
                cause: error,
            }));
        });
        child.once("close", (exitCode, signal) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            const execution = {
                binary: invocation.binary,
                args: [...invocation.args],
                ...(invocation.cwd !== undefined ? { cwd: invocation.cwd } : {}),
                exitCode,
                ...(signal !== null ? { signal } : {}),
                durationMs: elapsedMs(startedAt),
                stdout: stdoutCapture.text(),
                stderr: stderrCapture.text(),
                executed: true,
                stdoutTruncated: stdoutCapture.truncated,
                stderrTruncated: stderrCapture.truncated,
            };
            if (aborted || options.signal?.aborted) {
                reject(new ToolkitRuntimeError("E_ABORTED", "Process execution was cancelled.", {
                    details: {
                        command: commandDisplay,
                        exitCode,
                        ...(signal !== null ? { signal } : {}),
                        stdout: execution.stdout,
                        stderr: execution.stderr,
                    },
                    cause: options.signal?.reason,
                }));
                return;
            }
            resolve(execution);
        });
    });
}
//# sourceMappingURL=command-result.js.map