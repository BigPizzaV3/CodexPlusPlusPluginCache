import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { probeMedia } from "../media/probe.js";
function rational(value) {
    if (!value)
        return undefined;
    const [left, right] = value.split("/");
    if (left === undefined || right === undefined)
        return undefined;
    const numerator = Number(left);
    const denominator = Number(right);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
        return undefined;
    return numerator / denominator;
}
function staticIssues(media) {
    const issues = [];
    if (media.video.length === 0) {
        issues.push({ code: "MISSING_VIDEO_STREAM", severity: "info", message: "No video stream is present." });
    }
    if (media.audio.length === 0) {
        issues.push({ code: "MISSING_AUDIO_STREAM", severity: "info", message: "No audio stream is present." });
    }
    if (media.video.length > 1) {
        issues.push({ code: "MULTIPLE_VIDEO_STREAMS", severity: "info", message: `Media contains ${media.video.length} video streams.` });
    }
    if (media.audio.length > 1) {
        issues.push({ code: "MULTIPLE_AUDIO_STREAMS", severity: "info", message: `Media contains ${media.audio.length} audio streams.` });
    }
    for (const stream of media.streams) {
        if (stream.timeBase) {
            const tb = rational(stream.timeBase);
            if (tb === undefined || tb <= 0) {
                issues.push({
                    code: "INVALID_TIME_BASE",
                    severity: "error",
                    message: `Stream ${stream.index} reports an invalid time base (${stream.timeBase}).`,
                    streamIndex: stream.index,
                    details: { timeBase: stream.timeBase },
                });
            }
        }
        if (stream.startTimeSeconds !== undefined && stream.startTimeSeconds < -0.001) {
            issues.push({
                code: "NEGATIVE_START_TIME",
                severity: "warning",
                message: `Stream ${stream.index} starts before zero (${stream.startTimeSeconds}s).`,
                streamIndex: stream.index,
                details: { startTimeSeconds: stream.startTimeSeconds },
            });
        }
    }
    for (const stream of media.video) {
        const avg = rational(stream.averageFrameRate);
        const real = rational(stream.realFrameRate);
        if (avg !== undefined && real !== undefined && avg > 0 && real > 0) {
            const relativeDifference = Math.abs(avg - real) / Math.max(avg, real);
            if (relativeDifference > 0.05) {
                issues.push({
                    code: "POSSIBLE_VFR",
                    severity: "warning",
                    message: `Video stream ${stream.index} has different average and nominal frame rates.`,
                    streamIndex: stream.index,
                    details: { averageFrameRate: stream.averageFrameRate, realFrameRate: stream.realFrameRate },
                });
            }
        }
        if (stream.sampleAspectRatio && stream.sampleAspectRatio !== "1:1" && stream.sampleAspectRatio !== "0:1") {
            issues.push({
                code: "NON_SQUARE_PIXELS",
                severity: "warning",
                message: `Video stream ${stream.index} uses non-square pixels (${stream.sampleAspectRatio}).`,
                streamIndex: stream.index,
                details: { sampleAspectRatio: stream.sampleAspectRatio, displayAspectRatio: stream.displayAspectRatio },
            });
        }
        if (stream.pixelFormat && !["yuv420p", "yuvj420p", "nv12", "p010le", "rgb24", "rgba", "gray"].includes(stream.pixelFormat)) {
            issues.push({
                code: "PIXEL_FORMAT_INTEROP",
                severity: "info",
                message: `Pixel format ${stream.pixelFormat} may need normalization for broad playback compatibility.`,
                streamIndex: stream.index,
                details: { pixelFormat: stream.pixelFormat },
            });
        }
    }
    const formatNames = (media.format.formatName ?? "").split(",").map((value) => value.trim());
    if (formatNames.includes("matroska") || formatNames.includes("webm")) {
        const looksLikeWebm = formatNames.includes("webm");
        if (looksLikeWebm) {
            const validVideo = new Set(["vp8", "vp9", "av1"]);
            const validAudio = new Set(["opus", "vorbis"]);
            for (const stream of media.video) {
                if (stream.codecName && !validVideo.has(stream.codecName)) {
                    issues.push({ code: "WEBM_CODEC_MISMATCH", severity: "error", message: `WebM video codec ${stream.codecName} is not part of the WebM codec set.`, streamIndex: stream.index, details: { codecName: stream.codecName } });
                }
            }
            for (const stream of media.audio) {
                if (stream.codecName && !validAudio.has(stream.codecName)) {
                    issues.push({ code: "WEBM_CODEC_MISMATCH", severity: "error", message: `WebM audio codec ${stream.codecName} is not part of the WebM codec set.`, streamIndex: stream.index, details: { codecName: stream.codecName } });
                }
            }
        }
    }
    return issues;
}
export function parseDecodeDiagnostics(stderr) {
    const issues = [];
    const lines = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
        const lower = line.toLowerCase();
        let issue;
        if (lower.includes("non-monoton") && (lower.includes("dts") || lower.includes("timestamp"))) {
            issue = { code: "NON_MONOTONIC_DTS", severity: "error", message: line };
        }
        else if (lower.includes("timestamp discontinuity") || lower.includes("discontinuity in stream")) {
            issue = { code: "TIMESTAMP_DISCONTINUITY", severity: "warning", message: line };
        }
        else if (lower.includes("stream map") || lower.includes("matches no streams") || lower.includes("cannot find a matching stream")) {
            issue = { code: "STREAM_MAPPING_ERROR", severity: "error", message: line };
        }
        else if (lower.includes("filtergraph") || lower.includes("error initializing complex filters") || lower.includes("failed to configure output pad") || lower.includes("error reinitializing filters")) {
            issue = { code: "FILTER_GRAPH_ERROR", severity: "error", message: line };
        }
        else if ((lower.includes("pts") || lower.includes("dts")) && (lower.includes("invalid") || lower.includes("out of order") || lower.includes("missing"))) {
            issue = { code: "PTS_DTS_ERROR", severity: "error", message: line };
        }
        else if (lower.includes("corrupt") || lower.includes("invalid nal") || lower.includes("damaged")) {
            issue = { code: "CORRUPT_PACKET", severity: "error", message: line };
        }
        else if (lower.includes("error while decoding") || lower.includes("decode error") || lower.includes("invalid data found")) {
            issue = { code: "DECODE_ERROR", severity: "error", message: line };
        }
        else if (lower.includes("deprecated pixel format") || lower.includes("past duration") || lower.includes("dropping frame")) {
            issue = { code: "DECODE_WARNING", severity: "warning", message: line };
        }
        if (issue && !issues.some((entry) => entry.code === issue?.code && entry.message === issue.message))
            issues.push(issue);
    }
    return issues;
}
export function parseFreezeDiagnostics(stderr) {
    const freezes = [];
    let current;
    for (const line of stderr.split(/\r?\n/)) {
        const start = line.match(/freeze_start:\s*([-+]?\d+(?:\.\d+)?)/);
        if (start?.[1] !== undefined) {
            current = { start: Number(start[1]) };
            freezes.push(current);
            continue;
        }
        const end = line.match(/freeze_end:\s*([-+]?\d+(?:\.\d+)?)/);
        if (end?.[1] !== undefined && current)
            current.end = Number(end[1]);
        const duration = line.match(/freeze_duration:\s*([-+]?\d+(?:\.\d+)?)/);
        if (duration?.[1] !== undefined && current)
            current.duration = Number(duration[1]);
    }
    return freezes;
}
async function decodeScan(source, options) {
    try {
        const execution = await runFFmpeg(["-hide_banner", "-v", "warning", "-i", source, "-map", "0:v?", "-map", "0:a?", "-f", "null", "-"], {
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
            ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
            ...(options.signal !== undefined ? { signal: options.signal } : {}),
            maxCaptureBytes: 4 * 1024 * 1024,
        });
        return { execution, issues: execution.executed ? parseDecodeDiagnostics(execution.stderr ?? "") : [] };
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError && error.code === "E_FFMPEG_EXECUTION_FAILED") {
            const stderr = typeof error.details?.["stderrTail"] === "string" ? error.details["stderrTail"] : "";
            const issues = parseDecodeDiagnostics(stderr);
            if (issues.length === 0)
                issues.push({ code: "DECODE_ERROR", severity: "error", message: "FFmpeg decode scan failed.", ...(error.details !== undefined ? { details: error.details } : {}) });
            return { issues };
        }
        throw error;
    }
}
async function freezeScan(source, options) {
    const noise = options.freezeNoiseDb ?? -50;
    const duration = options.freezeDuration ?? 2;
    try {
        const execution = await runFFmpeg([
            "-hide_banner", "-v", "info", "-i", source,
            "-map", "0:v:0", "-vf", `freezedetect=n=${noise}dB:d=${duration}`, "-an", "-f", "null", "-",
        ], {
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
            ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
            ...(options.signal !== undefined ? { signal: options.signal } : {}),
            maxCaptureBytes: 4 * 1024 * 1024,
        });
        return { execution, freezes: execution.executed ? parseFreezeDiagnostics(execution.stderr ?? "") : [] };
    }
    catch (error) {
        return { freezes: [], warning: { code: "W_FREEZE_SCAN_UNAVAILABLE", message: "Deep freeze scan could not be completed.", details: error instanceof Error ? { error: error.message } : {} } };
    }
}
export async function diagnoseMedia(input, options = {}) {
    const probe = await probeMedia(input, {
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
    if (!probe.media)
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "Unable to inspect media for diagnostics.");
    const issues = staticIssues(probe.media);
    const warnings = [];
    const decode = await decodeScan(probe.source, options);
    issues.push(...decode.issues);
    if (options.logText)
        issues.push(...parseDecodeDiagnostics(options.logText));
    let freezes = [];
    let freezeExecution;
    if (options.deep && probe.media.video.length > 0) {
        const freeze = await freezeScan(probe.source, options);
        freezes = freeze.freezes;
        freezeExecution = freeze.execution;
        if (freeze.warning)
            warnings.push(freeze.warning);
        for (const interval of freezes) {
            issues.push({ code: "FREEZE_DETECTED", severity: "warning", message: `Frozen video interval detected at ${interval.start}s.`, details: { ...interval } });
        }
    }
    return {
        source: probe.source,
        planned: Boolean(options.dryRun),
        media: probe.media,
        issues,
        freezes,
        ...(decode.execution !== undefined ? { decodeExecution: decode.execution } : {}),
        ...(freezeExecution !== undefined ? { freezeExecution } : {}),
        warnings,
    };
}
//# sourceMappingURL=analyze.js.map