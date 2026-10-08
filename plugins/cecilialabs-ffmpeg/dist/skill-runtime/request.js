import { readFile } from "node:fs/promises";
import { ToolkitRuntimeError } from "../core/errors.js";
const MAX_REQUEST_BYTES = 1024 * 1024;
function validate(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Skill script input must be a JSON object.");
    }
    return value;
}
export async function readSkillScriptRequest(input = process.stdin) {
    if (input === process.stdin && process.stdin.isTTY)
        return {};
    const chunks = [];
    let size = 0;
    for await (const chunk of input) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        size += buffer.length;
        if (size > MAX_REQUEST_BYTES) {
            throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Skill script request exceeds the 1 MiB limit.");
        }
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (text.length === 0)
        return {};
    try {
        return validate(JSON.parse(text));
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError)
            throw error;
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Skill script input is not valid JSON.", { cause: error });
    }
}
export async function readSkillScriptRequestFile(file) {
    try {
        return validate(JSON.parse(await readFile(file, "utf8")));
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError)
            throw error;
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Skill request file is not valid JSON.", {
            details: { file },
            cause: error,
        });
    }
}
//# sourceMappingURL=request.js.map