import { ToolkitRuntimeError } from "../core/errors.js";
import { buildFitFilters } from "../media/fit.js";
function positiveInteger(value, fallback, name) {
    const resolved = value ?? fallback;
    if (resolved === undefined || !Number.isInteger(resolved) || resolved <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must resolve to a positive integer.`, {
            details: { requested: value, fallback },
        });
    }
    return resolved;
}
export function resolveVideoNormalization(media, options) {
    const first = media[0]?.video[0];
    if (!first) {
        throw new ToolkitRuntimeError("E_MEDIA_NO_MATCHING_STREAM", "Composition requires at least one video stream.");
    }
    return {
        width: positiveInteger(options.width, first.width, "width"),
        height: positiveInteger(options.height, first.height, "height"),
        fps: positiveInteger(options.fps, 30, "fps"),
        pixelFormat: options.pixelFormat ?? "yuv420p",
        fit: options.fit ?? "contain",
        background: options.background ?? "black",
    };
}
export function videoNormalizationFilters(normalization) {
    const { width, height, fps, pixelFormat, fit, background } = normalization;
    return [
        ...buildFitFilters({ width, height, fit, background }),
        "setpts=PTS-STARTPTS",
        `fps=${fps}`,
        `format=${pixelFormat}`,
        "settb=AVTB",
    ];
}
export const AUDIO_NORMALIZATION_FILTERS = ["aresample=48000", "asetpts=PTS-STARTPTS"];
//# sourceMappingURL=normalization.js.map