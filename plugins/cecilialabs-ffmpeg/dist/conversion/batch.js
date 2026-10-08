import { constants as fsConstants } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { exitCodeForError, isToolkitRuntimeError, ToolkitRuntimeError, toToolkitError } from "../core/index.js";
import { preflightOutputPath } from "../media/io.js";
import { convertFile } from "./convert.js";
import { assertSupportedConversion, isExtensionForFormat, targetExtension } from "./profiles.js";
import { matchesAnyPattern } from "./patterns.js";
async function resolveReadableDirectory(input, cwd = process.cwd()) {
    const directory = path.isAbsolute(input) ? path.normalize(input) : path.resolve(cwd, input);
    let information;
    try {
        information = await stat(directory);
    }
    catch (error) {
        const systemCode = error.code;
        if (systemCode === "ENOENT") {
            throw new ToolkitRuntimeError("E_INPUT_NOT_FOUND", `Batch directory does not exist: ${input}`, {
                details: { input, directory },
                cause: error,
            });
        }
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Unable to inspect batch directory: ${input}`, {
            details: { input, directory, ...(systemCode !== undefined ? { systemCode } : {}) },
            cause: error,
        });
    }
    if (!information.isDirectory()) {
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Batch input is not a directory: ${input}`, {
            details: { input, directory },
        });
    }
    try {
        await access(directory, fsConstants.R_OK);
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Batch directory is not readable: ${input}`, {
            details: { input, directory },
            cause: error,
        });
    }
    return directory;
}
export async function discoverBatchInputs(directory, options) {
    const recursive = options.recursive ?? false;
    const includes = options.includes ?? [];
    const excludes = options.excludes ?? [];
    const discovered = [];
    async function visit(current) {
        const entries = await readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (recursive)
                    await visit(absolute);
                continue;
            }
            if (!entry.isFile() || !isExtensionForFormat(entry.name, options.from))
                continue;
            const relativeInput = path.relative(directory, absolute);
            if (includes.length > 0 && !matchesAnyPattern(relativeInput, includes))
                continue;
            if (excludes.length > 0 && matchesAnyPattern(relativeInput, excludes))
                continue;
            discovered.push({ input: absolute, relativeInput });
        }
    }
    await visit(directory);
    return discovered.sort((left, right) => left.relativeInput.localeCompare(right.relativeInput));
}
function deriveBatchOutput(outputRoot, item, target, preserveHierarchy) {
    const relativeDirectory = preserveHierarchy ? path.dirname(item.relativeInput) : ".";
    const name = path.parse(item.relativeInput).name;
    return path.resolve(outputRoot, relativeDirectory, `${name}${targetExtension(target)}`);
}
async function exists(file) {
    try {
        await stat(file);
        return true;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false;
        throw error;
    }
}
function failureItem(item, output, error) {
    const runtimeError = isToolkitRuntimeError(error)
        ? error
        : new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Unexpected batch conversion failure.", { cause: error });
    return {
        input: item.input,
        relativeInput: item.relativeInput,
        output,
        ok: false,
        status: "failed",
        warnings: [],
        error: toToolkitError(runtimeError),
    };
}
export async function convertBatch(directoryInput, request) {
    assertSupportedConversion(request.from, request.to);
    const directory = await resolveReadableDirectory(directoryInput, request.cwd);
    const recursive = request.recursive ?? false;
    const preserveHierarchy = request.preserveHierarchy ?? true;
    const parallelism = request.parallelism ?? 2;
    if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 32) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "parallelism must be an integer from 1 to 32.", {
            details: { parallelism },
        });
    }
    const existing = request.existing ?? "error";
    const failureMode = request.failFast ? "fail-fast" : "continue-on-error";
    const outputDirectory = request.outputDirectory
        ? (path.isAbsolute(request.outputDirectory) ? path.normalize(request.outputDirectory) : path.resolve(request.cwd ?? process.cwd(), request.outputDirectory))
        : directory;
    const discovered = await discoverBatchInputs(directory, {
        from: request.from,
        recursive,
        ...(request.includes !== undefined ? { includes: request.includes } : {}),
        ...(request.excludes !== undefined ? { excludes: request.excludes } : {}),
    });
    if (discovered.length === 0) {
        throw new ToolkitRuntimeError("E_BATCH_EMPTY_SELECTION", "No files matched the batch selection.", {
            details: { directory, from: request.from, recursive, includes: request.includes ?? [], excludes: request.excludes ?? [] },
        });
    }
    const plannedOutputs = discovered.map((item) => ({
        item,
        output: deriveBatchOutput(outputDirectory, item, request.to, preserveHierarchy),
    }));
    const outputOwners = new Map();
    for (const entry of plannedOutputs) {
        const key = path.resolve(entry.output);
        const owners = outputOwners.get(key) ?? [];
        owners.push(entry.item.relativeInput);
        outputOwners.set(key, owners);
    }
    const collisions = [...outputOwners.entries()]
        .filter(([, owners]) => owners.length > 1)
        .map(([output, inputs]) => ({ output, inputs }));
    if (collisions.length > 0) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Multiple batch inputs resolve to the same output path.", {
            details: { collisions, hint: "Preserve hierarchy or choose a different output directory." },
        });
    }
    if (existing === "error") {
        await Promise.all(plannedOutputs.map(async ({ item, output }) => {
            await preflightOutputPath({ source: item.input, output, overwrite: false });
        }));
    }
    const startedAt = new Date();
    const started = performance.now();
    const results = new Array(discovered.length);
    let cursor = 0;
    let stop = false;
    let completed = 0;
    async function worker() {
        while (true) {
            if (stop)
                return;
            const index = cursor;
            cursor += 1;
            if (index >= discovered.length)
                return;
            const item = discovered[index];
            const output = deriveBatchOutput(outputDirectory, item, request.to, preserveHierarchy);
            if (await exists(output)) {
                if (existing === "skip") {
                    const result = {
                        input: item.input,
                        relativeInput: item.relativeInput,
                        output,
                        ok: true,
                        status: "skipped",
                        reason: "output-exists",
                        warnings: [],
                    };
                    results[index] = result;
                    completed += 1;
                    request.onProgress?.({ completed, total: discovered.length, input: item.input, output, status: "skipped" });
                    continue;
                }
                if (existing === "error") {
                    const error = new ToolkitRuntimeError("E_IO_OUTPUT_EXISTS", `Output already exists: ${output}`, {
                        details: { output, hint: "Use --existing replace or --existing skip." },
                    });
                    const result = failureItem(item, output, error);
                    results[index] = result;
                    completed += 1;
                    request.onProgress?.({ completed, total: discovered.length, input: item.input, output, status: "failed" });
                    if (request.failFast)
                        stop = true;
                    continue;
                }
            }
            try {
                const report = await convertFile(item.input, {
                    to: request.to,
                    from: request.from,
                    output,
                    overwrite: existing === "replace",
                    ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
                    ...(request.verbose !== undefined ? { verbose: request.verbose } : {}),
                    ...(request.ffmpegPath !== undefined ? { ffmpegPath: request.ffmpegPath } : {}),
                    ...(request.ffprobePath !== undefined ? { ffprobePath: request.ffprobePath } : {}),
                    ...(request.signal !== undefined ? { signal: request.signal } : {}),
                    ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
                    ...(request.keepTemp !== undefined ? { keepTemp: request.keepTemp } : {}),
                    ...(request.fps !== undefined ? { fps: request.fps } : {}),
                    ...(request.width !== undefined ? { width: request.width } : {}),
                    ...(request.height !== undefined ? { height: request.height } : {}),
                    ...(request.fit !== undefined ? { fit: request.fit } : {}),
                    ...(request.background !== undefined ? { background: request.background } : {}),
                    ...(request.quality !== undefined ? { quality: request.quality } : {}),
                    ...(request.maxColors !== undefined ? { maxColors: request.maxColors } : {}),
                    ...(request.loop !== undefined ? { loop: request.loop } : {}),
                    ...(request.audioBitrate !== undefined ? { audioBitrate: request.audioBitrate } : {}),
                    ...(request.sampleRate !== undefined ? { sampleRate: request.sampleRate } : {}),
                    ...(request.channels !== undefined ? { channels: request.channels } : {}),
                    ...(request.hardware !== undefined ? { hardware: request.hardware } : {}),
                    ...(request.hardwareDevice !== undefined ? { hardwareDevice: request.hardwareDevice } : {}),
                    ...(request.hardwareStrict !== undefined ? { hardwareStrict: request.hardwareStrict } : {}),
                });
                results[index] = {
                    input: item.input,
                    relativeInput: item.relativeInput,
                    output,
                    ok: true,
                    status: "succeeded",
                    data: report,
                    warnings: report.warnings,
                };
                completed += 1;
                request.onProgress?.({ completed, total: discovered.length, input: item.input, output, status: "succeeded" });
            }
            catch (error) {
                results[index] = failureItem(item, output, error);
                completed += 1;
                request.onProgress?.({ completed, total: discovered.length, input: item.input, output, status: "failed" });
                if (request.failFast)
                    stop = true;
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(parallelism, discovered.length) }, () => worker()));
    for (let index = 0; index < discovered.length; index += 1) {
        if (results[index] !== undefined)
            continue;
        const item = discovered[index];
        const output = deriveBatchOutput(outputDirectory, item, request.to, preserveHierarchy);
        results[index] = {
            input: item.input,
            relativeInput: item.relativeInput,
            output,
            ok: true,
            status: "skipped",
            reason: "fail-fast",
            warnings: [],
        };
    }
    const items = results;
    const succeeded = items.filter((item) => item.status === "succeeded").length;
    const failed = items.filter((item) => item.status === "failed").length;
    const skipped = items.filter((item) => item.status === "skipped").length;
    const attempted = succeeded + failed;
    const finishedAt = new Date();
    return {
        operation: "convert-batch",
        planned: request.dryRun ?? false,
        directory,
        outputDirectory,
        sourceFormat: request.from,
        targetFormat: request.to,
        recursive,
        preserveHierarchy,
        parallelism,
        failureMode,
        existing,
        discovered: discovered.length,
        attempted,
        succeeded,
        failed,
        skipped,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.round(performance.now() - started),
        items,
    };
}
export function batchExitCode(report) {
    return report.failed > 0 ? exitCodeForError("E_BATCH_PARTIAL_FAILURE") : undefined;
}
//# sourceMappingURL=batch.js.map