import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { ZodError } from "zod";
import { ToolkitRuntimeError } from "../core/errors.js";
import { pipelineDocumentSchema } from "./schema.js";
const require = createRequire(import.meta.url);
const { load } = require("js-yaml");
function schemaError(error, source) {
    return new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Pipeline document does not satisfy the v1 schema.", {
        details: {
            source,
            issues: error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        },
        cause: error,
    });
}
export function parsePipelineText(text, source = "<inline>") {
    let raw;
    try {
        raw = load(text);
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Pipeline YAML could not be parsed.", {
            details: {
                source,
                diagnostic: error instanceof Error ? error.message : String(error),
            },
            cause: error,
        });
    }
    try {
        return pipelineDocumentSchema.parse(raw);
    }
    catch (error) {
        if (error instanceof ZodError)
            throw schemaError(error, source);
        throw error;
    }
}
export async function loadPipelineFile(file, cwd = process.cwd()) {
    const resolved = path.isAbsolute(file) ? path.normalize(file) : path.resolve(cwd, file);
    let text;
    try {
        text = await readFile(resolved, "utf8");
    }
    catch (error) {
        const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
        throw new ToolkitRuntimeError(code === "ENOENT" ? "E_INPUT_NOT_FOUND" : "E_INPUT_UNREADABLE", code === "ENOENT" ? "Pipeline file does not exist." : "Pipeline file could not be read.", { details: { file: resolved, ...(code !== undefined ? { code } : {}) }, cause: error });
    }
    return {
        file: resolved,
        baseDirectory: path.dirname(resolved),
        document: parsePipelineText(text, resolved),
    };
}
//# sourceMappingURL=parser.js.map