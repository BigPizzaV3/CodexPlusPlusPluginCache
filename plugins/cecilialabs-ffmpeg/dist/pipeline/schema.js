import { z } from "zod";
const nonEmpty = z.string().trim().min(1);
const positive = z.number().finite().positive();
const nonNegative = z.number().finite().min(0);
const positiveInteger = z.number().int().positive();
const hardware = z.enum(["software", "auto", "nvenc", "qsv", "vaapi", "videotoolbox"]);
const trimStepSchema = z.object({
    trim: z.object({
        start: nonNegative.optional(),
        end: positive.optional(),
        duration: positive.optional(),
        mode: z.enum(["auto", "copy", "accurate"]).optional(),
    }).strict().superRefine((value, ctx) => {
        if (value.start === undefined && value.end === undefined && value.duration === undefined) {
            ctx.addIssue({ code: "custom", message: "trim requires start, end, or duration.", path: ["start"] });
        }
        if (value.end !== undefined && value.duration !== undefined) {
            ctx.addIssue({ code: "custom", message: "trim cannot define both end and duration.", path: ["end"] });
        }
        if (value.end !== undefined && value.start !== undefined && value.end <= value.start) {
            ctx.addIssue({ code: "custom", message: "trim.end must be greater than trim.start.", path: ["end"] });
        }
    }),
}).strict();
const speedStepSchema = z.object({
    speed: z.object({
        factor: positive,
        audio: z.enum(["sync", "drop"]).optional(),
    }).strict(),
}).strict();
const resizeStepSchema = z.object({
    resize: z.object({
        width: positiveInteger,
        height: positiveInteger,
        fit: z.enum(["contain", "cover", "stretch"]).optional(),
        background: nonEmpty.optional(),
        profile: z.enum(["balanced", "aggressive"]).optional(),
        fps: positive.optional(),
        crf: z.number().finite().min(0).max(63).optional(),
        preset: nonEmpty.optional(),
        to: z.enum(["mp4", "webm"]).optional(),
        hardware: hardware.optional(),
        hardwareDevice: nonEmpty.optional(),
        hardwareStrict: z.boolean().optional(),
    }).strict(),
}).strict();
const normalizeStepSchema = z.object({
    normalize: z.object({
        width: positiveInteger.optional(),
        height: positiveInteger.optional(),
        fps: positive.optional(),
        pixelFormat: nonEmpty.optional(),
        sampleRate: positiveInteger.optional(),
        channels: positiveInteger.optional(),
    }).strict(),
}).strict();
const audioStepSchema = z.object({
    audio: z.object({
        normalize: z.literal(true),
        sampleRate: positiveInteger.optional(),
        channels: positiveInteger.optional(),
    }).strict(),
}).strict();
const conversionFormat = z.enum([
    "mp4", "webm", "gif", "webp", "png", "jpeg",
    "wav", "mp3", "aac", "m4a", "flac", "opus", "ogg",
]);
const convertStepSchema = z.object({
    convert: z.object({
        to: conversionFormat,
        fps: positive.optional(),
        width: positiveInteger.optional(),
        height: positiveInteger.optional(),
        fit: z.enum(["contain", "cover", "stretch"]).optional(),
        background: nonEmpty.optional(),
        quality: z.number().finite().optional(),
        maxColors: z.number().int().min(2).max(256).optional(),
        loop: z.number().int().min(0).optional(),
        audioBitrate: nonEmpty.optional(),
        sampleRate: positiveInteger.optional(),
        channels: positiveInteger.optional(),
        hardware: hardware.optional(),
        hardwareDevice: nonEmpty.optional(),
        hardwareStrict: z.boolean().optional(),
    }).strict(),
}).strict();
const presetStepSchema = z.object({ preset: nonEmpty }).strict();
export const pipelineStepSchema = z.union([
    trimStepSchema,
    speedStepSchema,
    resizeStepSchema,
    normalizeStepSchema,
    audioStepSchema,
    convertStepSchema,
    presetStepSchema,
]);
export const pipelineDocumentSchema = z.object({
    version: z.literal(1).default(1),
    input: nonEmpty,
    presets: z.record(z.string().trim().min(1), z.array(pipelineStepSchema).min(1).max(256)).default({}),
    steps: z.array(pipelineStepSchema).min(1).max(256),
    output: z.object({
        path: nonEmpty,
        codec: z.enum(["h264", "vp9"]).optional(),
    }).strict(),
}).strict();
//# sourceMappingURL=schema.js.map