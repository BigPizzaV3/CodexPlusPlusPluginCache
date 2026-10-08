import type { BatchItemResult, CommandExecution, MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { HardwareRuntimeOptions } from "../hardware/types.js";
import type { MediaFit } from "../media/fit.js";
export type ConversionFormat = "mp4" | "webm" | "gif" | "webp" | "png" | "jpeg" | "wav" | "mp3" | "aac" | "m4a" | "flac" | "opus" | "ogg";
export type BatchExistingStrategy = "error" | "skip" | "replace";
export type BatchFailureMode = "continue-on-error" | "fail-fast";
export interface ConversionRuntimeOptions extends HardwareRuntimeOptions {
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
export interface ConversionTuningOptions {
    fps?: number;
    width?: number;
    height?: number;
    fit?: MediaFit;
    background?: string;
    quality?: number;
    maxColors?: number;
    loop?: number;
    audioBitrate?: string;
    sampleRate?: number;
    channels?: number;
}
export interface ConvertFileRequest extends ConversionRuntimeOptions, ConversionTuningOptions {
    to: ConversionFormat;
    from?: ConversionFormat;
}
export interface ConversionReport {
    operation: "convert-file";
    source: string;
    sourceFormat: ConversionFormat;
    targetFormat: ConversionFormat;
    output: string;
    planned: boolean;
    invocation: string;
    execution: CommandExecution;
    inputMedia?: MediaInfo;
    outputMedia?: MediaInfo;
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
export interface BatchProgressEvent {
    completed: number;
    total: number;
    input: string;
    output?: string;
    status: "succeeded" | "failed" | "skipped";
}
export interface ConvertBatchRequest extends Omit<ConversionRuntimeOptions, "output" | "overwrite">, ConversionTuningOptions {
    from: ConversionFormat;
    to: ConversionFormat;
    recursive?: boolean;
    includes?: readonly string[];
    excludes?: readonly string[];
    parallelism?: number;
    failFast?: boolean;
    outputDirectory?: string;
    preserveHierarchy?: boolean;
    existing?: BatchExistingStrategy;
    onProgress?: (event: BatchProgressEvent) => void;
}
export interface BatchConversionItem extends BatchItemResult<ConversionReport> {
    relativeInput: string;
    status: "succeeded" | "failed" | "skipped";
    reason?: string;
}
export interface BatchConversionReport {
    operation: "convert-batch";
    planned: boolean;
    directory: string;
    outputDirectory: string;
    sourceFormat: ConversionFormat;
    targetFormat: ConversionFormat;
    recursive: boolean;
    preserveHierarchy: boolean;
    parallelism: number;
    failureMode: BatchFailureMode;
    existing: BatchExistingStrategy;
    discovered: number;
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    items: BatchConversionItem[];
}
//# sourceMappingURL=types.d.ts.map