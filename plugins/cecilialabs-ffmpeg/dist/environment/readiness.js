import os from "node:os";
import path from "node:path";
import { runCommand } from "../core/command-result.js";
import { resolveBinary } from "../core/binary-resolver.js";
import { isToolkitRuntimeError } from "../core/errors.js";
import { inspectWritablePath, resolveSafePath } from "../skill-runtime/paths.js";
import { getExecutionContext, contextGuidance } from "../skill-runtime/context.js";
import { inspectEnvironmentCapabilities } from "./capabilities.js";
import { resolveExecutable } from "./executable.js";
import { inspectEnvironmentVersions } from "./version.js";
function versionFrom(execution) {
    return [execution.stdout, execution.stderr]
        .flatMap((value) => value?.split(/\r?\n/) ?? [])
        .map((line) => line.trim())
        .find((line) => line.length > 0);
}
function nodeIsSupported(version) {
    const major = Number(/^v?(\d+)/.exec(version)?.[1] ?? "0");
    return Number.isInteger(major) && major >= 22;
}
function warning(warnings, code, message, details) {
    warnings.push({ code, message, ...(details !== undefined ? { details } : {}) });
}
function missingReason(kind, error) {
    if (isToolkitRuntimeError(error))
        return error.message;
    return `${kind} could not be resolved.`;
}
function plannedCommands(options) {
    const ffmpeg = options.ffmpegPath ?? "ffmpeg";
    const ffprobe = options.ffprobePath ?? "ffprobe";
    return [
        "node --version",
        "npm --version",
        `${ffmpeg} -version`,
        `${ffprobe} -version`,
        `${ffmpeg} -hide_banner -codecs`,
        `${ffmpeg} -hide_banner -encoders`,
        `${ffmpeg} -hide_banner -decoders`,
        `${ffmpeg} -hide_banner -filters`,
        `${ffmpeg} -hide_banner -hwaccels`,
    ];
}
function statusFor(context, versions, capabilities, warnings, planned) {
    if (planned || !context.canExecuteScripts)
        return "planned";
    if (!versions?.ffmpeg.version || !versions.ffprobe.version)
        return "blocked";
    if (versions.compatible === false || capabilities === undefined)
        return "warning";
    return warnings.length > 0 ? "warning" : "ready";
}
function summarizeVersions(report) {
    return {
        planned: report.planned,
        minimumSupportedFFmpeg: report.minimumSupportedFFmpeg,
        ffmpeg: {
            path: report.ffmpeg.path,
            ...(report.ffmpeg.version !== undefined ? { version: report.ffmpeg.version.version } : {}),
        },
        ffprobe: {
            path: report.ffprobe.path,
            ...(report.ffprobe.version !== undefined ? { version: report.ffprobe.version.version } : {}),
        },
        ...(report.compatible !== undefined ? { compatible: report.compatible } : {}),
        warnings: report.warnings,
    };
}
function summarizeCapabilities(report) {
    return {
        planned: report.planned,
        ffmpegPath: report.ffmpegPath,
        codecs: report.codecs.map((item) => item.name),
        encoders: report.encoders.map((item) => item.name),
        decoders: report.decoders.map((item) => item.name),
        filters: report.filters.map((item) => item.name),
        hardwareAcceleration: report.hardwareAcceleration,
        plannedCommands: [...report.plannedCommands],
    };
}
/**
 * Inspect the host without installing packages or changing shell state.
 * Missing FFmpeg-family binaries are reported as readiness facts, not thrown
 * away as an opaque command failure.
 */
