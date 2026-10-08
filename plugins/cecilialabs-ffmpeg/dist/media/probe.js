import { constants as fsConstants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { renderCommandForDisplay } from "../core/command-result.js";
import { registerProgressMedia } from "../core/progress-context.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFprobe } from "../core/ffprobe-runner.js";
import { normalizeFFprobeJson } from "./ffprobe-normalizer.js";
async function resolveReadableInput(input, cwd = process.cwd()) {
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
export async function probeMedia(input, options = {}) {
    const source = await resolveReadableInput(input, options.cwd);
    const args = ["-v", "error", "-show_format", "-show_streams", "-of", "json", source];
    const execution = await runFFprobe(args, {
        ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        maxCaptureBytes: 16 * 1024 * 1024,
    });
    const invocation = renderCommandForDisplay({
        binary: execution.binary,
        args: execution.args,
        ...(execution.cwd !== undefined ? { cwd: execution.cwd } : {}),
    });
    if (!execution.executed) {
        return { source, planned: true, invocation, execution };
    }
    if (execution.stdoutTruncated) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "FFprobe JSON exceeded the capture limit.", {
            details: { source, captureLimitBytes: 16 * 1024 * 1024 },
        });
    }
    let raw;
    try {
        raw = JSON.parse(execution.stdout ?? "");
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "FFprobe returned invalid JSON.", {
            details: { source, stdoutTail: execution.stdout?.slice(-2_000) ?? "" },
            cause: error,
        });
    }
    const media = normalizeFFprobeJson(source, raw);
    registerProgressMedia(media);
    return {
        source,
        planned: false,
        media,
        invocation,
        execution,
    };
}
//# sourceMappingURL=probe.js.map