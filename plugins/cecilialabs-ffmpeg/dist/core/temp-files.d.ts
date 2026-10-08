export interface TemporaryWorkspaceOptions {
    prefix?: string;
    baseDirectory?: string;
    keep?: boolean;
}
export declare class TemporaryWorkspace {
    readonly directory: string;
    readonly keep: boolean;
    private cleaned;
    private constructor();
    static create(options?: TemporaryWorkspaceOptions): Promise<TemporaryWorkspace>;
    pathFor(relativePath: string): string;
    ensureDirectory(relativePath: string): Promise<string>;
    cleanup(): Promise<void>;
}
export declare function withTemporaryWorkspace<T>(options: TemporaryWorkspaceOptions, callback: (workspace: TemporaryWorkspace) => Promise<T>): Promise<T>;
//# sourceMappingURL=temp-files.d.ts.map