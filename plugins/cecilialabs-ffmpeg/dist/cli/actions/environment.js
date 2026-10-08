import { exitCodeForError, ToolkitRuntimeError } from "../../core/index.js";
import { inspectDoctor } from "../../environment/doctor.js";
import { inspectEnvironmentCapabilities } from "../../environment/capabilities.js";
import { inspectEnvironmentReadiness } from "../../environment/readiness.js";
import { installCommand, installToolkit } from "../../environment/install.js";
import { inspectEnvironmentVersions } from "../../environment/version.js";
import { probeMedia } from "../../media/probe.js";
import { executeAction } from "./shared.js";
function formatBytes(bytes) {
    if (bytes === undefined)
        return "unknown";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    let value = bytes;
    let unit = 0;
    while (Math.abs(value) >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}
function formatDuration(seconds) {
    if (seconds === undefined)
        return "unknown";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${remainder.toFixed(3).padStart(6, "0")}`;
}
function wrapNames(names, indent = "  ", width = 100) {
    if (names.length === 0)
        return [`${indent}(none)`];
    const lines = [];
    let current = indent;
    for (const name of names) {
        const piece = current.trim().length === 0 ? name : `${current === indent ? "" : ", "}${name}`;
        if (current.length + piece.length > width && current !== indent) {
            lines.push(current);
            current = `${indent}${name}`;
        }
        else {
            current += piece;
        }
    }
    if (current !== indent)
        lines.push(current);
    return lines;
}
function renderVersions(report) {
    if (report.planned) {
        return [
            "Environment version inspection (dry run)",
            `FFmpeg:  ${report.ffmpeg.path}`,
            `FFprobe: ${report.ffprobe.path}`,
            `Minimum supported FFmpeg: ${report.minimumSupportedFFmpeg}`,
        ].join("\n");
    }
    return [
        "Environment versions",
        `FFmpeg:  ${report.ffmpeg.version?.version ?? "unknown"} (${report.ffmpeg.path})`,
        `FFprobe: ${report.ffprobe.version?.version ?? "unknown"} (${report.ffprobe.path})`,
        `Minimum supported FFmpeg: ${report.minimumSupportedFFmpeg}`,
        `Compatible: ${report.compatible === undefined ? "unknown" : report.compatible ? "yes" : "no"}`,
    ].join("\n");
}
function renderCapabilities(report) {
    if (report.planned) {
        return ["Capability inspection (dry run)", ...report.plannedCommands.map((command) => `  ${command}`)].join("\n");
    }
    const lines = [
        `FFmpeg: ${report.ffmpegPath}`,
        `Codecs (${report.codecs.length})`,
        ...wrapNames(report.codecs.map((item) => item.name)),
        `Encoders (${report.encoders.length})`,
        ...wrapNames(report.encoders.map((item) => item.name)),
        `Decoders (${report.decoders.length})`,
        ...wrapNames(report.decoders.map((item) => item.name)),
        `Filters (${report.filters.length})`,
        ...wrapNames(report.filters.map((item) => item.name)),
        `Hardware acceleration methods (${report.hardwareAcceleration.methods.length})`,
        ...wrapNames(report.hardwareAcceleration.methods),
        "Hardware backend summary",
    ];
    for (const backend of report.hardwareAcceleration.backends) {
        lines.push(`  ${backend.name}: ${backend.compiled ? "reported/compiled" : "not reported"}`);
        if (backend.encoders.length > 0)
            lines.push(`    encoders: ${backend.encoders.join(", ")}`);
        if (backend.decoders.length > 0)
            lines.push(`    decoders: ${backend.decoders.join(", ")}`);
    }
    lines.push(`Note: ${report.hardwareAcceleration.note}`);
    return lines.join("\n");
}
function renderDoctor(report) {
    const lines = [
        `FFmpeg Media Toolkit doctor: ${report.status.toUpperCase()}`,
        `Platform: ${report.runtime.platform} ${report.runtime.architecture}`,
        `Node: ${report.runtime.nodeVersion}`,
        `FFmpeg: ${report.versions.ffmpeg.version?.version ?? (report.planned ? "planned" : "unknown")}`,
        `  ${report.versions.ffmpeg.path}`,
        `FFprobe: ${report.versions.ffprobe.version?.version ?? (report.planned ? "planned" : "unknown")}`,
        `  ${report.versions.ffprobe.path}`,
        `Minimum FFmpeg: ${report.versions.minimumSupportedFFmpeg}`,
        `Capabilities: ${report.capabilitySummary.codecs} codecs, ${report.capabilitySummary.encoders} encoders, ${report.capabilitySummary.decoders} decoders, ${report.capabilitySummary.filters} filters`,
        `Hardware methods: ${report.capabilitySummary.hardwareMethods.join(", ") || "none reported"}`,
    ];
    for (const backend of report.capabilitySummary.backends) {
        if (!backend.compiled)
            continue;
        const details = [
            ...(backend.encoders.length > 0 ? [`encoders=${backend.encoders.join(",")}`] : []),
            ...(backend.decoders.length > 0 ? [`decoders=${backend.decoders.join(",")}`] : []),
            ...(backend.reportedMethods.length > 0 ? [`methods=${backend.reportedMethods.join(",")}`] : []),
        ];
        lines.push(`  ${backend.name}: ${details.join(" | ") || "reported"}`);
    }
    return lines.join("\n");
}
function streamLine(stream) {
    const codec = stream.codecName ?? "unknown";
    if (stream.codecType === "video") {
        const dimensions = stream.width !== undefined && stream.height !== undefined ? `${stream.width}x${stream.height}` : "unknown-size";
        const fps = stream.averageFrameRate ?? stream.realFrameRate;
        return `#${stream.index} video ${codec} ${dimensions}${stream.pixelFormat ? ` ${stream.pixelFormat}` : ""}${fps ? ` fps=${fps}` : ""}`;
    }
    if (stream.codecType === "audio") {
        return `#${stream.index} audio ${codec}${stream.sampleRate ? ` ${stream.sampleRate}Hz` : ""}${stream.channels ? ` ${stream.channels}ch` : ""}${stream.channelLayout ? ` ${stream.channelLayout}` : ""}`;
    }
    return `#${stream.index} ${stream.codecType} ${codec}`;
}
function renderProbe(report) {
    if (report.planned)
        return `Probe dry run\n  ${report.invocation}`;
    const media = report.media;
    if (!media)
        return "Probe completed without normalized media information.";
    const lines = [
        `Source: ${media.source}`,
        `Format: ${media.format.formatLongName ?? media.format.formatName ?? "unknown"}`,
        `Duration: ${formatDuration(media.format.durationSeconds)}`,
        `Size: ${formatBytes(media.format.sizeBytes)}`,
        `Bitrate: ${media.format.bitrate !== undefined ? `${Math.round(media.format.bitrate / 1000)} kb/s` : "unknown"}`,
        `Streams (${media.streams.length})`,
        ...media.streams.map((stream) => `  ${streamLine(stream)}`),
    ];
    return lines.join("\n");
}
function contextOption(command, fallback = "terminal") {
    const value = command.optsWithGlobals()["context"];
    if (value === undefined)
        return fallback;
    if (value === "chatgpt-regular" || value === "chatgpt-work" || value === "codex" || value === "ide" || value === "terminal" || value === "unknown") {
        return value;
    }
    throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Unknown execution context.", {
        details: { context: value, supported: ["chatgpt-regular", "chatgpt-work", "codex", "ide", "terminal", "unknown"] },
    });
}
function renderEnvironmentCheck(report) {
    const lines = [
        `Environment check: ${report.status.toUpperCase()}`,
        `Context: ${report.context.name} (${report.context.source})`,
        `Platform: ${report.observed.platform} ${report.observed.architecture}`,
        `Node: ${report.runtime.node.version ?? "unknown"} (${report.runtime.node.path ?? "unresolved"})`,
        `npm: ${report.runtime.npm.version ?? (report.runtime.npm.available ? "available" : "missing")} (${report.runtime.npm.path ?? "unresolved"})`,
        `Toolkit: ${report.toolkit.available ? report.toolkit.path ?? "available" : "missing"}`,
        `FFmpeg: ${report.ffmpeg.version ?? (report.ffmpeg.available ? "available" : "missing")} (${report.ffmpeg.path ?? "unresolved"})`,
        `FFprobe: ${report.ffprobe.version ?? (report.ffprobe.available ? "available" : "missing")} (${report.ffprobe.path ?? "unresolved"})`,
    ];
    if (report.capabilities !== undefined) {
        lines.push(`Capabilities: ${report.capabilities.codecs.length} codecs, ${report.capabilities.encoders.length} encoders, ${report.capabilities.decoders.length} decoders, ${report.capabilities.filters.length} filters`, `Hardware: ${report.capabilities.hardwareAcceleration.methods.join(", ") || "none reported"}`);
    }
    if (report.output !== undefined)
        lines.push(`Output path: ${report.output.path} (${report.output.writable ? "writable" : "not writable"})`);
    if (report.next.length > 0)
        lines.push("Next:\n  " + report.next.join("\n  "));
    return lines.join("\n");
}
export async function runDoctorAction(command) {
    await executeAction(command, async (options, signal) => {
        const report = await inspectDoctor({
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
            dryRun: options.dryRun,
            verbose: options.verbose,
            signal,
        });
        return {
            data: report,
            warnings: report.warnings,
            ...(report.status === "error" ? { exitCode: exitCodeForError("E_ENV_UNSUPPORTED_FFMPEG") } : {}),
        };
    }, renderDoctor);
}
export async function runEnvironmentVersionAction(command) {
    await executeAction(command, async (options, signal) => {
        const report = await inspectEnvironmentVersions({
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
            dryRun: options.dryRun,
            verbose: options.verbose,
            signal,
        });
        return { data: report, warnings: report.warnings };
    }, renderVersions);
}
export async function runEnvironmentCapabilitiesAction(command) {
    await executeAction(command, async (options, signal) => ({
        data: await inspectEnvironmentCapabilities({
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            dryRun: options.dryRun,
            verbose: options.verbose,
            signal,
        }),
    }), renderCapabilities);
}
export async function runEnvironmentCheckAction(command) {
    await executeAction(command, async (options, signal) => {
        const raw = command.optsWithGlobals();
        const report = await inspectEnvironmentReadiness({
            // The CLI is an executable terminal path; callers can override this to
            // deliberately render the regular-Chat or Work contract.
            context: contextOption(command, "terminal"),
            ...(typeof raw["outputPath"] === "string" ? { outputPath: raw["outputPath"] } : {}),
            ...(typeof raw["toolkitPath"] === "string" ? { toolkitPath: raw["toolkitPath"] } : {}),
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
            dryRun: options.dryRun,
            verbose: options.verbose,
            signal,
        });
        return { data: report, warnings: report.warnings };
    }, renderEnvironmentCheck);
}
export async function runProbeAction(command, positional) {
    await executeAction(command, async (options, signal) => {
        const input = positional[0];
        if (typeof input !== "string" || input.length === 0) {
            throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", "probe requires an input path.");
        }
        const report = await probeMedia(input, {
            ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
            dryRun: options.dryRun,
            verbose: options.verbose,
            signal,
        });
        return { data: report, execution: report.execution };
    }, renderProbe);
}
export async function runEnvironmentInstallAction(command, positional) {
    await executeAction(command, async (_options, signal) => {
        const raw = command.optsWithGlobals();
        const scope = (typeof positional[0] === "string" ? positional[0] : raw["scope"] ?? "npm-exec");
        if (scope !== "global" && scope !== "local" && scope !== "npm-exec") {
            throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Unknown installation scope.", {
                details: { scope, supported: ["global", "local", "npm-exec"] },
            });
        }
        const apply = raw["apply"] === true;
        const authorized = raw["authorize"] === true;
        const install = await installToolkit({
            scope,
            context: contextOption(command, "terminal"),
            authorized: apply && authorized,
            dryRun: Boolean(_options.dryRun),
            signal,
        });
        const readiness = install.status === "completed"
            ? await inspectEnvironmentReadiness({ context: contextOption(command, "terminal"), signal })
            : undefined;
        return {
            data: { install, ...(readiness !== undefined ? { readiness } : {}) },
            ...(install.execution !== undefined ? { execution: install.execution } : {}),
            ...(install.status === "planned"
                ? { warnings: [{ code: "W_INSTALL_NOT_APPLIED", message: "Installation was planned only. Pass --apply --authorize to execute it." }] }
                : {}),
        };
    }, (data) => {
        const plan = data.install.plan;
        return [
            `Installation ${data.install.status}: ${installCommand(plan)}`,
            data.install.status === "planned" ? "Pass --apply --authorize to execute this explicit installation." : "Repeat environment check to verify the installed runtime.",
        ].join("\n");
    });
}
//# sourceMappingURL=environment.js.map