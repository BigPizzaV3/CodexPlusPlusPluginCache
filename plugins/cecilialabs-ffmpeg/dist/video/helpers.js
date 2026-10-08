import { renderCommandForDisplay } from "../core/command-result.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { probeMedia } from "../media/probe.js";
import { prepareOutputTransaction } from "./io.js";
export function requireVideo(media, source) {
    if (media.video.length === 0) {
        throw new ToolkitRuntimeError("E_MEDIA_NO_MATCHING_STREAM", "Input does not contain a video stream.", {
            details: { source, required: "video" },
        });
    }
}
export async function inspectInput(source, options) {
    const report = await probeMedia(source, {
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    });
    if (!report.media) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "Unable to inspect input media.", { details: { source } });
    }
    return report.media;
}
export async function executeVideoTransform(options) {
    const transaction = await prepareOutputTransaction({
        source: options.source,
        output: options.output,
        ...(options.runtime.overwrite !== undefined ? { overwrite: options.runtime.overwrite } : {}),
        ...(options.runtime.dryRun !== undefined ? { dryRun: options.runtime.dryRun } : {}),
        ...(options.runtime.keepTemp !== undefined ? { keepTemp: options.runtime.keepTemp } : {}),
    });
    try {
        const args = ["-hide_banner", "-loglevel", "error", ...options.argsBeforeOutput, "-n", transaction.temporary];
        const execution = await runFFmpeg(args, {
            ...(options.runtime.ffmpegPath !== undefined ? { ffmpegPath: options.runtime.ffmpegPath } : {}),
            ...(options.runtime.dryRun !== undefined ? { dryRun: options.runtime.dryRun } : {}),
            ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
            ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
            ...(options.runtime.cwd !== undefined ? { cwd: options.runtime.cwd } : {}),
        });
        const invocation = renderCommandForDisplay({
            binary: execution.binary,
            args: execution.args,
            ...(execution.cwd !== undefined ? { cwd: execution.cwd } : {}),
        });
        if (!execution.executed) {
            return {
                operation: options.operation,
                source: options.source,
                output: transaction.output,
                planned: true,
                invocation,
                execution,
                ...(options.inputMedia !== undefined ? { inputMedia: options.inputMedia } : {}),
                warnings: [...(options.warnings ?? [])],
                details: options.details ?? {},
            };
        }
        await transaction.finalize();
        const outputProbe = await probeMedia(transaction.output, {
            ...(options.runtime.ffprobePath !== undefined ? { ffprobePath: options.runtime.ffprobePath } : {}),
            ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
            ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
        });
        return {
            operation: options.operation,
            source: options.source,
            output: transaction.output,
            planned: false,
            invocation,
            execution,
            ...(options.inputMedia !== undefined ? { inputMedia: options.inputMedia } : {}),
            ...(outputProbe.media !== undefined ? { outputMedia: outputProbe.media } : {}),
            warnings: [...(options.warnings ?? [])],
            details: options.details ?? {},
        };
    }
    catch (error) {
        await transaction.cleanup();
        throw error;
    }
}
export function positiveFinite(value, name) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a positive number.`, {
            details: { [name]: value },
        });
    }
    return value;
}
export function nonNegativeFinite(value, name) {
    if (!Number.isFinite(value) || value < 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be zero or greater.`, {
            details: { [name]: value },
        });
    }
    return value;
}
export function formatSeconds(value) {
    return Number(value.toFixed(6)).toString();
}
//# sourceMappingURL=helpers.js.map