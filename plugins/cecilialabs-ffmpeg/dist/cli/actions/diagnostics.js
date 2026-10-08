import { readFile } from "node:fs/promises";
import { z } from "zod";
import { diagnoseMedia, normalizeMedia, repairTimestamps } from "../../diagnostics/index.js";
import { ToolkitRuntimeError } from "../../core/errors.js";
import { resolveReadableFile } from "../../media/io.js";
import { executeAction } from "./shared.js";
const positive = z.coerce.number().positive();
const positiveInt = z.coerce.number().int().positive();
function input(positional, command) {
    const value = positional[0];
    if (typeof value !== "string" || value.length === 0)
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", `${command} requires an input file.`);
    return value;
}
function runtime(global, signal) {
    return {
        ...(global.output !== undefined ? { output: global.output } : {}),
        overwrite: global.overwrite,
        dryRun: global.dryRun,
        verbose: global.verbose,
        ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
        ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
        signal,
        keepTemp: global.keepTemp,
    };
}
function renderDiagnostic(report) {
    const errors = report.issues.filter((issue) => issue.severity === "error").length;
    const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
    const infos = report.issues.filter((issue) => issue.severity === "info").length;
    const lines = [
        `diagnose${report.planned ? " (dry run)" : ""}`,
        `Input: ${report.source}`,
        `Issues: ${errors} error(s), ${warnings} warning(s), ${infos} info`,
    ];
    for (const issue of report.issues)
        lines.push(`  ${issue.severity.toUpperCase()} [${issue.code}] ${issue.message}`);
    return lines.join("\n");
}
function renderRepair(report) {
    const lines = [
        `repair ${report.operation}${report.planned ? " (dry run)" : ""}`,
        `Input: ${report.source}`,
        `Output: ${report.output}`,
        `Before: ${report.before.length} diagnostic issue(s)`,
        ...(report.after !== undefined ? [`After: ${report.after.length} diagnostic issue(s)`] : []),
        `Command: ${report.invocation}`,
    ];
    return lines.join("\n");
}
export async function runDiagnoseAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({ deep: z.boolean().default(false), log: z.string().min(1).optional(), freezeNoiseDb: z.coerce.number().max(0).default(-50), freezeDuration: positive.default(2) }).parse(command.opts());
        const logText = parsed.log !== undefined ? await readFile(await resolveReadableFile(parsed.log), "utf8") : undefined;
        const report = await diagnoseMedia(input(positional, "diagnose"), {
            ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
            ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
            dryRun: global.dryRun,
            verbose: global.verbose,
            signal,
            deep: parsed.deep,
            freezeNoiseDb: parsed.freezeNoiseDb,
            freezeDuration: parsed.freezeDuration,
            ...(logText !== undefined ? { logText } : {}),
        });
        return { data: report, warnings: report.warnings, ...(report.decodeExecution !== undefined ? { execution: report.decodeExecution } : {}) };
    }, renderDiagnostic);
}
export async function runRepairTimestampsAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({ mode: z.enum(["remux", "reencode"]).default("reencode"), fps: positive.optional() }).parse(command.opts());
        const report = await repairTimestamps(input(positional, "repair timestamps"), {
            ...runtime(global, signal),
            mode: parsed.mode,
            ...(parsed.fps !== undefined ? { fps: parsed.fps } : {}),
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderRepair);
}
export async function runRepairNormalizeAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = z.object({
            width: positiveInt.optional(), height: positiveInt.optional(), fps: positive.optional(),
            pixelFormat: z.string().min(1).default("yuv420p"), sampleRate: positiveInt.optional(), channels: positiveInt.optional(),
        }).parse(command.opts());
        const report = await normalizeMedia(input(positional, "repair normalize"), {
            ...runtime(global, signal),
            ...(parsed.width !== undefined ? { width: parsed.width } : {}),
            ...(parsed.height !== undefined ? { height: parsed.height } : {}),
            ...(parsed.fps !== undefined ? { fps: parsed.fps } : {}),
            pixelFormat: parsed.pixelFormat,
            ...(parsed.sampleRate !== undefined ? { sampleRate: parsed.sampleRate } : {}),
            ...(parsed.channels !== undefined ? { channels: parsed.channels } : {}),
        });
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, renderRepair);
}
//# sourceMappingURL=diagnostics.js.map