import { z } from "zod";
import { convertFile, normalizeConversionFormat, } from "../../conversion/index.js";
import { ToolkitRuntimeError } from "../../core/errors.js";
import { extractImage } from "../../image/index.js";
import { executeAction } from "./shared.js";
const positiveInteger = z.coerce.number().int().positive();
const nonNegative = z.coerce.number().finite().nonnegative();
function inputAt(positional, commandName) {
    const value = positional[0];
    if (typeof value !== "string" || value.length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", `${commandName} requires an input path.`);
    }
    return value;
}
function runtime(global, signal) {
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
function imageFormat(value) {
    const format = normalizeConversionFormat(value);
    if (!format || !["png", "jpeg", "webp", "gif"].includes(format)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `Unsupported image format: ${value}.`);
    }
    return format;
}
function renderConversion(report) {
    const video = report.outputMedia?.video[0];
    const result = video?.width !== undefined && video.height !== undefined
        ? `${video.codecName ?? report.targetFormat}, ${video.width}x${video.height}`
        : report.targetFormat;
    return [
        `image convert${report.planned ? " (dry run)" : ""}`,
        `Input: ${report.source}`,
        `Output: ${report.output}`,
        `Result: ${result}`,
        `Command: ${report.invocation}`,
    ].join("\n");
}
function renderExtract(report) {
    const video = report.outputMedia?.video[0];
    return [
        `image extract${report.planned ? " (dry run)" : ""}`,
        `Input: ${report.source}`,
        `Output: ${report.output}`,
        ...(video?.width !== undefined && video.height !== undefined
            ? [`Result: ${report.format}, ${video.width}x${video.height}`]
            : [`Result: ${report.format}`]),
        `Command: ${report.invocation}`,
    ].join("\n");
}
export async function runImageConvertAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            to: z.string().min(1),
            from: z.string().min(1).optional(),
            width: positiveInteger.optional(),
            height: positiveInteger.optional(),
            fit: z.enum(["contain", "cover", "stretch"]).default("contain"),
            background: z.string().min(1).default("black"),
            quality: z.coerce.number().int().min(0).max(100).optional(),
            fps: positiveInteger.optional(),
            maxColors: z.coerce.number().int().min(2).max(256).optional(),
            loop: z.coerce.number().int().min(0).max(65535).optional(),
        }).parse(command.opts());
        const to = imageFormat(parsed.to);
        const from = parsed.from === undefined ? undefined : imageFormat(parsed.from);
        const report = await convertFile(inputAt(positional, "image convert"), {
            ...runtime(global, signal),
            to,
            ...(from !== undefined ? { from } : {}),
            ...(parsed.width !== undefined ? { width: parsed.width } : {}),
            ...(parsed.height !== undefined ? { height: parsed.height } : {}),
            fit: parsed.fit,
            background: parsed.background,
            ...(parsed.quality !== undefined ? { quality: parsed.quality } : {}),
            ...(parsed.fps !== undefined ? { fps: parsed.fps } : {}),
            ...(parsed.maxColors !== undefined ? { maxColors: parsed.maxColors } : {}),
            ...(parsed.loop !== undefined ? { loop: parsed.loop } : {}),
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderConversion);
}
export async function runImageExtractAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            at: nonNegative.default(0),
            to: z.enum(["png", "jpeg", "jpg", "webp"]).default("png"),
            width: positiveInteger.optional(),
            height: positiveInteger.optional(),
            fit: z.enum(["contain", "cover", "stretch"]).default("contain"),
            background: z.string().min(1).default("black"),
            quality: z.coerce.number().int().min(0).max(100).default(90),
        }).parse(command.opts());
        const report = await extractImage(inputAt(positional, "image extract"), {
            ...runtime(global, signal),
            at: parsed.at,
            to: parsed.to === "jpg" ? "jpeg" : parsed.to,
            ...(parsed.width !== undefined ? { width: parsed.width } : {}),
            ...(parsed.height !== undefined ? { height: parsed.height } : {}),
            fit: parsed.fit,
            background: parsed.background,
            quality: parsed.quality,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderExtract);
}
//# sourceMappingURL=image.js.map