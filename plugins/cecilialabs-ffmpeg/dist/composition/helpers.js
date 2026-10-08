import path from "node:path";
import { renderCommandForDisplay } from "../core/command-result.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { preflightOutputPath, prepareOutputTransaction, resolveReadableFile } from "../media/io.js";
import { probeMedia } from "../media/probe.js";
export async function inspectCompositionInput(source, options) {
    const report = await probeMedia(source, {
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    });
    if (!report.media) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", `Unable to inspect composition input: ${source}`);
    }
    return report.media;
}
export async function resolveCompositionFiles(inputs, options) {
    if (inputs.length < 2) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", "Composition requires at least two input files.");
    }
    return await Promise.all(inputs.map(async (input) => await resolveReadableFile(input, options.cwd)));
}
export function requireVideoStreams(media, sources) {
    media.forEach((item, index) => {
        if (item.video.length === 0) {
            throw new ToolkitRuntimeError("E_MEDIA_NO_MATCHING_STREAM", "Composition input does not contain video.", {
                details: { source: sources[index] },
            });
        }
    });
}
export function durationSeconds(media, source) {
    const duration = media.format.durationSeconds ?? media.video[0]?.durationSeconds ?? media.audio[0]?.durationSeconds;
    if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
        throw new ToolkitRuntimeError("E_MEDIA_INCOMPATIBLE", "Composition requires a finite positive input duration.", {
            details: { source, duration },
        });
    }
    return duration;
}
export function deriveCompositionOutput(source, suffix, explicit, cwd, format = "mp4") {
    if (explicit !== undefined)
        return path.resolve(cwd ?? process.cwd(), explicit);
    const parsed = path.parse(source);
    return path.join(parsed.dir, `${parsed.name}.${suffix}.${format}`);
}
export async function preflightCompositionOutput(sources, output, overwrite = false) {
    const absoluteOutput = path.resolve(output);
    const collision = sources.find((source) => path.resolve(source) === absoluteOutput);
    if (collision !== undefined) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Composition output must differ from every input path.", {
            details: { output: absoluteOutput, sources },
        });
    }
    return await preflightOutputPath({ output: absoluteOutput, overwrite });
}
export async function executeComposition(options) {
    const absoluteOutput = await preflightCompositionOutput(options.sources, options.output, options.runtime.overwrite ?? false);
    const transaction = await prepareOutputTransaction({
        output: absoluteOutput,
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
                sources: options.sources,
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
        const probe = await probeMedia(transaction.output, {
            ...(options.runtime.ffprobePath !== undefined ? { ffprobePath: options.runtime.ffprobePath } : {}),
            ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
            ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
        });
        return {
            operation: options.operation,
            sources: options.sources,
            output: transaction.output,
            planned: false,
            invocation,
            execution,
            ...(options.inputMedia !== undefined ? { inputMedia: options.inputMedia } : {}),
            ...(probe.media !== undefined ? { outputMedia: probe.media } : {}),
            warnings: [...(options.warnings ?? [])],
            details: options.details ?? {},
        };
    }
    catch (error) {
        await transaction.cleanup();
        throw error;
    }
}
//# sourceMappingURL=helpers.js.map