import { resolveBinary } from "./binary-resolver.js";
import { renderCommandForDisplay, runCommand } from "./command-result.js";
import { ToolkitRuntimeError } from "./errors.js";
import { currentProgressObserver, nextProgressRunId, progressMediaDuration, } from "./progress-context.js";
import { deriveProgressEvent, estimateProgressDuration, FFmpegProgressParser, inputSources, } from "./progress.js";
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
function canInstrumentProgress(args, dryRun) {
    if (dryRun)
        return false;
    if (args.includes("-progress"))
        return false;
    // Avoid claiming stdout when the media payload itself is explicitly written there.
    return args.at(-1) !== "-" && !args.includes("pipe:1");
}
export async function runFFmpeg(args, options = {}) {
    const env = { ...process.env, ...(options.env ?? {}) };
    const binary = await resolveBinary({
        kind: "ffmpeg",
        ...(options.ffmpegPath !== undefined ? { explicitPath: options.ffmpegPath } : {}),
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        env,
    });
    const observer = currentProgressObserver();
    const instrumentProgress = observer !== undefined && canInstrumentProgress(args, options.dryRun);
    const effectiveArgs = instrumentProgress
        ? ["-progress", "pipe:1", "-nostats", ...args]
        : [...args];
    const runId = instrumentProgress ? nextProgressRunId() : undefined;
    const source = instrumentProgress ? inputSources(args)[0] : undefined;
    const duration = instrumentProgress
        ? estimateProgressDuration(args, progressMediaDuration)
        : undefined;
    const parser = instrumentProgress ? new FFmpegProgressParser() : undefined;
    const emit = (chunk) => {
        if (!observer || !parser || !runId)
            return;
        for (const snapshot of parser.push(chunk)) {
            try {
                observer(deriveProgressEvent(runId, snapshot, {
                    ...(source !== undefined ? { source } : {}),
                    ...(duration !== undefined ? { duration } : {}),
                }));
            }
            catch {
                // Progress display/collection must never make a media operation fail.
            }
        }
    };
    const invocation = {
        binary,
        args: effectiveArgs,
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        env,
    };
    let execution;
    try {
        execution = await runCommand(invocation, {
            ...options,
            ...(instrumentProgress
                ? {
                    onStdout: (chunk) => {
                        options.onStdout?.(chunk);
                        emit(chunk);
                    },
                }
                : {}),
        });
        if (observer && parser && runId) {
            for (const snapshot of parser.flush()) {
                try {
                    observer(deriveProgressEvent(runId, snapshot, {
                        ...(source !== undefined ? { source } : {}),
                        ...(duration !== undefined ? { duration } : {}),
                    }));
                }
                catch {
                    // Progress display/collection must never make a media operation fail.
                }
            }
        }
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError &&
            error.code === "E_INTERNAL_INVARIANT" &&
            error.details?.["systemCode"] === "ENOENT") {
            throw new ToolkitRuntimeError("E_ENV_FFMPEG_NOT_FOUND", "FFmpeg disappeared before execution.", {
                details: { command: renderCommandForDisplay(invocation) },
                cause: error,
            });
        }
        throw error;
    }
    if (execution.exitCode !== 0) {
        throw new ToolkitRuntimeError("E_FFMPEG_EXECUTION_FAILED", `FFmpeg exited with code ${execution.exitCode ?? "unknown"}.`, { details: executionDetails(execution) });
    }
    return execution;
}
//# sourceMappingURL=ffmpeg-runner.js.map