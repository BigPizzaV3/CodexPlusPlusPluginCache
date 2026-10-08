import { z } from "zod";
import { concatMedia, createSlideshow, transitionMedia, } from "../../composition/index.js";
import { ToolkitRuntimeError } from "../../core/errors.js";
import { executeAction } from "./shared.js";
const positiveInteger = z.coerce.number().int().positive();
const positiveNumber = z.coerce.number().positive();
const nonNegative = z.coerce.number().min(0);
const audioMode = z.enum(["auto", "preserve", "drop"]);
const transitionName = z.enum([
    "fade", "fadeblack", "fadewhite", "wipeleft", "wiperight", "slideup", "slidedown",
    "circleopen", "circleclose", "dissolve", "pixelize", "distance", "zoomin", "zoomout",
]);
function normalizationOptions(parsed) {
    return {
        ...(parsed.width !== undefined ? { width: parsed.width } : {}),
        ...(parsed.height !== undefined ? { height: parsed.height } : {}),
        ...(parsed.fps !== undefined ? { fps: parsed.fps } : {}),
        ...(parsed.fit !== undefined ? { fit: parsed.fit } : {}),
        ...(parsed.background !== undefined ? { background: parsed.background } : {}),
    };
}
function runtimeOptions(global, signal) {
    return {
        ...(global.output !== undefined ? { output: global.output } : {}),
        overwrite: global.overwrite,
        dryRun: global.dryRun,
        verbose: global.verbose,
        ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
        ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
        signal,
        keepTemp: global.keepTemp,
    };
}
function positionalString(positional, index, commandName, label) {
    const value = positional[index];
    if (typeof value !== "string" || value.length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", `${commandName} requires ${label}.`);
    }
    return value;
}
function variadicStrings(positional, commandName) {
    const first = positional[0];
    const values = Array.isArray(first) ? first : positional;
    if (!values.every((value) => typeof value === "string") || values.length < 2) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", `${commandName} requires at least two input files.`);
    }
    return values;
}
function renderReport(report) {
    const lines = [
        `compose ${report.operation}${report.planned ? " (dry run)" : ""}`,
        `Inputs: ${report.sources.length}`,
        `Output: ${report.output}`,
        `Command: ${report.invocation}`,
    ];
    const video = report.outputMedia?.video[0];
    if (video?.width !== undefined && video.height !== undefined)
        lines.push(`Resolution: ${video.width}x${video.height}`);
    if (report.outputMedia?.format.durationSeconds !== undefined)
        lines.push(`Duration: ${report.outputMedia.format.durationSeconds}s`);
    return lines.join("\n");
}
const normalizeSchema = {
    width: positiveInteger.optional(),
    height: positiveInteger.optional(),
    fps: positiveInteger.optional(),
    fit: z.enum(["contain", "cover", "stretch"]).default("contain"),
    background: z.string().min(1).default("black"),
    to: z.enum(["mp4", "webm"]).default("mp4"),
};
export async function runComposeConcatAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            transition: z.union([z.literal("none"), transitionName]).default("none"),
            transitionDuration: positiveNumber.default(1),
            audio: audioMode.default("auto"),
            ...normalizeSchema,
        }).parse(command.opts());
        const report = await concatMedia(variadicStrings(positional, "compose concat"), {
            ...runtimeOptions(global, signal),
            ...normalizationOptions(parsed),
            transition: parsed.transition,
            transitionDuration: parsed.transitionDuration,
            audio: parsed.audio,
            to: parsed.to,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderReport);
}
export async function runComposeTransitionAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            transition: transitionName.default("fade"),
            duration: positiveNumber.default(1),
            offset: nonNegative.optional(),
            audio: audioMode.default("auto"),
            ...normalizeSchema,
        }).parse(command.opts());
        const report = await transitionMedia(positionalString(positional, 0, "compose transition", "a left input"), positionalString(positional, 1, "compose transition", "a right input"), {
            ...runtimeOptions(global, signal),
            ...normalizationOptions(parsed),
            transition: parsed.transition,
            duration: parsed.duration,
            ...(parsed.offset !== undefined ? { offset: parsed.offset } : {}),
            audio: parsed.audio,
            to: parsed.to,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderReport);
}
export async function runComposeSlideshowAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            width: positiveInteger.default(1280),
            height: positiveInteger.default(720),
            fps: positiveInteger.default(30),
            duration: positiveNumber.default(10),
            background: z.string().min(1).default("black"),
            fit: z.enum(["contain", "cover", "stretch"]).default("contain"),
            style: z.enum(["vertical-stack", "sequence"]).default("vertical-stack"),
            direction: z.enum(["up", "down"]).default("up"),
            transition: z.union([z.literal("none"), transitionName]).default("none"),
            transitionDuration: positiveNumber.default(0.75),
            to: z.enum(["mp4", "webm", "gif", "webp"]).default("mp4"),
            include: z.array(z.string()).default([]),
            exclude: z.array(z.string()).default([]),
            intro: z.boolean().default(true),
            outro: z.boolean().default(false),
            recursive: z.boolean().default(false),
        }).parse(command.opts());
        const report = await createSlideshow(positionalString(positional, 0, "compose slideshow", "an image directory"), {
            ...runtimeOptions(global, signal),
            width: parsed.width,
            height: parsed.height,
            fps: parsed.fps,
            duration: parsed.duration,
            background: parsed.background,
            fit: parsed.fit,
            style: parsed.style,
            direction: parsed.direction,
            transition: parsed.transition,
            transitionDuration: parsed.transitionDuration,
            to: parsed.to,
            includes: parsed.include,
            excludes: parsed.exclude,
            includeIntro: parsed.intro,
            includeOutro: parsed.outro,
            recursive: parsed.recursive,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderReport);
}
//# sourceMappingURL=composition.js.map