export async function inspectEnvironmentReadiness(options = {}) {
    const environment = options.environment ?? process.env;
    const cwd = resolveSafePath(options.cwd ?? process.cwd(), { allowAbsolute: true });
    const context = getExecutionContext(options.context, environment);
    const warnings = [];
    const next = contextGuidance(context);
    const planned = options.dryRun === true || !context.canExecuteScripts;
    const nodeCompatible = nodeIsSupported(process.version);
    const report = {
        status: planned ? "planned" : "blocked",
        context,
        observed: {
            platform: process.platform,
            architecture: process.arch,
            hostname: os.hostname(),
            cwd,
            canInspectFiles: context.canInspectFiles,
            canExecuteScripts: context.canExecuteScripts,
            canInstallDependencies: context.canInstallDependencies,
        },
        runtime: {
            node: {
                available: true,
                path: process.execPath,
                version: process.version,
                minimumSupported: "22.0.0",
                compatible: nodeCompatible,
            },
            npm: { available: false },
        },
        toolkit: { available: false },
        ffmpeg: { available: false, minimumSupported: "6.1" },
        ffprobe: { available: false },
        plannedCommands: planned ? plannedCommands(options) : [],
        warnings,
        next,
    };
    if (!nodeCompatible) {
        warning(warnings, "W_ENV_UNSUPPORTED_NODE", `Node.js ${process.version} is below the supported minimum 22.0.0.`);
        report.next.push("Use Node.js 22 or newer, then repeat the environment check.");
    }
    if (planned) {
        warning(warnings, "W_CONTEXT_NOT_EXECUTED", "Environment commands were not executed in this context.");
        if (context.name === "chatgpt-regular") {
            report.next.push("npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg environment check --json");
        }
        return report;
    }
    const npmPath = await resolveExecutable("npm", { cwd, env: environment });
    if (npmPath !== undefined) {
        const npmExecution = await runCommand({ binary: npmPath, args: ["--version"], cwd, env: environment }, {
            ...(options.signal !== undefined ? { signal: options.signal } : {}),
            ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        });
        const npmVersion = versionFrom(npmExecution);
        report.runtime.npm = {
            available: npmExecution.exitCode === 0,
            path: npmPath,
            ...(npmVersion !== undefined ? { version: npmVersion } : {}),
        };
    }
    else {
        warning(warnings, "W_ENV_NPM_NOT_FOUND", "npm is not available on PATH; package installation cannot be performed.");
        report.next.push("Install Node.js 22+ with npm, then repeat the environment check.");
    }
    const toolkitPath = await resolveExecutable("cecilia-ffmpeg", {
        cwd,
        env: environment,
        ...(options.toolkitPath !== undefined ? { explicitPath: options.toolkitPath } : {}),
    });
    if (toolkitPath !== undefined)
        report.toolkit = { available: true, path: toolkitPath };
    else
        report.next.push("Install @cecilialabs/ffmpeg globally, locally, or use the explicit npm exec fallback.");
    let ffmpegPath;
    try {
        ffmpegPath = await resolveBinary({
            kind: "ffmpeg",
            ...(options.ffmpegPath !== undefined ? { explicitPath: options.ffmpegPath } : {}),
            cwd,
            env: environment,
        });
        report.ffmpeg = { available: true, path: ffmpegPath, minimumSupported: "6.1" };
    }
    catch (error) {
        report.ffmpeg = {
            available: false,
            minimumSupported: "6.1",
            error: missingReason("ffmpeg", error),
        };
        warning(warnings, "W_ENV_FFMPEG_NOT_FOUND", report.ffmpeg.error ?? "FFmpeg is unavailable.");
        report.next.push("Install FFmpeg 6.1+ or provide an explicit --ffmpeg-path.");
    }
    let ffprobePath;
    try {
        ffprobePath = await resolveBinary({
            kind: "ffprobe",
            ...(options.ffprobePath !== undefined ? { explicitPath: options.ffprobePath } : {}),
            cwd,
            env: environment,
        });
        report.ffprobe = { available: true, path: ffprobePath };
    }
    catch (error) {
        report.ffprobe = { available: false, error: missingReason("ffprobe", error) };
        warning(warnings, "W_ENV_FFPROBE_NOT_FOUND", report.ffprobe.error ?? "FFprobe is unavailable.");
        report.next.push("Install FFprobe alongside FFmpeg or provide an explicit --ffprobe-path.");
    }
    let versions;
    let capabilities;
    if (ffmpegPath !== undefined && ffprobePath !== undefined) {
        try {
            versions = await inspectEnvironmentVersions({
                ffmpegPath,
                ffprobePath,
                ...(options.signal !== undefined ? { signal: options.signal } : {}),
                ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
            });
            report.versions = summarizeVersions(versions);
            report.ffmpeg = {
                ...report.ffmpeg,
                ...(versions.ffmpeg.version !== undefined
                    ? { version: versions.ffmpeg.version.version }
                    : {}),
                ...(versions.compatible !== undefined ? { compatible: versions.compatible } : {}),
            };
            report.ffprobe = {
                ...report.ffprobe,
                ...(versions.ffprobe.version !== undefined
                    ? { version: versions.ffprobe.version.version }
                    : {}),
            };
            for (const item of versions.warnings)
                warning(warnings, item.code, item.message, item.details);
            if (versions.compatible === false) {
                report.next.push("Use FFmpeg 6.1 or newer for the supported toolkit runtime.");
            }
        }
        catch (error) {
            warning(warnings, "W_ENV_VERSION_CHECK_FAILED", "FFmpeg/FFprobe version inspection failed.", {
                message: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            capabilities = await inspectEnvironmentCapabilities({
                ffmpegPath,
                ...(options.signal !== undefined ? { signal: options.signal } : {}),
                ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
            });
            report.capabilities = summarizeCapabilities(capabilities);
        }
        catch (error) {
            warning(warnings, "W_ENV_CAPABILITY_CHECK_FAILED", "FFmpeg capability inspection failed.", {
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    if (options.outputPath !== undefined) {
        try {
            report.output = await inspectWritablePath(options.outputPath, { cwd });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warning(warnings, "W_OUTPUT_PATH_UNWRITABLE", message, {
                path: path.resolve(cwd, options.outputPath),
            });
            report.next.push("Choose an output path whose parent directory exists and is writable.");
        }
    }
    report.status = statusFor(context, versions, capabilities, warnings, false);
    return report;
}
//# sourceMappingURL=readiness.js.map