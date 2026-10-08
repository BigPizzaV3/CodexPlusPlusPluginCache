import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { TemporaryWorkspace } from "../core/temp-files.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { convertFile, targetExtension } from "../conversion/index.js";
import { normalizeMedia } from "../diagnostics/index.js";
import { preflightOutputPath, resolveReadableFile } from "../media/io.js";
import { changeVideoSpeed, trimVideoRange, trimVideoStart, upscaleVideo } from "../video/index.js";
import { expandPipelineSteps } from "./presets.js";
import { validatePipelineOutput, validatePipelineResultCodec } from "./validation.js";
function stepKind(step) {
    if ("trim" in step)
        return "trim";
    if ("speed" in step)
        return "speed";
    if ("resize" in step)
        return "resize";
    if ("normalize" in step)
        return "normalize";
    if ("audio" in step)
        return "audio";
    if ("convert" in step)
        return "convert";
    return "preset";
}
function finalOutput(loaded, override) {
    const target = override ?? loaded.document.output.path;
    return path.isAbsolute(target) ? path.normalize(target) : path.resolve(loaded.baseDirectory, target);
}
function videoFormatForPath(target) {
    return path.extname(target).toLowerCase() === ".webm" ? "webm" : "mp4";
}
function intermediateExtension(current, step) {
    if ("convert" in step)
        return targetExtension(step.convert.to);
    if ("resize" in step && step.resize.to !== undefined)
        return `.${step.resize.to}`;
    return path.extname(current) || ".mp4";
}
function commonRuntime(options, output, final) {
    return {
        output,
        overwrite: final ? (options.overwrite ?? false) : true,
        dryRun: false,
        verbose: options.verbose ?? false,
        ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        keepTemp: false,
    };
}
async function publishStagedOutput(staged, output, overwrite) {
    await preflightOutputPath({ output, overwrite });
    try {
        await mkdir(path.dirname(output), { recursive: true });
        if (overwrite)
            await rm(output, { force: true });
        await rename(staged, output);
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError)
            throw error;
        throw new ToolkitRuntimeError("E_IO_PERMISSION_DENIED", `Unable to publish pipeline output: ${output}`, {
            details: { staged, output },
            cause: error,
        });
    }
}
function relocateMedia(media, output) {
    return media === undefined ? undefined : { ...media, source: output };
}
function fromVideoReport(index, kind, report) {
    return {
        index,
        kind,
        input: report.source,
        output: report.output,
        planned: report.planned,
        invocation: report.invocation,
        durationMs: report.execution.durationMs,
        warnings: report.warnings,
        details: report.details,
    };
}
function fromConversionReport(index, report) {
    return {
        index,
        kind: "convert",
        input: report.source,
        output: report.output,
        planned: report.planned,
        invocation: report.invocation,
        durationMs: report.execution.durationMs,
        warnings: report.warnings,
        details: report.details,
    };
}
function fromRepairReport(index, kind, report) {
    return {
        index,
        kind,
        input: report.source,
        output: report.output,
        planned: report.planned,
        invocation: report.invocation,
        durationMs: report.execution.durationMs,
        warnings: report.warnings,
        details: report.details,
    };
}
async function executeConvert(index, input, output, step, runtime, final) {
    const convert = step.convert;
    const report = await convertFile(input, {
        ...commonRuntime(runtime, output, final),
        to: convert.to,
        ...(convert.fps !== undefined ? { fps: convert.fps } : {}),
        ...(convert.width !== undefined ? { width: convert.width } : {}),
        ...(convert.height !== undefined ? { height: convert.height } : {}),
        ...(convert.fit !== undefined ? { fit: convert.fit } : {}),
        ...(convert.background !== undefined ? { background: convert.background } : {}),
        ...(convert.quality !== undefined ? { quality: convert.quality } : {}),
        ...(convert.maxColors !== undefined ? { maxColors: convert.maxColors } : {}),
        ...(convert.loop !== undefined ? { loop: convert.loop } : {}),
        ...(convert.audioBitrate !== undefined ? { audioBitrate: convert.audioBitrate } : {}),
        ...(convert.sampleRate !== undefined ? { sampleRate: convert.sampleRate } : {}),
        ...(convert.channels !== undefined ? { channels: convert.channels } : {}),
        ...(convert.hardware !== undefined ? { hardware: convert.hardware } : {}),
        ...(convert.hardwareDevice !== undefined ? { hardwareDevice: convert.hardwareDevice } : {}),
        ...(convert.hardwareStrict !== undefined ? { hardwareStrict: convert.hardwareStrict } : {}),
    });
    return { step: fromConversionReport(index, report), media: report.outputMedia };
}
async function executeNormalize(index, input, output, step, runtime, final) {
    const normalize = step.normalize;
    const report = await normalizeMedia(input, {
        ...commonRuntime(runtime, output, final),
        ...(normalize.width !== undefined ? { width: normalize.width } : {}),
        ...(normalize.height !== undefined ? { height: normalize.height } : {}),
        ...(normalize.fps !== undefined ? { fps: normalize.fps } : {}),
        ...(normalize.pixelFormat !== undefined ? { pixelFormat: normalize.pixelFormat } : {}),
        ...(normalize.sampleRate !== undefined ? { sampleRate: normalize.sampleRate } : {}),
        ...(normalize.channels !== undefined ? { channels: normalize.channels } : {}),
    });
    return { step: fromRepairReport(index, "normalize", report), media: report.outputMedia };
}
async function executeAudioNormalize(index, input, output, step, runtime, final) {
    const audio = step.audio;
    const report = await normalizeMedia(input, {
        ...commonRuntime(runtime, output, final),
        ...(audio.sampleRate !== undefined ? { sampleRate: audio.sampleRate } : {}),
        ...(audio.channels !== undefined ? { channels: audio.channels } : {}),
    });
    return { step: fromRepairReport(index, "audio", report), media: report.outputMedia };
}
async function executeResize(index, input, output, step, runtime, final) {
    const resize = step.resize;
    const report = await upscaleVideo(input, {
        ...commonRuntime(runtime, output, final),
        width: resize.width,
        height: resize.height,
        ...(resize.fit !== undefined ? { fit: resize.fit } : {}),
        ...(resize.background !== undefined ? { background: resize.background } : {}),
        ...(resize.profile !== undefined ? { profile: resize.profile } : {}),
        ...(resize.fps !== undefined ? { fps: resize.fps } : {}),
        ...(resize.crf !== undefined ? { crf: resize.crf } : {}),
        ...(resize.preset !== undefined ? { preset: resize.preset } : {}),
        to: resize.to ?? videoFormatForPath(output),
        ...(resize.hardware !== undefined ? { hardware: resize.hardware } : {}),
        ...(resize.hardwareDevice !== undefined ? { hardwareDevice: resize.hardwareDevice } : {}),
        ...(resize.hardwareStrict !== undefined ? { hardwareStrict: resize.hardwareStrict } : {}),
    });
    return { step: fromVideoReport(index, "resize", report), media: report.outputMedia };
}
async function executeSpeed(index, input, output, step, runtime, final) {
    const speed = step.speed;
    const report = await changeVideoSpeed(input, {
        ...commonRuntime(runtime, output, final),
        factor: speed.factor,
        ...(speed.audio !== undefined ? { audio: speed.audio } : {}),
    });
    return { step: fromVideoReport(index, "speed", report), media: report.outputMedia };
}
async function executeTrim(index, input, output, step, runtime, final) {
    const trim = step.trim;
    const common = commonRuntime(runtime, output, final);
    const report = trim.end !== undefined || trim.duration !== undefined
        ? await trimVideoRange(input, {
            ...common,
            start: trim.start ?? 0,
            ...(trim.end !== undefined ? { end: trim.end } : {}),
            ...(trim.duration !== undefined ? { duration: trim.duration } : {}),
            ...(trim.mode !== undefined ? { mode: trim.mode } : {}),
        })
        : await trimVideoStart(input, {
            ...common,
            seconds: trim.start,
            ...(trim.mode !== undefined ? { mode: trim.mode } : {}),
        });
    return { step: fromVideoReport(index, "trim", report), media: report.outputMedia };
}
function plannedReport(loaded, source, output, declarations) {
    const steps = declarations.map((step, offset) => {
        const kind = stepKind(step);
        const isFinal = offset === declarations.length - 1;
        return {
            index: offset + 1,
            kind,
            input: offset === 0 ? source : `<pipeline-step-${offset}-output>`,
            output: isFinal ? output : `<pipeline-step-${offset + 1}-output>`,
            planned: true,
            warnings: [],
            details: { declaration: step },
        };
    });
    return {
        operation: "pipeline",
        file: loaded.file,
        source,
        output,
        planned: true,
        stepCount: steps.length,
        steps,
        warnings: [],
    };
}
export async function executePipeline(loaded, options = {}) {
    const input = loaded.document.input;
    const source = await resolveReadableFile(input, loaded.baseDirectory);
    const output = finalOutput(loaded, options.output);
    await preflightOutputPath({
        source,
        output,
        overwrite: options.overwrite ?? false,
    });
    const declarations = expandPipelineSteps(loaded.document);
    validatePipelineOutput(loaded.document, declarations, output);
    if (options.dryRun)
        return plannedReport(loaded, source, output, declarations);
    const workspace = await TemporaryWorkspace.create({
        prefix: "cecilia-ffmpeg-pipeline-",
        keep: options.keepTemp ?? false,
    });
    try {
        let current = source;
        let outputMedia;
        const reports = [];
        for (let offset = 0; offset < declarations.length; offset += 1) {
            const declaration = declarations[offset];
            const kind = stepKind(declaration);
            const index = offset + 1;
            const isFinal = offset === declarations.length - 1;
            const stepOutput = isFinal
                ? workspace.pathFor(`final-output${path.extname(output) || ".mp4"}`)
                : workspace.pathFor(`step-${String(index).padStart(3, "0")}-${kind}${intermediateExtension(current, declaration)}`);
            const result = kind === "trim" && "trim" in declaration
                ? await executeTrim(index, current, stepOutput, declaration, options, false)
                : kind === "speed" && "speed" in declaration
                    ? await executeSpeed(index, current, stepOutput, declaration, options, false)
                    : kind === "resize" && "resize" in declaration
                        ? await executeResize(index, current, stepOutput, declaration, options, false)
                        : kind === "normalize" && "normalize" in declaration
                            ? await executeNormalize(index, current, stepOutput, declaration, options, false)
                            : kind === "audio" && "audio" in declaration
                                ? await executeAudioNormalize(index, current, stepOutput, declaration, options, false)
                                : kind === "convert" && "convert" in declaration
                                    ? await executeConvert(index, current, stepOutput, declaration, options, false)
                                    : undefined;
            if (result === undefined) {
                throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", `Pipeline step "${kind}" is not executable in the current implementation phase.`, {
                    details: { index, kind },
                });
            }
            reports.push(result.step);
            current = result.step.output;
            outputMedia = result.media;
        }
        validatePipelineResultCodec(loaded.document, outputMedia);
        const stagedOutput = reports.at(-1)?.output;
        if (stagedOutput === undefined) {
            throw new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Pipeline completed without a final output path.");
        }
        await publishStagedOutput(stagedOutput, output, options.overwrite ?? false);
        const finalStep = reports.at(-1);
        if (finalStep !== undefined)
            finalStep.output = output;
        outputMedia = relocateMedia(outputMedia, output);
        return {
            operation: "pipeline",
            file: loaded.file,
            source,
            output,
            planned: false,
            stepCount: reports.length,
            steps: reports,
            warnings: reports.flatMap((report) => report.warnings),
            ...(outputMedia !== undefined ? { outputMedia } : {}),
            ...(options.keepTemp ? { workspace: workspace.directory } : {}),
        };
    }
    finally {
        await workspace.cleanup();
    }
}
//# sourceMappingURL=executor.js.map