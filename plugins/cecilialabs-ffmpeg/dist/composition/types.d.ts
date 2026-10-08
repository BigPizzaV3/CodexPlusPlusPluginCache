import type { MediaFit } from "../media/fit.js";
import type { CommandExecution, MediaInfo, ToolkitWarning } from "../types/contracts.js";
export type CompositionOperation = "concat" | "transition" | "slideshow";
export type CompositionAudioMode = "auto" | "drop" | "preserve";
export type CompositionVideoFormat = "mp4" | "webm";
export type SlideshowOutputFormat = CompositionVideoFormat | "gif" | "webp";
export type XfadeTransition = "fade" | "fadeblack" | "fadewhite" | "wipeleft" | "wiperight" | "slideup" | "slidedown" | "circleopen" | "circleclose" | "dissolve" | "pixelize" | "distance" | "zoomin" | "zoomout";
export type SlideshowDirection = "up" | "down";
export type SlideshowStyle = "vertical-stack" | "sequence";
export interface CompositionRuntimeOptions {
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
export interface NormalizeCompositionOptions {
    width?: number;
    height?: number;
    fps?: number;
    pixelFormat?: string;
    fit?: MediaFit;
    background?: string;
}
export interface ConcatRequest extends CompositionRuntimeOptions, NormalizeCompositionOptions {
    transition?: "none" | XfadeTransition;
    transitionDuration?: number;
    audio?: CompositionAudioMode;
    to?: CompositionVideoFormat;
}
export interface TransitionRequest extends CompositionRuntimeOptions, NormalizeCompositionOptions {
    transition?: XfadeTransition;
    duration?: number;
    offset?: number;
    audio?: CompositionAudioMode;
    to?: CompositionVideoFormat;
}
export interface SlideshowRequest extends CompositionRuntimeOptions {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    background?: string;
    fit?: MediaFit;
    direction?: SlideshowDirection;
    includeIntro?: boolean;
    includeOutro?: boolean;
    recursive?: boolean;
    includes?: readonly string[];
    excludes?: readonly string[];
    style?: SlideshowStyle;
    transition?: "none" | XfadeTransition;
    transitionDuration?: number;
    to?: SlideshowOutputFormat;
}
export interface CompositionReport {
    operation: CompositionOperation;
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
//# sourceMappingURL=types.d.ts.map