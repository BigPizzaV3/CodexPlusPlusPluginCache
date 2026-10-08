import { constants as fsConstants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { ToolkitRuntimeError } from "./errors.js";
function notFoundCode(kind) {
    return kind === "ffmpeg" ? "E_ENV_FFMPEG_NOT_FOUND" : "E_ENV_FFPROBE_NOT_FOUND";
}
function envOverrideName(kind) {
    return kind === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH";
}
async function isExecutableFile(candidate, platform) {
    try {
        const info = await stat(candidate);
        if (!info.isFile())
            return false;
        await access(candidate, platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function hasPathSyntax(value) {
    return path.isAbsolute(value) || value.includes("/") || value.includes("\\") || value.startsWith(".");
}
function executableNames(name, platform, env) {
    if (platform !== "win32")
        return [name];
    if (path.extname(name))
        return [name];
    const extensions = (env["PATHEXT"] ?? ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .filter(Boolean)
        .map((extension) => extension.toLowerCase());
    return [name, ...extensions.map((extension) => `${name}${extension}`)];
}
async function resolvePathLike(value, cwd, platform) {
    const candidate = path.isAbsolute(value) ? value : path.resolve(cwd, value);
    if (await isExecutableFile(candidate, platform))
        return candidate;
    return undefined;
}
async function searchPath(name, env, platform) {
    const pathValue = env["PATH"] ?? env["Path"] ?? env["path"];
    if (!pathValue)
        return undefined;
    const directories = pathValue.split(path.delimiter).filter(Boolean);
    const names = executableNames(name, platform, env);
    for (const directory of directories) {
        for (const executableName of names) {
            const candidate = path.resolve(directory, executableName);
            if (await isExecutableFile(candidate, platform))
                return candidate;
        }
    }
    return undefined;
}
async function resolveRequestedValue(value, cwd, env, platform) {
    if (hasPathSyntax(value))
        return resolvePathLike(value, cwd, platform);
    return searchPath(value, env, platform);
}
/**
 * Resolve an FFmpeg-family binary without invoking a shell. Resolution order:
 * explicit CLI/API override -> FFMPEG_PATH/FFPROBE_PATH -> PATH lookup.
 */
export async function resolveBinary(options) {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const cwd = options.cwd ?? process.cwd();
    const envName = envOverrideName(options.kind);
    const requested = options.explicitPath ?? env[envName];
    if (requested) {
        const resolved = await resolveRequestedValue(requested, cwd, env, platform);
        if (resolved)
            return resolved;
        throw new ToolkitRuntimeError(notFoundCode(options.kind), `Unable to resolve ${options.kind} from configured path: ${requested}`, { details: { requested, source: options.explicitPath ? "explicit" : envName } });
    }
    const resolved = await searchPath(options.kind, env, platform);
    if (resolved)
        return resolved;
    throw new ToolkitRuntimeError(notFoundCode(options.kind), `Unable to find ${options.kind} on PATH. Install it or provide an explicit binary path.`, { details: { binary: options.kind } });
}
//# sourceMappingURL=binary-resolver.js.map