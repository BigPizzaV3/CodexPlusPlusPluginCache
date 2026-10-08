import { renderCommandForDisplay } from "../core/command-result.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { probeMedia } from "../media/probe.js";
import { resolveReadableFile } from "../media/io.js";
import { buildCameraStreamPlan, buildFileStreamPlan } from "./plan.js";
function invocation(binary, args) {
    return renderCommandForDisplay({ binary, args: [...args] });
}
export async function streamFile(input, options) {
    const source = await resolveReadableFile(input);
    const probe = await probeMedia(source, {
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        dryRun: false,
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
    const built = buildFileStreamPlan(source, probe.media, options);
    const execution = await runFFmpeg(built.args, {
        ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        teeStderr: options.verbose ?? false,
    });
    const plan = {
        source: { kind: "file", path: source, realtime: options.realtime ?? true },
        destination: built.destination,
        encoding: built.encoding,
        args: [...built.args],
        invocation: invocation(execution.binary, built.args),
        warnings: [...built.warnings],
    };
    return {
        planned: !execution.executed,
        plan,
        execution,
        ...(probe.media !== undefined ? { sourceMedia: probe.media } : {}),
        warnings: [...built.warnings],
    };
}
export async function streamCamera(options) {
    const built = buildCameraStreamPlan(options);
    const execution = await runFFmpeg(built.args, {
        ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        teeStderr: options.verbose ?? false,
    });
    const plan = {
        source: {
            kind: "camera",
            device: options.device,
            inputFormat: built.inputFormat,
            ...(options.framerate !== undefined ? { framerate: options.framerate } : {}),
            ...(options.videoSize !== undefined ? { videoSize: options.videoSize } : {}),
        },
        destination: built.destination,
        encoding: built.encoding,
        args: [...built.args],
        invocation: invocation(execution.binary, built.args),
        warnings: [...built.warnings],
    };
    return {
        planned: !execution.executed,
        plan,
        execution,
        warnings: [...built.warnings],
    };
}
//# sourceMappingURL=stream.js.map