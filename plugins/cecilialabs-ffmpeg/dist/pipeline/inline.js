import path from "node:path";
import { ZodError } from "zod";
import { ToolkitRuntimeError } from "../core/errors.js";
import { pipelineDocumentSchema } from "./schema.js";
const ACTIONS = new Set(["validate", "print", "run"]);
const GLOBAL_FLAGS = new Set([
    "--overwrite",
    "--dry-run",
    "--json",
    "--quiet",
    "--verbose",
    "--no-progress",
    "--no-color",
    "--keep-temp",
]);
const GLOBAL_VALUE_FLAGS = new Set(["--ffmpeg-path", "--ffprobe-path"]);
function invalid(message, details) {
    throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", message, {
        ...(details !== undefined ? { details } : {}),
    });
}
function valueAt(tokens, index, flag) {
    const value = tokens[index + 1];
    if (value === undefined)
        invalid(`${flag} requires a value.`, { flag });
    if (value.startsWith("--"))
        invalid(`${flag} requires a value.`, { flag });
    return value;
}
function numberValue(value, flag) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        invalid(`${flag} must be a finite number.`, { flag, value });
    return parsed;
}
function integerValue(value, flag) {
    const parsed = numberValue(value, flag);
    if (!Number.isInteger(parsed))
        invalid(`${flag} must be an integer.`, { flag, value });
    return parsed;
}
function normalizePath(value, cwd) {
    return path.resolve(cwd, value);
}
function samePath(left, right, cwd) {
    return normalizePath(left, cwd) === normalizePath(right, cwd);
}
function collectActions(tokens) {
    let selected;
    for (const [index, token] of tokens.entries()) {
        if (!ACTIONS.has(token))
            continue;
        selected = { action: token, index };
    }
    if (selected === undefined) {
        invalid("pipeline requires a final action: validate, print, or run.");
    }
    return selected;
}
function stripGlobalOptions(tokens) {
    const positional = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token === undefined)
            continue;
        if (GLOBAL_FLAGS.has(token))
            continue;
        if (GLOBAL_VALUE_FLAGS.has(token)) {
            valueAt(tokens, index, token);
            index += 1;
            continue;
        }
        if (token === "--output") {
            valueAt(tokens, index, token);
            index += 1;
            continue;
        }
        if (token === "--")
            continue;
        if (token.startsWith("--"))
            invalid(`Unknown pipeline option "${token}".`);
        positional.push(token);
    }
    return positional;
}
function parseFileInvocation(tokens, action, actionIndex) {
    const beforeAction = stripGlobalOptions(tokens.slice(0, actionIndex));
    const afterAction = stripGlobalOptions(tokens.slice(actionIndex + 1));
    if (beforeAction.length !== 1 || afterAction.length !== 0) {
        invalid("File pipelines use: pipeline <file> <validate|print|run>.", {
            beforeAction,
            afterAction,
        });
    }
    const file = beforeAction[0];
    if (file === undefined)
        invalid("Pipeline file is missing.");
    return { action, source: "file", file };
}
function setValue(builder, flag, value) {
    if (flag === "--input") {
        builder.input = String(value);
        return;
    }
    if (flag === "--output") {
        builder.output = String(value);
        return;
    }
    const keyByFlag = {
        "--trim-start": "start",
        "--start": "start",
        "--trim-end": "end",
        "--end": "end",
        "--duration": "duration",
        "--mode": "mode",
        "--factor": "factor",
        "--audio": "audio",
        "--width": "width",
        "--height": "height",
        "--fit": "fit",
        "--background": "background",
        "--profile": "profile",
        "--fps": "fps",
        "--crf": "crf",
        "--preset": "preset",
        "--video-preset": "preset",
        "--to": "to",
        "--hardware": "hardware",
        "--hardware-device": "hardwareDevice",
        "--pixel-format": "pixelFormat",
        "--sample-rate": "sampleRate",
        "--channels": "channels",
        "--quality": "quality",
        "--max-colors": "maxColors",
        "--loop": "loop",
        "--audio-bitrate": "audioBitrate",
        "--name": "name",
        "--codec": "codec",
    };
    const key = keyByFlag[flag];
    if (key === undefined)
        invalid(`Option ${flag} is not supported for inline pipelines.`, { flag });
    builder.values[key] = value;
}
function buildStep(builder) {
    switch (builder.kind) {
        case "trim":
            return { trim: builder.values };
        case "speed":
            return { speed: builder.values };
        case "resize":
            return { resize: builder.values };
        case "normalize":
            return { normalize: builder.values };
        case "audio":
            return { audio: { normalize: true, ...builder.values } };
        case "convert":
            return { convert: builder.values };
        case "preset": {
            const name = builder.values["name"] ?? builder.values["preset"];
            if (typeof name !== "string" || name.trim().length === 0) {
                invalid("Inline preset steps require --name <preset> or --preset <preset>.");
            }
            return { preset: name };
        }
        default:
            invalid(`Unsupported inline pipeline step "${builder.kind}".`, { step: builder.kind });
    }
}
function parseInlineDocument(tokens, actionIndex, cwd, outputOverride) {
    const builders = [];
    let current;
    let initialInput;
    let finalOutput;
    let outputCodec;
    const pushCurrent = () => {
        if (current === undefined)
            return;
        builders.push(current);
        current = undefined;
    };
    for (let index = 0; index < actionIndex; index += 1) {
        const token = tokens[index];
        if (token === undefined)
            continue;
        if (GLOBAL_FLAGS.has(token))
            continue;
        if (GLOBAL_VALUE_FLAGS.has(token)) {
            valueAt(tokens, index, token);
            index += 1;
            continue;
        }
        if (token === "--")
            continue;
        if (token === "--step") {
            pushCurrent();
            current = { kind: valueAt(tokens, index, token), values: {} };
            index += 1;
            continue;
        }
        if (token === "--hardware-strict") {
            if (current === undefined)
                invalid("--hardware-strict must follow --step.");
            current.values["hardwareStrict"] = true;
            continue;
        }
        if (!token.startsWith("--"))
            invalid(`Unexpected inline pipeline token "${token}".`);
        const value = valueAt(tokens, index, token);
        const numericFlags = new Set([
            "--trim-start", "--start", "--trim-end", "--end", "--duration", "--factor", "--width",
            "--height", "--fps", "--crf", "--sample-rate", "--channels", "--quality", "--max-colors", "--loop",
        ]);
        const parsedValue = numericFlags.has(token)
            ? ["--width", "--height", "--sample-rate", "--channels", "--max-colors", "--loop"].includes(token)
                ? integerValue(value, token)
                : numberValue(value, token)
            : value;
        if (token === "--input") {
            if (current === undefined)
                initialInput = value;
            else
                setValue(current, token, value);
        }
        else if (token === "--output") {
            if (current === undefined)
                finalOutput = value;
            else
                setValue(current, token, value);
        }
        else if (token === "--codec") {
            if (value !== "h264" && value !== "vp9")
                invalid("--codec must be h264 or vp9.", { value });
            outputCodec = value;
        }
        else {
            if (current === undefined)
                invalid(`${token} must follow --step.`, { flag: token });
            setValue(current, token, parsedValue);
        }
        index += 1;
    }
    pushCurrent();
    if (builders.length === 0)
        invalid("Inline pipelines require at least one --step.");
    const steps = builders.map(buildStep);
    const input = initialInput ?? builders[0]?.input;
    if (input === undefined || input.trim().length === 0) {
        invalid("Inline pipelines require --input <path> on the first step.");
    }
    let previousOutput;
    for (const [index, builder] of builders.entries()) {
        if (index === 0 && builder.input !== undefined && !samePath(builder.input, input, cwd)) {
            invalid("The first inline step input must match the pipeline input.");
        }
        if (index > 0 && builder.input !== undefined && previousOutput !== undefined && !samePath(builder.input, previousOutput, cwd)) {
            invalid("Inline pipeline steps must chain each --input from the previous --output.", {
                step: index + 1,
                input: builder.input,
                previousOutput,
            });
        }
        if (builder.output !== undefined)
            previousOutput = builder.output;
    }
    const output = finalOutput ?? previousOutput ?? outputOverride;
    if (output === undefined || output.trim().length === 0) {
        invalid("Inline pipelines require --output <path> on the final step.");
    }
    const raw = {
        version: 1,
        input,
        steps,
        output: { path: output, ...(outputCodec !== undefined ? { codec: outputCodec } : {}) },
    };
    const parsed = pipelineDocumentSchema.safeParse(raw);
    if (!parsed.success) {
        const details = parsed.error instanceof ZodError
            ? parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
            : undefined;
        invalid("Inline pipeline does not satisfy the pipeline v1 schema.", details ? { issues: details } : undefined);
    }
    return parsed.data;
}
export function parsePipelineInvocation(tokens, options = {}) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const { action, index: actionIndex } = collectActions(tokens);
    const beforeAction = tokens.slice(0, actionIndex);
    if (!beforeAction.includes("--step"))
        return parseFileInvocation(tokens, action, actionIndex);
    return {
        action,
        source: "inline",
        document: parseInlineDocument(tokens, actionIndex, cwd, options.outputOverride),
    };
}
//# sourceMappingURL=inline.js.map