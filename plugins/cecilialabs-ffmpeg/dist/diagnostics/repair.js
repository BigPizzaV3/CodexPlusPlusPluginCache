import path from "node:path";
import { renderCommandForDisplay } from "../core/command-result.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { deriveOutputPath, preflightOutputPath, prepareOutputTransaction, resolveReadableFile } from "../media/io.js";
import { probeMedia } from "../media/probe.js";
import { diagnoseMedia } from "./analyze.js";
function finitePositive(value, fallback) {
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}
function parseRate(value) {
    if (!value)
        return undefined;
    const [a, b] = value.split("/");
    if (a === undefined || b === undefined)
        return undefined;
    const numerator = Number(a);
    const denominator = Number(b);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0)
        return undefined;
    const result = numerator / denominator;
    return Number.isFinite(result) && result > 0 ? result : undefined;
}
function extensionProfile(output, media) {
    const ext = path.extname(output).toLowerCase();
    if (ext === ".webm")
        return { video: ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0"], audio: ["-c:a", "libopus", "-b:a", "128k"] };
    if (media.video.length === 0 && ext === ".wav")
        return { video: [], audio: ["-c:a", "pcm_s16le"] };
    return { video: ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"], audio: ["-c:a", "aac", "-b:a", "192k"] };
}
function defaultOutput(source, suffix, media, explicit) {
    if (explicit)
        return path.resolve(explicit);
    const preferredExtension = media.video.length > 0 ? ".mp4" : ".wav";
    return deriveOutputPath(source, suffix, undefined, { defaultExtension: preferredExtension });
}
async function inputMedia(source, options) {
    const probe = await probeMedia(source, {
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
    if (!probe.media)
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "Unable to inspect media before repair.");
    return probe.media;
}
async function executeRepair(options) {
    await preflightOutputPath({
        source: options.source,
        output: options.output,
        overwrite: options.runtime.overwrite ?? false,
    });
    const beforeReport = await diagnoseMedia(options.source, {
        ...(options.runtime.ffmpegPath !== undefined ? { ffmpegPath: options.runtime.ffmpegPath } : {}),
        ...(options.runtime.ffprobePath !== undefined ? { ffprobePath: options.runtime.ffprobePath } : {}),
        ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
        ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
    });
    const transaction = await prepareOutputTransaction({
        source: options.source,
        output: options.output,
        ...(options.runtime.overwrite !== undefined ? { overwrite: options.runtime.overwrite } : {}),
        ...(options.runtime.dryRun !== undefined ? { dryRun: options.runtime.dryRun } : {}),
        ...(options.runtime.keepTemp !== undefined ? { keepTemp: options.runtime.keepTemp } : {}),
    });
    try {
        const execution = await runFFmpeg(["-hide_banner", "-loglevel", "error", ...options.args, "-n", transaction.temporary], {
            ...(options.runtime.ffmpegPath !== undefined ? { ffmpegPath: options.runtime.ffmpegPath } : {}),
            ...(options.runtime.dryRun !== undefined ? { dryRun: options.runtime.dryRun } : {}),
            ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
            ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
        });
        const invocation = renderCommandForDisplay({ binary: execution.binary, args: execution.args });
        if (!execution.executed) {
            return {
                operation: options.operation,
                source: options.source,
                output: transaction.output,
                planned: true,
                invocation,
                execution,
                inputMedia: options.media,
                before: beforeReport.issues,
                warnings: [...(options.warnings ?? [])],
                details: options.details,
            };
        }
        await transaction.finalize();
        const afterProbe = await probeMedia(transaction.output, {
            ...(options.runtime.ffprobePath !== undefined ? { ffprobePath: options.runtime.ffprobePath } : {}),
            ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
            ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
        });
        const afterReport = await diagnoseMedia(transaction.output, {
            ...(options.runtime.ffmpegPath !== undefined ? { ffmpegPath: options.runtime.ffmpegPath } : {}),
            ...(options.runtime.ffprobePath !== undefined ? { ffprobePath: options.runtime.ffprobePath } : {}),
            ...(options.runtime.verbose !== undefined ? { verbose: options.runtime.verbose } : {}),
            ...(options.runtime.signal !== undefined ? { signal: options.runtime.signal } : {}),
        });
        return {
            operation: options.operation,
            source: options.source,
            output: transaction.output,
            planned: false,
            invocation,
            execution,
            inputMedia: options.media,
            ...(afterProbe.media !== undefined ? { outputMedia: afterProbe.media } : {}),
            before: beforeReport.issues,
            after: afterReport.issues,
            warnings: [...(options.warnings ?? [])],
            details: options.details,
        };
    }
    catch (error) {
        await transaction.cleanup();
        throw error;
    }
}
export async function repairTimestamps(input, options = {}) {
    const source = await resolveReadableFile(input, options.cwd);
    const mode = options.mode ?? "reencode";
    if (options.output !== undefined) {
        await preflightOutputPath({
            source,
            output: path.resolve(options.output),
            overwrite: options.overwrite ?? false,
        });
    }
    const media = await inputMedia(source, options);
    const output = options.output !== undefined
        ? path.resolve(options.output)
        : mode === "remux"
            ? deriveOutputPath(source, "timestamps-repaired", undefined, { defaultExtension: ".mkv" })
            : defaultOutput(source, "timestamps-repaired", media);
    const args = ["-fflags", "+genpts", "-i", source, "-map", "0:v?", "-map", "0:a?", "-map_metadata", "0"];
    const warnings = media.streams.some((stream) => stream.codecType !== "video" && stream.codecType !== "audio")
        ? [{ code: "W_AUXILIARY_STREAMS_DROPPED", message: "Timestamp repair keeps video/audio streams and drops auxiliary streams." }]
        : [];
    if (mode === "remux") {
        args.push("-c", "copy", "-avoid_negative_ts", "make_zero");
        warnings.push({ code: "W_TIMESTAMP_REMUX_LIMITED", message: "Remux mode can regenerate container timestamps but cannot repair malformed decoded frame timing." });
    }
    else {
        const fps = finitePositive(options.fps, parseRate(media.video[0]?.averageFrameRate) ?? 30);
        const profile = extensionProfile(output, media);
        if (media.video.length > 0)
            args.push("-fps_mode", "cfr", "-r", String(fps), ...profile.video);
        if (media.audio.length > 0)
            args.push("-af", "aresample=async=1:first_pts=0", ...profile.audio);
        args.push("-avoid_negative_ts", "make_zero");
    }
    return executeRepair({
        operation: "timestamps",
        source,
        output,
        args,
        runtime: options,
        media,
        details: { mode, ...(options.fps !== undefined ? { requestedFps: options.fps } : {}) },
        warnings,
    });
}
export async function normalizeMedia(input, options = {}) {
    const source = await resolveReadableFile(input, options.cwd);
    if (options.output !== undefined) {
        await preflightOutputPath({
            source,
            output: path.resolve(options.output),
            overwrite: options.overwrite ?? false,
        });
    }
    const media = await inputMedia(source, options);
    const output = defaultOutput(source, "normalized", media, options.output);
    const args = ["-i", source, "-map", "0:v:0?", "-map", "0:a:0?"];
    const profile = extensionProfile(output, media);
    const details = {};
    if (media.video.length > 0) {
        const video = media.video[0];
        const width = Math.max(2, Math.floor(finitePositive(options.width, video?.width ?? 1280) / 2) * 2);
        const height = Math.max(2, Math.floor(finitePositive(options.height, video?.height ?? 720) / 2) * 2);
        const fps = finitePositive(options.fps, parseRate(video?.averageFrameRate) ?? 30);
        const pixelFormat = options.pixelFormat ?? "yuv420p";
        const filters = [
            `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
            "setsar=1",
            `fps=${fps}`,
            `format=${pixelFormat}`,
            "settb=AVTB",
            "setpts=PTS-STARTPTS",
        ];
        args.push("-vf", filters.join(","), "-fps_mode", "cfr", "-r", String(fps), ...profile.video);
        details["video"] = { width, height, fps, pixelFormat };
    }
    if (media.audio.length > 0) {
        const sampleRate = finitePositive(options.sampleRate, media.audio[0]?.sampleRate ?? 48000);
        const channels = Math.max(1, Math.round(finitePositive(options.channels, media.audio[0]?.channels ?? 2)));
        const layout = channels === 1 ? "mono" : channels === 2 ? "stereo" : undefined;
        const filters = [`aresample=${sampleRate}:async=1:first_pts=0`, ...(layout ? [`aformat=channel_layouts=${layout}`] : [])];
        args.push("-af", filters.join(","), ...profile.audio);
        details["audio"] = { sampleRate, channels, ...(layout ? { layout } : {}) };
    }
    if (media.video.length === 0 && media.audio.length === 0) {
        throw new ToolkitRuntimeError("E_MEDIA_NO_MATCHING_STREAM", "Input contains neither video nor audio streams that can be normalized.");
    }
    const warnings = media.streams.some((stream) => stream.codecType !== "video" && stream.codecType !== "audio")
        ? [{ code: "W_AUXILIARY_STREAMS_DROPPED", message: "Normalization keeps the primary video/audio streams and drops auxiliary streams." }]
        : [];
    return executeRepair({ operation: "normalize", source, output, args, runtime: options, media, details, warnings });
}
//# sourceMappingURL=repair.js.map