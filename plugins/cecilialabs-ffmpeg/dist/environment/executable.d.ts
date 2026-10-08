export interface ResolveExecutableOptions {
    explicitPath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
}
/** Resolve a fixed executable name without invoking a shell. */
export declare function resolveExecutable(name: string, options?: ResolveExecutableOptions): Promise<string | undefined>;
//# sourceMappingURL=executable.d.ts.map