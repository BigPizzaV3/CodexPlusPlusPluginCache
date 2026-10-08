import { createFailureEnvelope, createResultContext, exitCodeForError, ToolkitRuntimeError, } from "../core/index.js";
import { validateGlobalCliOptions } from "./global-options.js";
function commandPath(command) {
    const parts = [];
    let current = command;
    while (current) {
        if (current.name()) {
            parts.push(current.name());
            // if (current.name()) parts.push(`${wrap(current.name(), codes.brightRed, )}`);
        }
        current = current.parent;
    }
    return parts.reverse().join(" ");
}
/**
 * Leaf implementations arrive in their owning milestones. Until then this
 * placeholder uses the same structured error/envelope infrastructure as the
 * executable runtime.
 */
export function runPlaceholder(command, spec) {
    const options = validateGlobalCliOptions(command.optsWithGlobals());
    const path = commandPath(command);
    const message = `${path} is registered but is implemented in Milestone ${spec.implementationMilestone}.`;
    const error = new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", message, {
        details: { implementationMilestone: spec.implementationMilestone },
    });
    if (options.json) {
        const envelope = createFailureEnvelope(createResultContext(path), error);
        process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    }
    else {
        process.stderr.write(`${message}\n`);
    }
    process.exitCode = exitCodeForError(error.code);
}
//# sourceMappingURL=placeholder.js.map