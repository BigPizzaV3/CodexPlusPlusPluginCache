import type { MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { CompositionOperation, CompositionReport, CompositionRuntimeOptions } from "./types.js";
export declare function inspectCompositionInput(source: string, options: CompositionRuntimeOptions): Promise<MediaInfo>;
export declare function resolveCompositionFiles(inputs: readonly string[], options: CompositionRuntimeOptions): Promise<string[]>;
export declare function requireVideoStreams(media: readonly MediaInfo[], sources: readonly string[]): void;
export declare function durationSeconds(media: MediaInfo, source: string): number;
export declare function deriveCompositionOutput(source: string, suffix: string, explicit?: string, cwd?: string, format?: "mp4" | "webm"): string;
export declare function preflightCompositionOutput(sources: readonly string[], output: string, overwrite?: boolean): Promise<string>;
export declare function executeComposition(options: {
    operation: CompositionOperation;
    sources: string[];
    output: string;
    argsBeforeOutput: string[];
    runtime: CompositionRuntimeOptions;
    inputMedia?: MediaInfo[];
    warnings?: ToolkitWarning[];
    details?: Record<string, unknown>;
}): Promise<CompositionReport>;
//# sourceMappingURL=helpers.d.ts.map