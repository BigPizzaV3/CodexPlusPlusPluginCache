import type { CommandExecution, MediaInfo, ToolkitWarning } from "../types/contracts.js";
export type DiagnosticSeverity = "info" | "warning" | "error";
export type DiagnosticCode = "MISSING_VIDEO_STREAM" | "MISSING_AUDIO_STREAM" | "MULTIPLE_VIDEO_STREAMS" | "MULTIPLE_AUDIO_STREAMS" | "POSSIBLE_VFR" | "INVALID_TIME_BASE" | "NEGATIVE_START_TIME" | "NON_SQUARE_PIXELS" | "PIXEL_FORMAT_INTEROP" | "WEBM_CODEC_MISMATCH" | "DECODE_WARNING" | "DECODE_ERROR" | "NON_MONOTONIC_DTS" | "TIMESTAMP_DISCONTINUITY" | "PTS_DTS_ERROR" | "STREAM_MAPPING_ERROR" | "FILTER_GRAPH_ERROR" | "CORRUPT_PACKET" | "FREEZE_DETECTED" | "FREEZE_SCAN_UNAVAILABLE";
export interface DiagnosticIssue {
    code: DiagnosticCode;
    severity: DiagnosticSeverity;
    message: string;
    streamIndex?: number;
    details?: Record<string, unknown>;
}
export interface FreezeInterval {
    start: number;
    end?: number;
    duration?: number;
}
export interface DiagnoseOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
    deep?: boolean;
    freezeNoiseDb?: number;
    freezeDuration?: number;
    logText?: string;
}
export interface DiagnosticReport {
    source: string;
    planned: boolean;
    media: MediaInfo;
    issues: DiagnosticIssue[];
    freezes: FreezeInterval[];
    decodeExecution?: CommandExecution;
    freezeExecution?: CommandExecution;
    warnings: ToolkitWarning[];
}
export type TimestampRepairMode = "remux" | "reencode";
export interface RepairRuntimeOptions {
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
export interface RepairTimestampsOptions extends RepairRuntimeOptions {
    mode?: TimestampRepairMode;
    fps?: number;
}
export interface NormalizeMediaOptions extends RepairRuntimeOptions {
    width?: number;
    height?: number;
    fps?: number;
    pixelFormat?: string;
    sampleRate?: number;
    channels?: number;
}
export interface RepairReport {
    operation: "timestamps" | "normalize";
    source: string;
    output: string;
    planned: boolean;
    invocation: string;
    execution: CommandExecution;
    inputMedia: MediaInfo;
    outputMedia?: MediaInfo;
    before: DiagnosticIssue[];
    after?: DiagnosticIssue[];
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map