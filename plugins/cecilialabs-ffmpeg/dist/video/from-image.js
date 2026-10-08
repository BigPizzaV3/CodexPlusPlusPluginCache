import { hardwareFilterSuffix, hardwareGlobalArgs } from "../hardware/index.js";
import { buildFitFilters } from "../media/fit.js";
import { encodingArgs, resolveEncodingProfile } from "./encoding.js";
import { executeVideoTransform, positiveFinite } from "./helpers.js";
import { resolveVideoHardware, hardwareReportDetails } from "./hardware.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "./io.js";
export async function createVideoFromImage(input, request = {}) {
    const source = await resolveReadableFile(input, request.cwd);
    const duration = positiveFinite(request.duration ?? 5, "duration");
    const width = Math.trunc(positiveFinite(request.width ?? 1920, "width"));
    const height = Math.trunc(positiveFinite(request.height ?? 1080, "height"));
    const fps = positiveFinite(request.fps ?? 30, "fps");
    const pixelFormat = request.pixelFormat ?? "yuv420p";
    const to = request.to ?? "mp4";
    const output = deriveOutputPath(source, "clip", request.output, {
        ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
        defaultExtension: `.${to}`,
    });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const profile = resolveEncodingProfile(output);
    const hardware = await resolveVideoHardware(to, request);
    const filter = [
        ...buildFitFilters({
            width,
            height,
            ...(request.fit !== undefined ? { fit: request.fit } : {}),
            ...(request.background !== undefined ? { background: request.background } : {}),
        }),
        "setsar=1",
        `format=${pixelFormat}`,
        ...(hardware === undefined ? [] : hardwareFilterSuffix(hardware)),
    ].join(",");
    return await executeVideoTransform({
        operation: "from-image",
        source,
        output,
        argsBeforeOutput: [
            ...(hardware === undefined ? [] : hardwareGlobalArgs(hardware)),
            "-loop", "1",
            "-framerate", String(fps),
            "-i", source,
            "-t", String(duration),
            "-vf", filter,
            "-r", String(fps),
            ...encodingArgs(profile, false, hardware),
        ],
        runtime: request,
        details: {
            duration,
            width,
            height,
            fps,
            pixelFormat,
            fit: request.fit ?? "contain",
            background: request.background ?? "black",
            to,
            ...hardwareReportDetails(hardware),
        },
        ...(hardware?.warning !== undefined ? { warnings: [hardware.warning] } : {}),
    });
}
//# sourceMappingURL=from-image.js.map