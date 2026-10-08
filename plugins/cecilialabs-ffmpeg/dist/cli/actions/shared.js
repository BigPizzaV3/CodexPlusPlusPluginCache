import { ZodError } from "zod";
import { createFailureEnvelope, createProcessSignalController, createResultContext, createSuccessEnvelope, exitCodeForError, isToolkitRuntimeError, ToolkitRuntimeError, withProgressObserver, } from "../../core/index.js";
import { colorEnabled, colorizeError, colorizeHumanOutput, colorizeWarning } from "../colors.js";
import { CliProgressReporter } from "../progress-renderer.js";
import { validateGlobalCliOptions } from "../global-options.js";
import { preflightExplicitCliOutput } from "../output-preflight.js";
export function commandPath(command) {
    const parts = [];
    let current = command;
    while (current) {
        if (current.name())
            parts.push(current.name());
        current = current.parent;
    }
    return parts.reverse().join(" ");
}
export async function executeAction(command, operation, renderHuman) {
    const options = validateGlobalCliOptions(command.optsWithGlobals());
    const path = commandPath(command);
    const context = createResultContext(path);
    const signals = createProcessSignalController();
    const stdoutColor = colorEnabled(options.color, process.stdout);
    const stderrColor = colorEnabled(options.color, process.stderr);
    const progress = new CliProgressReporter({
        enabled: options.progress && !options.quiet && !options.json,
        friendly: stderrColor,
    });
    try {
        await preflightExplicitCliOutput(command, options);
        const payload = await withProgressObserver(progress.onEvent, async () => await operation(options, signals.signal));
        progress.finish();
        const progressSummary = progress.summary();
        if (options.json) {
            const envelope = createSuccessEnvelope(context, payload.data, {
                ...(payload.warnings !== undefined ? { warnings: payload.warnings } : {}),
                ...(payload.execution !== undefined ? { execution: payload.execution } : {}),
                ...(progressSummary !== undefined ? { progress: progressSummary } : {}),
            });
            process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
        }
        else if (!options.quiet) {
            const rendered = renderHuman(payload.data);
            if (rendered.length > 0) {
                process.stdout.write(`${colorizeHumanOutput(rendered, stdoutColor)}\n`);
            }
            for (const warning of payload.warnings ?? []) {
                process.stderr.write(`${colorizeWarning(warning.code, warning.message, stderrColor)}\n`);
            }
        }
        if (payload.exitCode !== undefined)
            process.exitCode = payload.exitCode;
    }
    catch (error) {
        const runtimeError = isToolkitRuntimeError(error)
            ? error
            : error instanceof ZodError
                ? new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Invalid command options.", {
                    details: {
                        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
                    },
                    cause: error,
                })
                : new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Unexpected command failure.", { cause: error });
        progress.finish();
        const failureProgressSummary = progress.summary();
        if (options.json) {
            process.stdout.write(`${JSON.stringify(createFailureEnvelope(context, runtimeError, {
                ...(failureProgressSummary !== undefined ? { progress: failureProgressSummary } : {}),
            }), null, 2)}\n`);
        }
        else {
            process.stderr.write(`${colorizeError(runtimeError.code, runtimeError.message, stderrColor)}\n`);
            if (options.verbose && runtimeError.details) {
                process.stderr.write(`${JSON.stringify(runtimeError.details, null, 2)}\n`);
            }
        }
        process.exitCode = exitCodeForError(runtimeError.code);
    }
    finally {
        signals.dispose();
    }
}
//# sourceMappingURL=shared.js.map