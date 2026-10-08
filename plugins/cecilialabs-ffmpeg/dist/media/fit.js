import { ToolkitRuntimeError } from "../core/errors.js";
function safeColor(value) {
    if (!/^(?:[A-Za-z]+|#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?)$/.test(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "background must be a named color or #RRGGBB/#RRGGBBAA value.", { details: { background: value } });
    }
    return value;
}
export function buildFitFilters(options) {
    const width = Math.trunc(options.width);
    const height = Math.trunc(options.height);
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "fit width/height must be positive integers.", {
            details: { width: options.width, height: options.height },
        });
    }
    const fit = options.fit ?? "contain";
    const flags = options.flags ?? "lanczos";
    const background = safeColor(options.background ?? "black");
    if (fit === "stretch") {
        return [`scale=${width}:${height}:flags=${flags}`];
    }
    if (fit === "cover") {
        return [
            `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=${flags}`,
            `crop=${width}:${height}`,
        ];
    }
    return [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=${flags}`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${background}`,
    ];
}
//# sourceMappingURL=fit.js.map