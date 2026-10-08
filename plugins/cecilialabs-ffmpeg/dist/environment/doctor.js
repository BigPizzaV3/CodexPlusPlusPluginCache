import os from "node:os";
import { inspectEnvironmentCapabilities } from "./capabilities.js";
import { inspectEnvironmentVersions } from "./version.js";
export async function inspectDoctor(options = {}) {
    const shared = {
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
    };
    const [versions, capabilities] = await Promise.all([
        inspectEnvironmentVersions({
            ...shared,
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        }),
        inspectEnvironmentCapabilities({
            ...shared,
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
        }),
    ]);
    const warnings = [...versions.warnings];
    let status = versions.planned || capabilities.planned ? "planned" : "ok";
    if (!versions.planned && versions.compatible === false) {
        status = "error";
        warnings.push({
            code: "W_ENV_UNSUPPORTED_FFMPEG",
            message: `FFmpeg ${versions.ffmpeg.version?.version ?? "unknown"} is below the supported minimum ${versions.minimumSupportedFFmpeg}.`,
        });
    }
    else if (status !== "planned" && warnings.length > 0) {
        status = "warning";
    }
    return {
        status,
        planned: versions.planned || capabilities.planned,
        runtime: {
            platform: process.platform,
            architecture: process.arch,
            nodeVersion: process.version,
            hostname: os.hostname(),
            cpus: os.cpus().length,
        },
        versions,
        capabilitySummary: {
            codecs: capabilities.codecs.length,
            encoders: capabilities.encoders.length,
            decoders: capabilities.decoders.length,
            filters: capabilities.filters.length,
            hardwareMethods: capabilities.hardwareAcceleration.methods,
            backends: capabilities.hardwareAcceleration.backends,
        },
        warnings,
    };
}
//# sourceMappingURL=doctor.js.map