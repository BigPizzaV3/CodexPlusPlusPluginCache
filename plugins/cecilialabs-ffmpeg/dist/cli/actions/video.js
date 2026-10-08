import { z } from "zod";
import { ToolkitRuntimeError } from "../../core/errors.js";
import { changeVideoSpeed, createVideoFromImage, restoreVideo, upscaleVideo, trimVideoEnd, trimVideoRange, trimVideoStart, } from "../../video/index.js";
import { executeAction } from "./shared.js";
const positiveNumber = z.coerce.number().finite().positive();
const nonNegativeNumber = z.coerce.number().finite().nonnegative();
const trimMode = z.enum(["auto", "copy", "accurate"]);
const hardwareMode = z.enum(["software", "auto", "nvenc", "qsv", "vaapi", "videotoolbox"]);
function hardwareOptions(parsed) {
    return {
        ...(parsed.hardware !== undefined ? { hardware: parsed.hardware } : {}),
        ...(parsed.hardwareDevice !== undefined ? { hardwareDevice: parsed.hardwareDevice } : {}),
        ...(parsed.hardwareStrict !== undefined ? { hardwareStrict: parsed.hardwareStrict } : {}),
    };
}
const resolutionSchema = z.string().regex(/^\d+x\d+$/i).transform((value) => {
    const [widthText, heightText] = value.toLowerCase().split("x");
    const width = Number(widthText);
    const height = Number(heightText);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "resolution must be WIDTHxHEIGHT with positive integers.", { details: { resolution: value } });
    }
    return { width, height };
});
function inputAt(positional, commandName) {
    const value = positional[0];
    if (typeof value !== "string" || value.length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", `${commandName} requires an input path.`);
    }
    return value;
}
function renderVideoReport(report) {
    const lines = [
        `${report.operation}${report.planned ? " (dry run)" : ""}`,
        `Input:  ${report.source}`,
        `Output: ${report.output}`,
        `Command: ${report.invocation}`,
    ];
    const hardware = report.details["hardware"];
    if (hardware && typeof hardware === "object") {
        const value = hardware;
        lines.push(`Hardware: ${String(value.requested ?? "software")} -> ${String(value.resolved ?? "software")} (${String(value.encoder ?? "unknown")})${value.fallback === true ? " [fallback]" : ""}`);
    }
    const outputVideo = report.outputMedia?.video[0];
    if (outputVideo?.width !== undefined && outputVideo.height !== undefined) {
        lines.push(`Result: ${outputVideo.width}x${outputVideo.height}${report.outputMedia?.format.durationSeconds !== undefined ? `, ${report.outputMedia.format.durationSeconds.toFixed(3)}s` : ""}`);
    }
    return lines.join("\n");
}
function localOptions(command) {
    return command.opts();
}
export async function runTrimStartAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({ seconds: positiveNumber, mode: trimMode.default("auto") }).parse(localOptions(command));
        const report = await trimVideoStart(inputAt(positional, "video trim-start"), {
            seconds: parsed.seconds,
            mode: parsed.mode,
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderVideoReport);
}
export async function runTrimEndAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({ seconds: positiveNumber, mode: trimMode.default("auto") }).parse(localOptions(command));
        const report = await trimVideoEnd(inputAt(positional, "video trim-end"), {
            seconds: parsed.seconds,
            mode: parsed.mode,
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderVideoReport);
}
export async function runTrimRangeAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            start: nonNegativeNumber.default(0),
            end: positiveNumber.optional(),
            duration: positiveNumber.optional(),
            mode: trimMode.default("auto"),
        }).parse(localOptions(command));
        const report = await trimVideoRange(inputAt(positional, "video trim"), {
            start: parsed.start,
            ...(parsed.end !== undefined ? { end: parsed.end } : {}),
            ...(parsed.duration !== undefined ? { duration: parsed.duration } : {}),
            mode: parsed.mode,
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderVideoReport);
}
export async function runVideoSpeedAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({ factor: positiveNumber, audio: z.enum(["sync", "drop"]).default("sync") }).parse(localOptions(command));
        const report = await changeVideoSpeed(inputAt(positional, "video speed"), {
            factor: parsed.factor,
            audio: parsed.audio,
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderVideoReport);
}
export async function runVideoFromImageAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            duration: positiveNumber.default(5),
            resolution: resolutionSchema,
            fps: positiveNumber.default(30),
            pixelFormat: z.string().min(1).default("yuv420p"),
            fit: z.enum(["contain", "cover", "stretch"]).default("contain"),
            background: z.string().min(1).default("black"),
            to: z.enum(["mp4", "webm"]).default("mp4"),
            hardware: hardwareMode.default("software"),
            hardwareDevice: z.string().min(1).optional(),
            hardwareStrict: z.boolean().default(false),
        }).parse(localOptions(command));
        const report = await createVideoFromImage(inputAt(positional, "video from-image"), {
            duration: parsed.duration,
            width: parsed.resolution.width,
            height: parsed.resolution.height,
            fps: parsed.fps,
            pixelFormat: parsed.pixelFormat,
            fit: parsed.fit,
            background: parsed.background,
            to: parsed.to,
            ...hardwareOptions(parsed),
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderVideoReport);
}
async function runVideoScaleAction(command, positional, canonical) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            resolution: resolutionSchema,
            profile: z.enum(["balanced", "aggressive"]).default("balanced"),
            fps: positiveNumber.optional(),
            crf: z.coerce.number().finite().min(0).max(63).optional(),
            preset: z.string().min(1).optional(),
            fit: z.enum(["contain", "cover", "stretch"]).default("contain"),
            background: z.string().min(1).default("black"),
            to: z.enum(["mp4", "webm"]).default("mp4"),
            hardware: hardwareMode.default("software"),
            hardwareDevice: z.string().min(1).optional(),
            hardwareStrict: z.boolean().default(false),
        }).parse(localOptions(command));
        const operation = canonical ? upscaleVideo : restoreVideo;
        const report = await operation(inputAt(positional, canonical ? "video upscale" : "video restore"), {
            width: parsed.resolution.width,
            height: parsed.resolution.height,
            profile: parsed.profile,
            ...(parsed.fps !== undefined ? { fps: parsed.fps } : {}),
            ...(parsed.crf !== undefined ? { crf: parsed.crf } : {}),
            ...(parsed.preset !== undefined ? { preset: parsed.preset } : {}),
            fit: parsed.fit,
            background: parsed.background,
            to: parsed.to,
            ...hardwareOptions(parsed),
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderVideoReport);
}
export async function runVideoUpscaleAction(command, positional) {
    await runVideoScaleAction(command, positional, true);
}
/** Compatibility alias for pre-v1 CLI users. */
export async function runVideoRestoreAction(command, positional) {
    await runVideoScaleAction(command, positional, false);
}
//# sourceMappingURL=video.js.map