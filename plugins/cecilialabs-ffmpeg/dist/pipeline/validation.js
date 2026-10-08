import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
import { isExtensionForFormat } from "../conversion/profiles.js";
const H264_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".mkv"]);
const VP9_EXTENSIONS = new Set([".webm"]);
const AUDIO_FORMATS = new Set(["wav", "mp3", "aac", "m4a", "flac", "opus", "ogg"]);
const IMAGE_FORMATS = new Set(["gif", "webp", "png", "jpeg"]);
function stepKind(step) {
    if ("trim" in step)
        return "trim";
    if ("speed" in step)
        return "speed";
    if ("resize" in step)
        return "resize";
    if ("normalize" in step)
        return "normalize";
    if ("audio" in step)
        return "audio";
    return "convert";
}
function codecForFormat(format) {
    if (format === "mp4")
        return "h264";
    if (format === "webm")
        return "vp9";
    return undefined;
}
function knownMediaKind(step) {
    if ("convert" in step) {
        if (AUDIO_FORMATS.has(step.convert.to))
            return "audio";
        if (IMAGE_FORMATS.has(step.convert.to))
            return "image";
        if (step.convert.to === "mp4" || step.convert.to === "webm")
            return "video";
    }
    if ("trim" in step || "speed" in step || "resize" in step)
        return "video";
    return undefined;
}
/** Reject statically impossible transitions without executing media. */
export function validatePipelineStepCompatibility(steps) {
    let currentKind;
    for (const [offset, step] of steps.entries()) {
        const index = offset + 1;
        if (currentKind !== undefined &&
            currentKind !== "video" &&
            ("trim" in step || "speed" in step || "resize" in step)) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", `Pipeline step ${index} requires video media, but the previous step produces ${currentKind} media.`, { details: { index, previousMediaKind: currentKind, step: stepKind(step) } });
        }
        const nextKind = knownMediaKind(step);
        if (nextKind !== undefined)
            currentKind = nextKind;
    }
}
export function validatePipelineOutput(document, steps, output) {
    validatePipelineStepCompatibility(steps);
    const extension = path.extname(output).toLowerCase();
    const codec = document.output.codec;
    if (codec !== undefined) {
        const valid = codec === "h264" ? H264_EXTENSIONS.has(extension) : VP9_EXTENSIONS.has(extension);
        if (!valid) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline output codec is incompatible with the output file extension.", {
                details: { codec, output, extension },
            });
        }
    }
    const final = steps.at(-1);
    if (final === undefined) {
        throw new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Expanded pipeline contains no executable steps.");
    }
    if ("convert" in final) {
        if (!isExtensionForFormat(output, final.convert.to)) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Final conversion target does not match the pipeline output extension.", {
                details: { target: final.convert.to, output, extension },
            });
        }
        const targetCodec = codecForFormat(final.convert.to);
        if (codec !== undefined && targetCodec !== undefined && targetCodec !== codec) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline output codec conflicts with the final conversion target.", {
                details: { codec, target: final.convert.to, expectedCodec: targetCodec },
            });
        }
        if (codec !== undefined && targetCodec === undefined) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline output codec cannot be declared for a non-video final conversion target.", {
                details: { codec, target: final.convert.to },
            });
        }
    }
    if ("resize" in final && final.resize.to !== undefined) {
        const expectedExtension = `.${final.resize.to}`;
        if (extension !== expectedExtension) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Final resize target does not match the pipeline output extension.", {
                details: { target: final.resize.to, output, extension },
            });
        }
        const targetCodec = codecForFormat(final.resize.to);
        if (codec !== undefined && targetCodec !== codec) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline output codec conflicts with the final resize target.", {
                details: { codec, target: final.resize.to, expectedCodec: targetCodec },
            });
        }
    }
}
export function validatePipelineResultCodec(document, media) {
    const codec = document.output.codec;
    if (codec === undefined || media === undefined)
        return;
    const actual = media.video[0]?.codecName;
    if (actual === codec)
        return;
    throw new ToolkitRuntimeError("E_MEDIA_INCOMPATIBLE", "Pipeline final output does not satisfy the declared output codec.", { details: { expectedCodec: codec, actualCodec: actual ?? null, output: document.output.path } });
}
//# sourceMappingURL=validation.js.map