import type { MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { AudioOperationReport, AudioRuntimeOptions } from "./types.js";
export declare function requireAudio(media: MediaInfo, source: string): void;
export declare function requireVideo(media: MediaInfo, source: string): void;
export declare function inspectAudioInput(source: string, options: AudioRuntimeOptions): Promise<MediaInfo>;
export declare function positiveFinite(value: number, name: string): number;
export declare function nonNegativeFinite(value: number, name: string): number;
export declare function integerInRange(value: number, name: string, min: number, max: number): number;
export declare function formatNumber(value: number): string;
export declare function assertDistinctOutput(sources: readonly string[], output: string): void;
export interface ExecuteAudioTransformOptions {
    operation: AudioOperationReport["operation"];
    sources: string[];
    output: string;
    argsBeforeOutput: string[];
    runtime: AudioRuntimeOptions;
    inputMedia?: MediaInfo[];
    warnings?: ToolkitWarning[];
    details?: Record<string, unknown>;
}
export declare function executeAudioTransform(options: ExecuteAudioTransformOptions): Promise<AudioOperationReport>;
//# sourceMappingURL=helpers.d.ts.map