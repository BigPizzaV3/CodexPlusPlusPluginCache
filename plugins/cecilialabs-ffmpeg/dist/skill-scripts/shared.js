import { readSkillScriptRequest } from "../skill-runtime/request.js";
import { runSkillScript } from "../skill-runtime/runner.js";
import { ToolkitRuntimeError } from "../core/errors.js";
import { resolveSafePath } from "../skill-runtime/paths.js";
export function objectInput(value) {
    if (value === undefined)
        return {};
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "input must be a JSON object");
    }
    return value;
}
export function requiredString(input, name) {
    const value = input[name];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a non-empty string`, {
            details: { name },
        });
    }
    return value;
}
export function optionalString(input, name) {
    const value = input[name];
    if (value === undefined)
        return undefined;
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a non-empty string`, {
            details: { name },
        });
    }
    return value;
}
export function requiredNumber(input, name) {
    const value = input[name];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a finite number`, {
            details: { name },
        });
    }
    return value;
}
export function optionalNumber(input, name) {
    const value = input[name];
    if (value === undefined)
        return undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a finite number`, {
            details: { name },
        });
    }
    return value;
}
export function optionalBoolean(input, name) {
    const value = input[name];
    if (value === undefined)
        return undefined;
    if (typeof value !== "boolean") {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a boolean`, {
            details: { name },
        });
    }
    return value;
}
export function optionalStringArray(input, name) {
    const value = input[name];
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string" && entry.length > 0)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be an array of non-empty strings`, {
            details: { name },
        });
    }
    return [...value];
}
export function requiredStringArray(input, name) {
    const values = optionalStringArray(input, name);
    if (values === undefined || values.length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must contain at least one string`, {
            details: { name },
        });
    }
    return values;
}
export function enumValue(input, name, allowed) {
    const value = input[name];
    if (value === undefined)
        return undefined;
    if (typeof value !== "string" || !allowed.includes(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be one of: ${allowed.join(", ")}`, {
            details: { name, allowed },
        });
    }
    return value;
}
export function requiredEnum(input, name, allowed) {
    const value = enumValue(input, name, allowed);
    if (value === undefined) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} is required`, {
            details: { name, allowed },
        });
    }
    return value;
}
export function inputPath(input, name, request) {
    return resolveSafePath(requiredString(input, name), {
        cwd: request.cwd ?? process.cwd(),
    });
}
export function runtimeOptions(input, request, context, signal) {
    const cwd = optionalString(input, "cwd") ?? request.cwd;
    const output = optionalString(input, "output");
    const ffmpegPath = optionalString(input, "ffmpegPath");
    const ffprobePath = optionalString(input, "ffprobePath");
    const hardwareDevice = optionalString(input, "hardwareDevice");
    const hardware = enumValue(input, "hardware", ["auto", "software", "nvenc", "qsv", "vaapi", "videotoolbox"]);
    const options = {
        dryRun: request.dryRun === true || !context.canExecuteScripts,
        signal,
    };
    const overwrite = optionalBoolean(input, "overwrite");
    const verbose = optionalBoolean(input, "verbose");
    const keepTemp = optionalBoolean(input, "keepTemp");
    const hardwareStrict = optionalBoolean(input, "hardwareStrict");
    if (cwd !== undefined)
        options["cwd"] = cwd;
    if (output !== undefined)
        options["output"] = output;
    if (ffmpegPath !== undefined)
        options["ffmpegPath"] = ffmpegPath;
    if (ffprobePath !== undefined)
        options["ffprobePath"] = ffprobePath;
    if (overwrite !== undefined)
        options["overwrite"] = overwrite;
    if (verbose !== undefined)
        options["verbose"] = verbose;
    if (keepTemp !== undefined)
        options["keepTemp"] = keepTemp;
    if (hardware !== undefined)
        options["hardware"] = hardware;
    if (hardwareDevice !== undefined)
        options["hardwareDevice"] = hardwareDevice;
    if (hardwareStrict !== undefined)
        options["hardwareStrict"] = hardwareStrict;
    return options;
}
export function contextPlan(input, context, next) {
    if (context.canExecuteScripts)
        return undefined;
    return {
        status: "planned",
        input,
        output: {
            planned: true,
            context: context.name,
            message: "This host cannot execute Skill scripts; run the associated script in Codex, Work, or a local terminal.",
        },
        next: [next],
    };
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function artifactsForReport(report) {
    if (!isRecord(report))
        return [];
    const planned = report["planned"] === true;
    const operation = report["operation"];
    if (operation === "convert-batch") {
        const outputDirectory = report["outputDirectory"];
        if (typeof outputDirectory !== "string")
            return [];
        const failed = report["failed"];
        if (typeof failed === "number" && failed > 0)
            return [];
        return [{ kind: "directory", path: outputDirectory, verified: !planned }];
    }
    const output = report["output"];
    if (typeof output !== "string")
        return [];
    const producesFile = isRecord(report["outputMedia"]) ||
        (typeof operation === "string" && [
            "add-silence", "attach", "convert-file", "from-image", "normalize",
            "remove-silence", "restore", "silence", "speed", "telephony", "trim",
            "trim-end", "trim-start", "upscale",
        ].includes(operation));
    if (!producesFile)
        return [];
    return [{ kind: "file", path: output, verified: !planned && isRecord(report["outputMedia"]) }];
}
function batchFailure(report) {
    if (!isRecord(report) || report["operation"] !== "convert-batch")
        return undefined;
    const failed = report["failed"];
    if (typeof failed !== "number" || failed <= 0)
        return undefined;
    const items = Array.isArray(report["items"]) ? report["items"] : [];
    const failedItems = items.filter((item) => isRecord(item) && item["status"] === "failed").map((item) => ({
        input: item["input"],
        output: item["output"],
        error: item["error"],
    }));
    return new ToolkitRuntimeError("E_BATCH_PARTIAL_FAILURE", "Batch conversion completed with failed items.", {
        details: {
            directory: report["directory"],
            outputDirectory: report["outputDirectory"],
            discovered: report["discovered"],
            attempted: report["attempted"],
            succeeded: report["succeeded"],
            failed,
            skipped: report["skipped"],
            failedItems,
            recovery: "Fix or remove the failed inputs, then retry the failed items; successful outputs remain usable.",
        },
    });
}
export function reportResult(input, report, next = []) {
    const failure = batchFailure(report);
    if (failure !== undefined)
        throw failure;
    const warnings = isRecord(report) && Array.isArray(report["warnings"]) ? report["warnings"] : [];
    const planned = isRecord(report) && report["planned"] === true;
    return {
        ...(planned ? { status: "planned" } : {}),
        input,
        output: report,
        artifacts: artifactsForReport(report),
        warnings: warnings,
        next,
    };
}
export async function executeSkillScript(operation, handler) {
    let request = {};
    let requestError;
    try {
        request = await readSkillScriptRequest();
    }
    catch (error) {
        requestError = error;
    }
    process.exitCode = await runSkillScript({
        operation,
        request,
        handler: async (context) => {
            if (requestError !== undefined)
                throw requestError;
            return await handler(context);
        },
    });
}
//# sourceMappingURL=shared.js.map