import type { CommandExecution, MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { MediaFit } from "../media/fit.js";
export type ImageFormat = "png" | "jpeg" | "webp";
export interface ImageRuntimeOptions {
    output?: string;
    overwrite?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    ffmpegPath?: string;
    ffprobePath?: string;
    signal?: AbortSignal;
    cwd?: string;
    keepTemp?: boolean;
}
export interface ExtractImageRequest extends ImageRuntimeOptions {
    at?: number;
    to?: ImageFormat;
    width?: number;
    height?: number;
    fit?: MediaFit;
    background?: string;
    quality?: number;
}
export interface ImageOperationReport {
    operation: "extract";
    source: string;
    output: string;
    format: ImageFormat;
    planned: boolean;
    invocation: string;
    execution: CommandExecution;
    inputMedia?: MediaInfo;
    outputMedia?: MediaInfo;
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map