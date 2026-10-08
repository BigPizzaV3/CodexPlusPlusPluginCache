import type { FFmpegProgressEvent } from "../core/progress.js";
import type { ProgressSummary } from "../types/contracts.js";
export type ProgressWriter = (text: string) => void;
export interface CliProgressReporterOptions {
    enabled: boolean;
    isTTY?: boolean;
    friendly?: boolean;
    write?: ProgressWriter;
    now?: () => number;
}
export declare function formatProgressDuration(seconds: number | undefined): string;
export declare function formatHumanProgress(event: FFmpegProgressEvent, friendly?: boolean): string;
export declare class CliProgressReporter {
    private readonly enabled;
    private readonly isTTY;
    private readonly friendly;
    private readonly write;
    private readonly now;
    private readonly runs;
    private readonly lastRenderedAt;
    private readonly lastBucket;
    private ttyLineOpen;
    constructor(options: CliProgressReporterOptions);
    readonly onEvent: (event: FFmpegProgressEvent) => void;
    finish(): void;
    summary(): ProgressSummary | undefined;
}
//# sourceMappingURL=progress-renderer.d.ts.map