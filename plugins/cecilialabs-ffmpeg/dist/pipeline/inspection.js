import path from "node:path";
import { expandPipelineSteps } from "./presets.js";
import { validatePipelineOutput } from "./validation.js";
function finalOutput(loaded, override) {
    const target = override ?? loaded.document.output.path;
    return path.isAbsolute(target) ? path.normalize(target) : path.resolve(loaded.baseDirectory, target);
}
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
    return "convert";
}
export function inspectPipeline(loaded, operation, outputOverride) {
    const output = finalOutput(loaded, outputOverride);
    const declarations = expandPipelineSteps(loaded.document);
    validatePipelineOutput(loaded.document, declarations, output);
    return {
        operation,
        file: loaded.file,
        baseDirectory: loaded.baseDirectory,
        input: path.isAbsolute(loaded.document.input)
            ? path.normalize(loaded.document.input)
            : path.resolve(loaded.baseDirectory, loaded.document.input),
        output,
        stepCount: declarations.length,
        document: loaded.document,
        steps: declarations.map((declaration, offset) => ({
            index: offset + 1,
            kind: stepKind(declaration),
            declaration,
        })),
    };
}
//# sourceMappingURL=inspection.js.map