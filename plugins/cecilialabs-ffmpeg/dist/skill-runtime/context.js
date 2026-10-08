const CONTEXTS = new Set([
    "chatgpt-regular",
    "chatgpt-work",
    "codex",
    "ide",
    "terminal",
    "unknown",
]);
function capabilitiesFor(name) {
    switch (name) {
        case "chatgpt-regular":
            return { canInspectFiles: false, canExecuteScripts: false, canInstallDependencies: false };
        case "unknown":
            return { canInspectFiles: false, canExecuteScripts: false, canInstallDependencies: false };
        case "chatgpt-work":
            return { canInspectFiles: true, canExecuteScripts: true, canInstallDependencies: true };
        case "codex":
        case "ide":
        case "terminal":
            return { canInspectFiles: true, canExecuteScripts: true, canInstallDependencies: true };
    }
}
function asContext(value) {
    if (value === undefined || !CONTEXTS.has(value))
        return undefined;
    return value;
}
function environmentContext(environment) {
    const explicit = asContext(environment["CECELIA_FFMPEG_CONTEXT"]);
    if (explicit !== undefined)
        return explicit;
    if (environment["CODEX_THREAD_ID"] || environment["CODEX_SANDBOX"] === "1")
        return "codex";
    if (environment["CHATGPT_WORKSPACE"] || environment["CHATGPT_WORK"] === "1")
        return "chatgpt-work";
    if (environment["TERM_PROGRAM"] ||
        environment["VSCODE_PID"] ||
        environment["IDEA_INITIAL_DIRECTORY"]) {
        return "ide";
    }
    return undefined;
}
export function getExecutionContext(requested, environment = process.env) {
    const requestedContext = asContext(requested);
    const detectedContext = environmentContext(environment);
    const name = requestedContext ?? detectedContext ?? "unknown";
    const source = requestedContext !== undefined
        ? "request"
        : detectedContext !== undefined
            ? "environment"
            : "unknown";
    return { name, source, ...capabilitiesFor(name) };
}
export function contextGuidance(context) {
    switch (context.name) {
        case "chatgpt-regular":
            return [
                "This chat cannot inspect local files or execute scripts.",
                "Run the printed command in a Work/Codex/IDE/terminal environment and provide its JSON result.",
            ];
        case "unknown":
            return [
                "Declare context as chatgpt-work, codex, ide, or terminal before execution.",
                "Do not claim that local files or media were inspected until the command runs on that host.",
            ];
        default:
            return [];
    }
}
//# sourceMappingURL=context.js.map