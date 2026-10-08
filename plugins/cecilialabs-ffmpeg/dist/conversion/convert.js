import path from "node:path";
import { renderCommandForDisplay } from "../core/command-result.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { selectHardwareEncoding } from "../hardware/index.js";
import { preflightOutputPath, prepareOutputTransaction, resolveReadableFile } from "../media/io.js";
import { probeMedia } from "../media/probe.js";
import { assertSupportedConversion, buildConversionPlan, inferConversionFormat, targetExtension } from "./profiles.js";
export function deriveConversionOutputPath(source, target, explicitOutput, cwd = process.cwd()) {
    if (explicitOutput)
        return path.isAbsolute(explicitOutput) ? path.normalize(explicitOutput) : path.resolve(cwd, explicitOutput);
    const parsed = path.parse(source);
    return path.join(parsed.dir, `${parsed.name}${targetExtension(target)}`);
}
export async function convertFile(input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const inferred = inferConversionFormat(source);
    const sourceFormat = request.from ?? inferred;
    if (sourceFormat === undefined) {
        throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", "Unable to infer a supported source format from the input extension.", {
            details: { source, extension: path.extname(source) },
        });
    }
    if (request.from !== undefined && inferred !== undefined && request.from !== inferred) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Explicit source format does not match the input file extension.", {
            details: { source, requestedFrom: request.from, inferredFrom: inferred },
        });
    }
    assertSupportedConversion(sourceFormat, request.to);
    const output = deriveConversionOutputPath(source, request.to, request.output, request.cwd);
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const inputProbe = await probeMedia(source, {
        ...(request.ffprobePath !== undefined ? { ffprobePath: request.ffprobePath } : {}),
        ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
        ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
    });
    if (!inputProbe.media) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "Source media information is unavailable.", { details: { source } });
    }
    const media = inputProbe.media;
    let hardware;
    if (request.to === "mp4" || request.to === "webm") {
        hardware = await selectHardwareEncoding({
            codec: request.to === "mp4" ? "h264" : "vp9",
            hardware: request.hardware ?? "software",
            ...(request.hardwareDevice !== undefined ? { hardwareDevice: request.hardwareDevice } : {}),
            hardwareStrict: request.hardwareStrict ?? false,
            ...(request.ffmpegPath !== undefined ? { ffmpegPath: request.ffmpegPath } : {}),
            ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
            dryRun: request.dryRun ?? false,
            verbose: request.verbose ?? false,
            ...(request.signal !== undefined ? { signal: request.signal } : {}),
        });
    }
    else if (request.hardware !== undefined && request.hardware !== "software") {
        throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", "--hardware is supported only for MP4/H.264 and WebM/VP9 conversion targets.", { details: { target: request.to, hardware: request.hardware } });
    }
    const plan = buildConversionPlan(source, sourceFormat, request.to, media, request, hardware);
    const transaction = await prepareOutputTransaction({
        source,
        output,
        ...(request.overwrite !== undefined ? { overwrite: request.overwrite } : {}),
        ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
        ...(request.keepTemp !== undefined ? { keepTemp: request.keepTemp } : {}),
    });
    let execution;
    try {
        execution = await runFFmpeg([
            "-hide_banner",
            "-loglevel", request.verbose ? "info" : "error",
            ...plan.argsBeforeOutput,
            "-y",
            transaction.temporary,
        ], {
            ...(request.ffmpegPath !== undefined ? { ffmpegPath: request.ffmpegPath } : {}),
            ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
            ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
            ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
            ...(request.signal !== undefined ? { signal: request.signal } : {}),
            maxCaptureBytes: 8 * 1024 * 1024,
        });
        await transaction.finalize();
    }
    catch (error) {
        await transaction.cleanup();
        throw error;
    }
    await transaction.cleanup();
    const invocation = renderCommandForDisplay({
        binary: execution.binary,
        args: execution.args,
        ...(execution.cwd !== undefined ? { cwd: execution.cwd } : {}),
    });
    const outputProbe = request.dryRun
        ? undefined
        : await probeMedia(output, {
            ...(request.ffprobePath !== undefined ? { ffprobePath: request.ffprobePath } : {}),
            ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
            ...(request.signal !== undefined ? { signal: request.signal } : {}),
            ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
        });
    return {
        operation: "convert-file",
        source,
        sourceFormat,
        targetFormat: request.to,
        output,
        planned: !execution.executed,
        invocation,
        execution,
        ...(inputProbe.media !== undefined ? { inputMedia: inputProbe.media } : {}),
        ...(outputProbe?.media !== undefined ? { outputMedia: outputProbe.media } : {}),
        warnings: plan.warnings,
        details: plan.details,
    };
}
//# sourceMappingURL=convert.js.map