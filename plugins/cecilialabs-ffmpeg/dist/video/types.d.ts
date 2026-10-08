import type { HardwareRuntimeOptions } from "../hardware/types.js";
import type { MediaFit } from "../media/fit.js";
import type { CommandExecution, MediaInfo, ToolkitWarning, TrimMode } from "../types/contracts.js";
export type VideoOperation = "trim-start" | "trim-end" | "trim" | "speed" | "from-image" | "restore" | "upscale";
export type VideoOutputFormat = "mp4" | "webm";
export type SpeedAudioMode = "sync" | "drop";
export type RestoreProfile = "balanced" | "aggressive";
export interface VideoOperationReport {
    operation: VideoOperation;
    source: string;
    output: string;
    planned: boolean;
    invocation: string;
    execution: CommandExecution;
    inputMedia?: MediaInfo;
    outputMedia?: MediaInfo;
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
export interface VideoRuntimeOptions extends HardwareRuntimeOptions {
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
export interface TrimStartRequest extends VideoRuntimeOptions {
    seconds: number;
    mode?: TrimMode;
}
export interface TrimEndRequest extends VideoRuntimeOptions {
    seconds: number;
    mode?: TrimMode;
}
export interface TrimRangeRequest extends VideoRuntimeOptions {
    start?: number;
    end?: number;
    duration?: number;
    mode?: TrimMode;
}
export interface SpeedVideoRequest extends VideoRuntimeOptions {
    factor: number;
    audio?: SpeedAudioMode;
}
export interface VideoFromImageRequest extends VideoRuntimeOptions {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    pixelFormat?: string;
    fit?: MediaFit;
    background?: string;
    to?: VideoOutputFormat;
}
export interface RestoreVideoRequest extends VideoRuntimeOptions {
    width: number;
    height: number;
    profile?: RestoreProfile;
    fps?: number;
    crf?: number;
    preset?: string;
    fit?: MediaFit;
    background?: string;
    to?: VideoOutputFormat;
}
//# sourceMappingURL=types.d.ts.map