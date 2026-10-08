import { z } from "zod";
import { ToolkitRuntimeError } from "../../core/errors.js";
import { addSilenceToVideo, attachAudio, detectSilence, generateSilence, removeSilence, transcodeTelephony, } from "../../audio/index.js";
import { executeAction } from "./shared.js";
const positiveNumber = z.coerce.number().finite().positive();
const nonNegativeNumber = z.coerce.number().finite().nonnegative();
const integer = z.coerce.number().int();
const noiseDb = z.coerce.number().finite().min(-120).max(0);
function positionalAt(positional, index, commandName, label) {
    const value = positional[index];
    if (typeof value !== "string" || value.length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", `${commandName} requires ${label}.`);
    }
    return value;
}
function localOptions(command) {
    return command.opts();
}
function runtimeOptions(global, signal) {
    return {
        ...(global.output !== undefined ? { output: global.output } : {}),
        overwrite: global.overwrite,
        dryRun: global.dryRun,
        verbose: global.verbose,
        ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
        ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
        signal,
        keepTemp: global.keepTemp,
    };
}
function renderAudioReport(report) {
    const lines = [
        `${report.operation}${report.planned ? " (dry run)" : ""}`,
        ...(report.sources.length > 0 ? report.sources.map((source, index) => `Input ${index + 1}: ${source}`) : []),
        `Output: ${report.output}`,
        `Command: ${report.invocation}`,
    ];
    const outputAudio = report.outputMedia?.audio[0];
    if (outputAudio) {
        const details = [
            outputAudio.codecName,
            outputAudio.sampleRate !== undefined ? `${outputAudio.sampleRate} Hz` : undefined,
            outputAudio.channels !== undefined ? `${outputAudio.channels} ch` : undefined,
        ].filter((value) => value !== undefined);
        if (details.length > 0)
            lines.push(`Result: ${details.join(", ")}`);
    }
    return lines.join("\n");
}
function renderSilenceDetection(report) {
    const lines = [
        `detect-silence${report.planned ? " (dry run)" : ""}`,
        `Input: ${report.source}`,
        `Threshold: ${report.noiseDb} dB`,
        `Minimum duration: ${report.minDuration}s`,
        `Intervals: ${report.silences.length}`,
    ];
    for (const [index, interval] of report.silences.entries()) {
        lines.push(`  ${index + 1}. ${interval.start.toFixed(3)}s → ${interval.end.toFixed(3)}s (${interval.duration.toFixed(3)}s)`);
    }
    if (!report.planned)
        lines.push(`Total silence: ${report.totalSilenceDuration.toFixed(3)}s`);
    return lines.join("\n");
}
export async function runAudioAttachAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            mode: z.enum(["replace", "append"]).default("replace"),
            videoMode: z.enum(["auto", "copy", "encode"]).default("auto"),
            pad: z.boolean().default(true),
        }).parse(localOptions(command));
        const report = await attachAudio(positionalAt(positional, 0, "audio attach", "a video input"), positionalAt(positional, 1, "audio attach", "an audio input"), { ...runtimeOptions(global, signal), mode: parsed.mode, videoMode: parsed.videoMode, pad: parsed.pad });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderAudioReport);
}
export async function runAudioSilenceAction(command) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            duration: positiveNumber.default(1),
            sampleRate: integer.min(1000).max(384000).default(48000),
            channels: integer.min(1).max(32).default(2),
            channelLayout: z.string().min(1).optional(),
        }).parse(localOptions(command));
        const report = await generateSilence({
            ...runtimeOptions(global, signal),
            duration: parsed.duration,
            sampleRate: parsed.sampleRate,
            channels: parsed.channels,
            ...(parsed.channelLayout !== undefined ? { channelLayout: parsed.channelLayout } : {}),
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderAudioReport);
}
export async function runAudioAddSilenceAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            sampleRate: integer.min(1000).max(384000).default(48000),
            channels: integer.min(1).max(32).default(2),
            channelLayout: z.string().min(1).optional(),
            videoMode: z.enum(["auto", "copy", "encode"]).default("auto"),
            replaceExisting: z.boolean().default(false),
        }).parse(localOptions(command));
        const report = await addSilenceToVideo(positionalAt(positional, 0, "audio add-silence", "a video input"), {
            ...runtimeOptions(global, signal),
            sampleRate: parsed.sampleRate,
            channels: parsed.channels,
            ...(parsed.channelLayout !== undefined ? { channelLayout: parsed.channelLayout } : {}),
            videoMode: parsed.videoMode,
            replaceExisting: parsed.replaceExisting,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderAudioReport);
}
export async function runAudioDetectSilenceAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({ noiseDb: noiseDb.default(-30), minDuration: positiveNumber.default(0.5) }).parse(localOptions(command));
        const report = await detectSilence(positionalAt(positional, 0, "audio detect-silence", "an input"), {
            ...runtimeOptions(global, signal),
            noiseDb: parsed.noiseDb,
            minDuration: parsed.minDuration,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderSilenceDetection);
}
export async function runAudioRemoveSilenceAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            noiseDb: noiseDb.default(-30),
            minDuration: positiveNumber.default(0.5),
            keepSilence: nonNegativeNumber.default(0.05),
        }).parse(localOptions(command));
        const report = await removeSilence(positionalAt(positional, 0, "audio remove-silence", "an audio input"), {
            ...runtimeOptions(global, signal),
            noiseDb: parsed.noiseDb,
            minDuration: parsed.minDuration,
            keepSilence: parsed.keepSilence,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderAudioReport);
}
export async function runAudioTelephonyAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            codec: z.enum(["mulaw", "alaw", "gsm", "pcm"]),
            container: z.enum(["wav", "mulaw", "alaw", "gsm", "s16le"]).optional(),
            sampleRate: integer.min(1000).max(192000).default(8000),
            channels: integer.min(1).max(8).default(1),
            sampleFormat: z.string().min(1).default("s16"),
        }).parse(localOptions(command));
        const report = await transcodeTelephony(positionalAt(positional, 0, "audio telephony", "an audio input"), {
            ...runtimeOptions(global, signal),
            codec: parsed.codec,
            ...(parsed.container !== undefined ? { container: parsed.container } : {}),
            sampleRate: parsed.sampleRate,
            channels: parsed.channels,
            sampleFormat: parsed.sampleFormat,
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderAudioReport);
}
//# sourceMappingURL=audio.js.map