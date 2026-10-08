export declare function resolveReadableFile(input: string, cwd?: string): Promise<string>;
export declare function deriveOutputPath(source: string, suffix: string, explicitOutput?: string, options?: {
    cwd?: string;
    defaultExtension?: string;
}): string;
export interface OutputPathPreflightOptions {
    source?: string;
    output: string;
    overwrite?: boolean;
}
export declare function preflightOutputPath(options: OutputPathPreflightOptions): Promise<string>;
export interface OutputTransaction {
    output: string;
    temporary: string;
    finalize(): Promise<void>;
    cleanup(): Promise<void>;
}
export declare function prepareOutputTransaction(options: {
    source?: string;
    output: string;
    overwrite?: boolean;
    dryRun?: boolean;
    keepTemp?: boolean;
}): Promise<OutputTransaction>;
//# sourceMappingURL=io.d.ts.map