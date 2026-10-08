import type { MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { VideoOperation, VideoOperationReport, VideoRuntimeOptions } from "./types.js";
export declare function requireVideo(media: MediaInfo, source: string): void;
export declare function inspectInput(source: string, options: VideoRuntimeOptions): Promise<MediaInfo>;
export interface ExecuteVideoTransformOptions {
    operation: VideoOperation;
    source: string;
    output: string;
    argsBeforeOutput: string[];
    runtime: VideoRuntimeOptions;
    inputMedia?: MediaInfo;
    warnings?: ToolkitWarning[];
    details?: Record<string, unknown>;
}
export declare function executeVideoTransform(options: ExecuteVideoTransformOptions): Promise<VideoOperationReport>;
export declare function positiveFinite(value: number, name: string): number;
export declare function nonNegativeFinite(value: number, name: string): number;
export declare function formatSeconds(value: number): string;
//# sourceMappingURL=helpers.d.ts.map