import type { MediaInfo } from "../types/contracts.js";
import type { FFmpegProgressEvent } from "./progress.js";
export type ProgressObserver = (event: FFmpegProgressEvent) => void;
export declare function withProgressObserver<T>(observer: ProgressObserver, operation: () => Promise<T>): Promise<T>;
export declare function currentProgressObserver(): ProgressObserver | undefined;
export declare function registerProgressMedia(media: MediaInfo): void;
export declare function progressMediaDuration(source: string): number | undefined;
export declare function nextProgressRunId(): string;
//# sourceMappingURL=progress-context.d.ts.map