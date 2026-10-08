import type { HardwareMode } from "../hardware/types.js";
import type { MediaFit } from "../media/fit.js";
import type { MediaInfo, ToolkitWarning, TrimMode } from "../types/contracts.js";
import type { RestoreProfile, SpeedAudioMode, VideoOutputFormat } from "../video/types.js";
import type { ConversionFormat } from "../conversion/types.js";
export interface PipelineTrimStep {
    trim: {
        start?: number | undefined;
        end?: number | undefined;
        duration?: number | undefined;
        mode?: TrimMode | undefined;
    };
}
export interface PipelineSpeedStep {
    speed: {
        factor: number;
        audio?: SpeedAudioMode | undefined;
    };
}
export interface PipelineResizeStep {
    resize: {
        width: number;
        height: number;
        fit?: MediaFit | undefined;
        background?: string | undefined;
        profile?: RestoreProfile | undefined;
        fps?: number | undefined;
        crf?: number | undefined;
        preset?: string | undefined;
        to?: VideoOutputFormat | undefined;
        hardware?: HardwareMode | undefined;
        hardwareDevice?: string | undefined;
        hardwareStrict?: boolean | undefined;
    };
}
export interface PipelineNormalizeStep {
    normalize: {
        width?: number | undefined;
        height?: number | undefined;
        fps?: number | undefined;
        pixelFormat?: string | undefined;
        sampleRate?: number | undefined;
        channels?: number | undefined;
    };
}
export interface PipelineAudioStep {
    audio: {
        normalize: true;
        sampleRate?: number | undefined;
        channels?: number | undefined;
    };
}
export interface PipelineConvertStep {
    convert: {
        to: ConversionFormat;
        fps?: number | undefined;
        width?: number | undefined;
        height?: number | undefined;
        fit?: MediaFit | undefined;
        background?: string | undefined;
        quality?: number | undefined;
        maxColors?: number | undefined;
        loop?: number | undefined;
        audioBitrate?: string | undefined;
        sampleRate?: number | undefined;
        channels?: number | undefined;
        hardware?: HardwareMode | undefined;
        hardwareDevice?: string | undefined;
        hardwareStrict?: boolean | undefined;
    };
}
export interface PipelinePresetStep {
    preset: string;
}
export type ConcretePipelineStep = PipelineTrimStep | PipelineSpeedStep | PipelineResizeStep | PipelineNormalizeStep | PipelineAudioStep | PipelineConvertStep;
export type PipelineStep = PipelineTrimStep | PipelineSpeedStep | PipelineResizeStep | PipelineNormalizeStep | PipelineAudioStep | PipelineConvertStep | PipelinePresetStep;
export interface PipelineOutput {
    path: string;
    codec?: "h264" | "vp9" | undefined;
}
export interface PipelineDocument {
    version: 1;
    input: string;
    presets: Record<string, PipelineStep[]>;
    steps: PipelineStep[];
    output: PipelineOutput;
}
export interface LoadedPipeline {
    file: string;
    baseDirectory: string;
    document: PipelineDocument;
}
export interface PipelineRuntimeOptions {
    /** Optional final-output override. Relative paths resolve from the pipeline file directory. */
    output?: string | undefined;
    overwrite?: boolean | undefined;
    dryRun?: boolean | undefined;
    verbose?: boolean | undefined;
    ffmpegPath?: string | undefined;
    ffprobePath?: string | undefined;
    signal?: AbortSignal | undefined;
    keepTemp?: boolean | undefined;
}
export type PipelineStepKind = "trim" | "speed" | "resize" | "normalize" | "audio" | "convert";
export interface PipelineStepReport {
    index: number;
    kind: PipelineStepKind;
    input: string;
    output: string;
    planned: boolean;
    invocation?: string | undefined;
    durationMs?: number | undefined;
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
export interface PipelineReport {
    operation: "pipeline";
    file: string;
    source: string;
    output: string;
    planned: boolean;
    stepCount: number;
    steps: PipelineStepReport[];
    warnings: ToolkitWarning[];
    outputMedia?: MediaInfo | undefined;
    workspace?: string | undefined;
}
//# sourceMappingURL=types.d.ts.map