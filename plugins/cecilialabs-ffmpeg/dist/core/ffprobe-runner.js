import { resolveBinary } from "./binary-resolver.js";
import { renderCommandForDisplay, runCommand } from "./command-result.js";
import { ToolkitRuntimeError } from "./errors.js";
function executionDetails(execution) {
    return {
        binary: execution.binary,
        args: execution.args,
        exitCode: execution.exitCode,
        ...(execution.signal !== undefined ? { signal: execution.signal } : {}),
        ...(execution.stderr ? { stderrTail: execution.stderr } : {}),
        ...(execution.stdout ? { stdoutTail: execution.stdout } : {}),
        stderrTruncated: execution.stderrTruncated,
        stdoutTruncated: execution.stdoutTruncated,
    };
}
export async function runFFprobe(args, options = {}) {
    const env = { ...process.env, ...(options.env ?? {}) };
    const binary = await resolveBinary({
        kind: "ffprobe",
        ...(options.ffprobePath !== undefined ? { explicitPath: options.ffprobePath } : {}),
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        env,
    });
    const invocation = {
        binary,
        args: [...args],
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        env,
    };
    let execution;
    try {
        execution = await runCommand(invocation, options);
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError &&
            error.code === "E_INTERNAL_INVARIANT" &&
            error.details?.["systemCode"] === "ENOENT") {
            throw new ToolkitRuntimeError("E_ENV_FFPROBE_NOT_FOUND", "FFprobe disappeared before execution.", {
                details: { command: renderCommandForDisplay(invocation) },
                cause: error,
            });
        }
        throw error;
    }
    if (execution.exitCode !== 0) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", `FFprobe exited with code ${execution.exitCode ?? "unknown"}.`, {
            details: executionDetails(execution),
        });
    }
    return execution;
}
//# sourceMappingURL=ffprobe-runner.js.map