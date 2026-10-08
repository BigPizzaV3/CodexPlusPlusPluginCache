import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
async function isExecutable(candidate, platform) {
    try {
        const info = await stat(candidate);
        if (!info.isFile())
            return false;
        await access(candidate, platform === "win32" ? constants.F_OK : constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function names(name, platform, environment) {
    if (platform !== "win32" || path.extname(name))
        return [name];
    const extensions = (environment["PATHEXT"] ?? ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .filter(Boolean)
        .map((extension) => extension.toLowerCase());
    return [name, ...extensions.map((extension) => `${name}${extension}`)];
}
/** Resolve a fixed executable name without invoking a shell. */
export async function resolveExecutable(name, options = {}) {
    const environment = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const requested = options.explicitPath;
    if (requested !== undefined) {
        const candidate = path.isAbsolute(requested) ? requested : path.resolve(cwd, requested);
        return (await isExecutable(candidate, platform)) ? candidate : undefined;
    }
    const pathValue = environment["PATH"] ?? environment["Path"] ?? environment["path"];
    if (!pathValue)
        return undefined;
    for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
        for (const executableName of names(name, platform, environment)) {
            const candidate = path.resolve(directory, executableName);
            if (await isExecutable(candidate, platform))
                return candidate;
        }
    }
    return undefined;
}
//# sourceMappingURL=executable.js.map