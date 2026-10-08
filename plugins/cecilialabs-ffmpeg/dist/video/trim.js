import { ToolkitRuntimeError } from "../core/errors.js";
import { encodingArgs, resolveEncodingProfile } from "./encoding.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "./io.js";
import { executeVideoTransform, formatSeconds, inspectInput, nonNegativeFinite, positiveFinite, requireVideo } from "./helpers.js";
function resolveMode(mode) {
    const requested = mode ?? "auto";
    return { requested, resolved: requested === "copy" ? "copy" : "accurate" };
}
function durationOf(media) {
    return media.format.durationSeconds ?? media.video[0]?.durationSeconds ?? media.audio[0]?.durationSeconds;
}
function validateRange(start, duration, inputDuration) {
    if (inputDuration !== undefined && start >= inputDuration) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Trim start is outside the input duration.", {
            details: { start, inputDuration },
        });
    }
    if (inputDuration !== undefined && start + duration > inputDuration + 0.01) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Trim range exceeds the input duration.", {
            details: { start, duration, inputDuration },
        });
    }
}
function trimWarnings(requested, resolved) {
    if (resolved === "copy") {
        return [{
                code: "W_TRIM_KEYFRAME_DEPENDENT",
                message: "Stream-copy trimming is fast but the exact cut point may depend on keyframes and codec timestamps.",
                details: { requestedMode: requested, resolvedMode: resolved },
            }];
    }
    return [];
}
function accurateEncoding(output, hasAudio) {
    const profile = resolveEncodingProfile(output);
    return ["-c", "copy", ...encodingArgs(profile, hasAudio)];
}
export async function trimVideoStart(input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const seconds = positiveFinite(request.seconds, "seconds");
    const output = deriveOutputPath(source, "trim-start", request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectInput(source, request);
    requireVideo(media, source);
    const inputDuration = durationOf(media);
    if (inputDuration !== undefined && seconds >= inputDuration) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Trim amount must be shorter than the input duration.", {
            details: { seconds, inputDuration },
        });
    }
    const mode = resolveMode(request.mode);
    const time = formatSeconds(seconds);
    const args = mode.resolved === "copy"
        ? ["-ss", time, "-i", source, "-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero"]
        : ["-i", source, "-ss", time, "-map", "0", ...accurateEncoding(output, media.audio.length > 0), "-avoid_negative_ts", "make_zero"];
    return await executeVideoTransform({
        operation: "trim-start",
        source,
        output,
        argsBeforeOutput: args,
        runtime: request,
        inputMedia: media,
        warnings: trimWarnings(mode.requested, mode.resolved),
        details: { seconds, requestedMode: mode.requested, resolvedMode: mode.resolved },
    });
}
export async function trimVideoEnd(input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const seconds = positiveFinite(request.seconds, "seconds");
    const output = deriveOutputPath(source, "trim-end", request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectInput(source, request);
    requireVideo(media, source);
    const inputDuration = durationOf(media);
    if (inputDuration === undefined) {
        throw new ToolkitRuntimeError("E_MEDIA_INCOMPATIBLE", "Input duration is required for trim-end.", { details: { source } });
    }
    if (seconds >= inputDuration) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Trim amount must be shorter than the input duration.", {
            details: { seconds, inputDuration },
        });
    }
    const keepDuration = inputDuration - seconds;
    const mode = resolveMode(request.mode);
    const args = mode.resolved === "copy"
        ? ["-i", source, "-t", formatSeconds(keepDuration), "-map", "0", "-c", "copy"]
        : ["-i", source, "-t", formatSeconds(keepDuration), "-map", "0", ...accurateEncoding(output, media.audio.length > 0)];
    return await executeVideoTransform({
        operation: "trim-end",
        source,
        output,
        argsBeforeOutput: args,
        runtime: request,
        inputMedia: media,
        warnings: trimWarnings(mode.requested, mode.resolved),
        details: { seconds, keepDuration, inputDuration, requestedMode: mode.requested, resolvedMode: mode.resolved },
    });
}
export async function trimVideoRange(input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const start = nonNegativeFinite(request.start ?? 0, "start");
    if (request.end !== undefined && request.duration !== undefined) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Use either --end or --duration, not both.", {
            details: { end: request.end, duration: request.duration },
        });
    }
    if (request.end === undefined && request.duration === undefined) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", "video trim requires --end or --duration.");
    }
    const duration = request.duration !== undefined
        ? positiveFinite(request.duration, "duration")
        : positiveFinite(request.end - start, "duration");
    const suffixEnd = request.end ?? start + duration;
    const output = deriveOutputPath(source, `trim-${formatSeconds(start)}-${formatSeconds(suffixEnd)}`, request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectInput(source, request);
    requireVideo(media, source);
    const inputDuration = durationOf(media);
    validateRange(start, duration, inputDuration);
    const mode = resolveMode(request.mode);
    const args = mode.resolved === "copy"
        ? ["-ss", formatSeconds(start), "-i", source, "-t", formatSeconds(duration), "-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero"]
        : ["-i", source, "-ss", formatSeconds(start), "-t", formatSeconds(duration), "-map", "0", ...accurateEncoding(output, media.audio.length > 0), "-avoid_negative_ts", "make_zero"];
    return await executeVideoTransform({
        operation: "trim",
        source,
        output,
        argsBeforeOutput: args,
        runtime: request,
        inputMedia: media,
        warnings: trimWarnings(mode.requested, mode.resolved),
        details: { start, duration, end: start + duration, requestedMode: mode.requested, resolvedMode: mode.resolved },
    });
}
//# sourceMappingURL=trim.js.map