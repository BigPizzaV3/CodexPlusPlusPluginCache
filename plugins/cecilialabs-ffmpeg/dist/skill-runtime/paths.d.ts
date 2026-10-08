export interface SafePathOptions {
    cwd?: string;
    root?: string;
    allowAbsolute?: boolean;
}
/** Resolve a user path without invoking a shell or allowing root traversal. */
export declare function resolveSafePath(value: string, options?: SafePathOptions): string;
export interface WritablePathReport {
    path: string;
    exists: boolean;
    writable: boolean;
    parent: string;
}
/** Check an output path without creating, truncating, or replacing anything. */
export declare function inspectWritablePath(value: string, options?: SafePathOptions): Promise<WritablePathReport>;
//# sourceMappingURL=paths.d.ts.map