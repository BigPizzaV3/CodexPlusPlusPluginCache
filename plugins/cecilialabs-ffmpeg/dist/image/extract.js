import path from "node:path";
import { renderCommandForDisplay } from "../core/command-result.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { buildFitFilters } from "../media/fit.js";
import { preflightOutputPath, prepareOutputTransaction, resolveReadableFile } from "../media/io.js";
import { probeMedia } from "../media/probe.js";
function extension(format) {
    return format === "jpeg" ? ".jpg" : `.${format}`;
}
function positiveInteger(value, name) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || value <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a positive integer.`);
    }
    return value;
}
function deriveOutput(source, format, explicit, cwd) {
    if (explicit)
        return path.resolve(cwd ?? process.cwd(), explicit);
    const parsed = path.parse(source);
    return path.join(parsed.dir, `${parsed.name}.frame${extension(format)}`);
}
export async function extractImage(input, request = {}) {
    const source = await resolveReadableFile(input, request.cwd);
    const at = request.at ?? 0;
    if (!Number.isFinite(at) || at < 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "--at must be zero or greater.");
    }
    const format = request.to ?? "png";
    const output = deriveOutput(source, format, request.output, request.cwd);
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const probe = await probeMedia(source, {
        ...(request.ffprobePath !== undefined ? { ffprobePath: request.ffprobePath } : {}),
        ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
    });
    const media = probe.media;
    if (!media || media.video.length === 0) {
        throw new ToolkitRuntimeError("E_MEDIA_NO_MATCHING_STREAM", "image extract requires a video stream.");
    }
    const width = positiveInteger(request.width, "width");
    const height = positiveInteger(request.height, "height");
    const filters = [];
    if (width !== undefined && height !== undefined) {
        filters.push(...buildFitFilters({
            width,
            height,
            ...(request.fit !== undefined ? { fit: request.fit } : {}),
            ...(request.background !== undefined ? { background: request.background } : {}),
        }));
    }
    else if (width !== undefined) {
        filters.push(`scale=${width}:-2:flags=lanczos`);
    }
    else if (height !== undefined) {
        filters.push(`scale=-2:${height}:flags=lanczos`);
    }
    const transaction = await prepareOutputTransaction({
        source,
        output,
        ...(request.overwrite !== undefined ? { overwrite: request.overwrite } : {}),
        ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
        ...(request.keepTemp !== undefined ? { keepTemp: request.keepTemp } : {}),
    });
    const quality = request.quality ?? 90;
    if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "quality must be an integer from 0 to 100.");
    }
    const codecArgs = format === "png"
        ? ["-c:v", "png"]
        : format === "jpeg"
            ? ["-c:v", "mjpeg", "-q:v", String(Math.max(2, Math.round(31 - (quality / 100) * 29)))]
            : ["-c:v", "libwebp", "-quality", String(quality), "-lossless", "0"];
    let execution;
    try {
        execution = await runFFmpeg([
            "-hide_banner", "-loglevel", request.verbose ? "info" : "error",
            "-i", source,
            "-ss", String(at),
            "-map", "0:v:0",
            ...(filters.length > 0 ? ["-vf", filters.join(",")] : []),
            "-frames:v", "1",
            "-an",
            ...codecArgs,
            "-y", transaction.temporary,
        ], {
            ...(request.ffmpegPath !== undefined ? { ffmpegPath: request.ffmpegPath } : {}),
            ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
            ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
            ...(request.signal !== undefined ? { signal: request.signal } : {}),
        });
        await transaction.finalize();
    }
    catch (error) {
        await transaction.cleanup();
        throw error;
    }
    await transaction.cleanup();
    const outputProbe = request.dryRun ? undefined : await probeMedia(output, {
        ...(request.ffprobePath !== undefined ? { ffprobePath: request.ffprobePath } : {}),
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
    });
    return {
        operation: "extract",
        source,
        output,
        format,
        planned: !execution.executed,
        invocation: renderCommandForDisplay({ binary: execution.binary, args: execution.args }),
        execution,
        inputMedia: media,
        ...(outputProbe?.media !== undefined ? { outputMedia: outputProbe.media } : {}),
        warnings: [],
        details: {
            at,
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
            fit: request.fit ?? "contain",
            background: request.background ?? "black",
            quality,
        },
    };
}
//# sourceMappingURL=extract.js.map