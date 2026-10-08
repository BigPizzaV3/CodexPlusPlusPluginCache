export interface FFmpegProgressSnapshot {
    frame?: number;
    fps?: number;
    stream0_0Q?: number;
    bitrate?: string;
    totalSize?: number;
    outTimeUs?: number;
    outTimeMs?: number;
    outTime?: string;
    dupFrames?: number;
    dropFrames?: number;
    speed?: string;
    progress: string;
    raw: Readonly<Record<string, string>>;
}
export interface ProgressDurationEstimate {
    seconds: number;
    source: "explicit" | "probe" | "composition";
    estimated: boolean;
}
export interface FFmpegProgressEvent {
    runId: string;
    state: "continue" | "end";
    estimated: boolean;
    source?: string;
    frame?: number;
    fps?: number;
    speedMultiplier?: number;
    processedSeconds?: number;
    totalSeconds?: number;
    percentage?: number;
    etaSeconds?: number;
}
export declare function parseClockSeconds(value: string | undefined): number | undefined;
export declare function parseSpeedMultiplier(value: string | undefined): number | undefined;
export declare function deriveProgressEvent(runId: string, snapshot: FFmpegProgressSnapshot, options?: {
    source?: string;
    duration?: ProgressDurationEstimate;
}): FFmpegProgressEvent;
export declare function inputSources(args: readonly string[]): string[];
export declare function estimateProgressDuration(args: readonly string[], durationForSource: (source: string) => number | undefined): ProgressDurationEstimate | undefined;
/** Incremental parser for FFmpeg `-progress pipe:N` key/value output. */
export declare class FFmpegProgressParser {
    private buffer;
    private values;
    push(chunk: string): FFmpegProgressSnapshot[];
    flush(): FFmpegProgressSnapshot[];
    private consumeLine;
}
//# sourceMappingURL=progress.d.ts.map