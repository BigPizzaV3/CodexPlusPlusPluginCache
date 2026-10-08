import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
export async function resolveReadableFile(input, cwd = process.cwd()) {
    const source = path.isAbsolute(input) ? path.normalize(input) : path.resolve(cwd, input);
    let information;
    try {
        information = await stat(source);
    }
    catch (error) {
        const systemCode = error.code;
        if (systemCode === "ENOENT") {
            throw new ToolkitRuntimeError("E_INPUT_NOT_FOUND", `Input file does not exist: ${input}`, {
                details: { input, source },
                cause: error,
            });
        }
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Unable to inspect input file: ${input}`, {
            details: { input, source, ...(systemCode !== undefined ? { systemCode } : {}) },
            cause: error,
        });
    }
    if (!information.isFile()) {
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Input is not a regular file: ${input}`, {
            details: { input, source },
        });
    }
    try {
        await access(source, fsConstants.R_OK);
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Input file is not readable: ${input}`, {
            details: { input, source },
            cause: error,
        });
    }
    return source;
}
export function deriveOutputPath(source, suffix, explicitOutput, options = {}) {
    if (explicitOutput) {
        return path.isAbsolute(explicitOutput)
            ? path.normalize(explicitOutput)
            : path.resolve(options.cwd ?? process.cwd(), explicitOutput);
    }
    const parsed = path.parse(source);
    const extension = options.defaultExtension ?? (parsed.ext || ".mp4");
    return path.join(parsed.dir, `${parsed.name}.${suffix}${extension.startsWith(".") ? extension : `.${extension}`}`);
}
async function pathExists(target) {
    try {
        await stat(target);
        return true;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false;
        throw error;
    }
}
export async function preflightOutputPath(options) {
    const output = path.resolve(options.output);
    if (options.source && path.resolve(options.source) === output) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Input and output paths must be different.", {
            details: { source: path.resolve(options.source), output },
        });
    }
    let exists = false;
    try {
        exists = await pathExists(output);
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_IO_PERMISSION_DENIED", `Unable to inspect output path: ${output}`, {
            details: { output },
            cause: error,
        });
    }
    if (exists && !options.overwrite) {
        throw new ToolkitRuntimeError("E_IO_OUTPUT_EXISTS", `Output already exists: ${output}`, {
            details: { output, hint: "Pass --overwrite to replace it." },
        });
    }
    return output;
}
export async function prepareOutputTransaction(options) {
    const output = await preflightOutputPath({
        ...(options.source !== undefined ? { source: options.source } : {}),
        output: options.output,
        ...(options.overwrite !== undefined ? { overwrite: options.overwrite } : {}),
    });
    const parsed = path.parse(output);
    const temporary = path.join(parsed.dir, `.${parsed.name}.cecilia-ffmpeg.${randomUUID()}.tmp${parsed.ext || ".mp4"}`);
    if (!options.dryRun) {
        try {
            await mkdir(parsed.dir, { recursive: true });
            await access(parsed.dir, fsConstants.W_OK);
        }
        catch (error) {
            throw new ToolkitRuntimeError("E_IO_PERMISSION_DENIED", `Output directory is not writable: ${parsed.dir}`, {
                details: { output, directory: parsed.dir },
                cause: error,
            });
        }
    }
    return {
        output,
        temporary,
        async finalize() {
            if (options.dryRun)
                return;
            try {
                const information = await stat(temporary);
                if (!information.isFile() || information.size <= 0) {
                    throw new ToolkitRuntimeError("E_FFMPEG_EXECUTION_FAILED", "FFmpeg produced an empty output file.", {
                        details: { temporary, output },
                    });
                }
                if (options.overwrite)
                    await rm(output, { force: true });
                await rename(temporary, output);
            }
            catch (error) {
                if (error instanceof ToolkitRuntimeError)
                    throw error;
                throw new ToolkitRuntimeError("E_IO_PERMISSION_DENIED", `Unable to finalize output: ${output}`, {
                    details: { temporary, output },
                    cause: error,
                });
            }
        },
        async cleanup() {
            if (options.dryRun || options.keepTemp)
                return;
            await rm(temporary, { force: true }).catch(() => undefined);
        },
    };
}
//# sourceMappingURL=io.js.map