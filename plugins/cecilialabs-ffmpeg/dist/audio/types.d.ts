import type { CommandExecution, MediaInfo, SilenceInterval, ToolkitWarning } from "../types/contracts.js";
export type AudioOperation = "attach" | "silence" | "add-silence" | "detect-silence" | "remove-silence" | "telephony";
export type AudioVideoMode = "auto" | "copy" | "encode";
export type AttachAudioMode = "replace" | "append";
export type TelephonyCodec = "mulaw" | "alaw" | "gsm" | "pcm";
export type TelephonyContainer = "wav" | "mulaw" | "alaw" | "gsm" | "s16le";
export interface AudioRuntimeOptions {
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
export interface AudioOperationReport {
    operation: Exclude<AudioOperation, "detect-silence">;
    sources: string[];
    output: string;
    planned: boolean;
    invocation: string;
    execution: CommandExecution;
    inputMedia?: MediaInfo[];
    outputMedia?: MediaInfo;
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
export interface SilenceDetectionReport {
    operation: "detect-silence";
    source: string;
    planned: boolean;
    invocation: string;
    execution: CommandExecution;
    inputMedia?: MediaInfo;
    noiseDb: number;
    minDuration: number;
    silences: SilenceInterval[];
    totalSilenceDuration: number;
    mediaDuration?: number;
    nonSilentDuration?: number;
    warnings: ToolkitWarning[];
}
export interface AttachAudioRequest extends AudioRuntimeOptions {
    mode?: AttachAudioMode;
    videoMode?: AudioVideoMode;
    pad?: boolean;
}
export interface GenerateSilenceRequest extends AudioRuntimeOptions {
    duration?: number;
    sampleRate?: number;
    channels?: number;
    channelLayout?: string;
}
export interface AddSilenceRequest extends AudioRuntimeOptions {
    sampleRate?: number;
    channels?: number;
    channelLayout?: string;
    videoMode?: AudioVideoMode;
    replaceExisting?: boolean;
}
export interface DetectSilenceRequest extends AudioRuntimeOptions {
    noiseDb?: number;
    minDuration?: number;
}
export interface RemoveSilenceRequest extends AudioRuntimeOptions {
    noiseDb?: number;
    minDuration?: number;
    keepSilence?: number;
}
export interface TelephonyRequest extends AudioRuntimeOptions {
    codec: TelephonyCodec;
    container?: TelephonyContainer;
    sampleRate?: number;
    channels?: number;
    sampleFormat?: string;
}
//# sourceMappingURL=types.d.ts.map