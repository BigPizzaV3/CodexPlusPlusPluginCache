import { renderCommandForDisplay } from "../core/command-result.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { resolveReadableFile } from "../media/io.js";
import { formatNumber, inspectAudioInput, nonNegativeFinite, positiveFinite, requireAudio } from "./helpers.js";
const START_PATTERN = /silence_start:\s*(-?\d+(?:\.\d+)?)/g;
const END_PATTERN = /silence_end:\s*(-?\d+(?:\.\d+)?)(?:\s*\|\s*silence_duration:\s*(\d+(?:\.\d+)?))?/g;
export function parseSilenceDetectOutput(stderr) {
    const events = [];
    for (const match of stderr.matchAll(START_PATTERN)) {
        const value = Number(match[1]);
        if (Number.isFinite(value))
            events.push({ type: "start", value, index: match.index ?? 0 });
    }
    for (const match of stderr.matchAll(END_PATTERN)) {
        const value = Number(match[1]);
        const duration = match[2] === undefined ? undefined : Number(match[2]);
        if (Number.isFinite(value)) {
            events.push({ type: "end", value, ...(duration !== undefined && Number.isFinite(duration) ? { duration } : {}), index: match.index ?? 0 });
        }
    }
    events.sort((left, right) => left.index - right.index);
    const intervals = [];
    let start;
    for (const event of events) {
        if (event.type === "start") {
            start = event.value;
            continue;
        }
        if (start === undefined)
            continue;
        const end = Math.max(start, event.value);
        const duration = event.duration ?? end - start;
        intervals.push({ start, end, duration: Math.max(0, duration) });
        start = undefined;
    }
    return intervals;
}
function validateNoiseDb(value) {
    nonNegativeFinite(Math.abs(value), "noiseDb magnitude");
    if (!Number.isFinite(value) || value < -120 || value > 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "noiseDb must be between -120 and 0 dB.", { details: { noiseDb: value } });
    }
    return value;
}
export async function detectSilence(input, request = {}) {
    const source = await resolveReadableFile(input, request.cwd);
    const noiseDb = validateNoiseDb(request.noiseDb ?? -30);
    const minDuration = positiveFinite(request.minDuration ?? 0.5, "minDuration");
    const inputMedia = await inspectAudioInput(source, request);
    requireAudio(inputMedia, source);
    const args = [
        "-hide_banner",
        "-nostats",
        "-i", source,
        "-map", "0:a:0",
        "-af", `silencedetect=noise=${formatNumber(noiseDb)}dB:d=${formatNumber(minDuration)}`,
        "-f", "null",
        "-",
    ];
    const execution = await runFFmpeg(args, {
        ...(request.ffmpegPath !== undefined ? { ffmpegPath: request.ffmpegPath } : {}),
        ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
        ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
        ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
        maxCaptureBytes: 16 * 1024 * 1024,
    });
    const invocation = renderCommandForDisplay({ binary: execution.binary, args: execution.args, ...(execution.cwd !== undefined ? { cwd: execution.cwd } : {}) });
    if (!execution.executed) {
        return {
            operation: "detect-silence",
            source,
            planned: true,
            invocation,
            execution,
            inputMedia,
            noiseDb,
            minDuration,
            silences: [],
            totalSilenceDuration: 0,
            ...(inputMedia.format.durationSeconds !== undefined ? { mediaDuration: inputMedia.format.durationSeconds } : {}),
            warnings: [],
        };
    }
    if (execution.stderrTruncated) {
        throw new ToolkitRuntimeError("E_FFMPEG_EXECUTION_FAILED", "Silence detection output exceeded the capture limit.", {
            details: { source, captureLimitBytes: 16 * 1024 * 1024 },
        });
    }
    const silences = parseSilenceDetectOutput(execution.stderr ?? "");
    const totalSilenceDuration = silences.reduce((sum, interval) => sum + interval.duration, 0);
    const mediaDuration = inputMedia.format.durationSeconds;
    const warnings = [];
    if (silences.length === 0) {
        warnings.push({ code: "W_NO_SILENCE_DETECTED", message: "No silence interval matched the configured threshold and minimum duration." });
    }
    return {
        operation: "detect-silence",
        source,
        planned: false,
        invocation,
        execution,
        inputMedia,
        noiseDb,
        minDuration,
        silences,
        totalSilenceDuration,
        ...(mediaDuration !== undefined ? { mediaDuration, nonSilentDuration: Math.max(0, mediaDuration - totalSilenceDuration) } : {}),
        warnings,
    };
}
//# sourceMappingURL=silence-detect.js.map