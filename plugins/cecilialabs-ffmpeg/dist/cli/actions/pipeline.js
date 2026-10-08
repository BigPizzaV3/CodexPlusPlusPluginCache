import { ToolkitRuntimeError } from "../../core/errors.js";
import { executePipeline, inspectPipeline, loadPipelineFile, parsePipelineInvocation, } from "../../pipeline/index.js";
import { executeAction } from "./shared.js";
function rawPipelineTokens(positional) {
    const argv = process.argv.slice(2);
    const pipelineIndex = argv.indexOf("pipeline");
    if (pipelineIndex >= 0)
        return argv.slice(pipelineIndex + 1);
    const first = positional[0];
    if (Array.isArray(first))
        return first.map(String);
    return positional.map(String);
}
async function loadInvocation(positional, outputOverride) {
    const invocation = parsePipelineInvocation(rawPipelineTokens(positional), {
        cwd: process.cwd(),
        ...(outputOverride !== undefined ? { outputOverride } : {}),
    });
    if (invocation.source === "file") {
        if (invocation.file === undefined) {
            throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", "Pipeline file is missing.");
        }
        return {
            action: invocation.action,
            loaded: await loadPipelineFile(invocation.file),
        };
    }
    if (invocation.document === undefined) {
        throw new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Inline pipeline document is missing.");
    }
    return {
        action: invocation.action,
        loaded: {
            file: "<inline>",
            baseDirectory: process.cwd(),
            document: invocation.document,
        },
    };
}
function renderPipelineReport(report) {
    const lines = [
        `pipeline run${report.planned ? " (dry run)" : ""}`,
        `Pipeline: ${report.file}`,
        `Input: ${report.source}`,
        `Output: ${report.output}`,
        `Steps: ${report.stepCount}`,
    ];
    for (const step of report.steps) {
        lines.push(`  ${step.index}. ${step.kind}${step.planned ? " [planned]" : " [done]"} -> ${step.output}`);
    }
    if (report.workspace !== undefined)
        lines.push(`Workspace: ${report.workspace}`);
    return lines.join("\n");
}
function renderPipelineInspection(report) {
    const action = report.operation === "pipeline.print" ? "print" : "validate";
    const lines = [
        `pipeline ${action}`,
        `Pipeline: ${report.file}`,
        `Input: ${report.input}`,
        `Output: ${report.output}`,
        `Steps: ${report.stepCount}`,
    ];
    for (const step of report.steps) {
        lines.push(`  ${step.index}. ${step.kind} ${JSON.stringify(step.declaration)}`);
    }
    if (action === "print")
        lines.push(`Document:\n${JSON.stringify(report.document, null, 2)}`);
    return lines.join("\n");
}
export async function runPipelineAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const invocation = await loadInvocation(positional, global.output);
        if (invocation.action === "validate") {
            const report = inspectPipeline(invocation.loaded, "pipeline.validate", global.output);
            return { data: report };
        }
        if (invocation.action === "print") {
            const report = inspectPipeline(invocation.loaded, "pipeline.print", global.output);
            return { data: report };
        }
        const report = await executePipeline(invocation.loaded, {
            ...(global.output !== undefined ? { output: global.output } : {}),
            overwrite: global.overwrite,
            dryRun: global.dryRun,
            verbose: global.verbose,
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            signal,
            keepTemp: global.keepTemp,
        });
        return { data: report, warnings: report.warnings };
    }, (data) => "operation" in data && data.operation === "pipeline"
        ? renderPipelineReport(data)
        : renderPipelineInspection(data));
}
//# sourceMappingURL=pipeline.js.map