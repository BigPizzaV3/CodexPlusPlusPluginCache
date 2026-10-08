import { resolveCommandAction } from "./action-registry.js";
import { colorEnabled } from "./colors.js";
import { COMMAND_TREE } from "./command-spec.js";
import { decorateCommandDescription } from "./icons.js";
import { configureSemanticHelp } from "./help-style.js";
import { configureVideoOptions } from "./video-options.js";
import { configureAudioOptions } from "./audio-options.js";
import { configureConversionOptions } from "./conversion-options.js";
import { configureCompositionOptions } from "./composition-options.js";
import { configureDiagnosticsOptions } from "./diagnostics-options.js";
import { configureStreamingOptions } from "./streaming-options.js";
import { configureImageOptions } from "./image-options.js";
import { configureEnvironmentOptions } from "./environment-options.js";
import { runPlaceholder } from "./placeholder.js";
function commandPath(command) {
    const parts = [];
    let current = command;
    while (current) {
        if (current.name())
            parts.push(current.name());
        current = current.parent;
    }
    return parts.reverse().join(" ");
}
function friendlyHelpEnabled() {
    return !process.argv.includes("--no-color") && colorEnabled(true, process.stdout);
}
function registerSpec(parent, spec) {
    const command = parent.command(spec.syntax);
    const path = commandPath(command);
    const friendly = friendlyHelpEnabled();
    configureSemanticHelp(command, friendly);
    command.description(friendly ? decorateCommandDescription(path, spec.description) : spec.description);
    if (spec.children && spec.children.length > 0) {
        for (const child of spec.children)
            registerSpec(command, child);
        command.action(() => command.outputHelp());
        return;
    }
    if (path === "cecilia-ffmpeg pipeline")
        command.allowUnknownOption();
    configureVideoOptions(command, path);
    configureAudioOptions(command, path);
    configureConversionOptions(command, path);
    configureCompositionOptions(command, path);
    configureDiagnosticsOptions(command, path);
    configureStreamingOptions(command, path);
    configureImageOptions(command, path);
    configureEnvironmentOptions(command, path);
    const action = resolveCommandAction(path);
    if (action) {
        command.action((...args) => action(command, args.slice(0, -1)));
        return;
    }
    command.action(() => runPlaceholder(command, spec));
}
export function registerCommandTree(program) {
    for (const spec of COMMAND_TREE)
        registerSpec(program, spec);
}
//# sourceMappingURL=register-command-tree.js.map