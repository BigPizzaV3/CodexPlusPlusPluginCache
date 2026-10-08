import { type BinaryVersion } from "../core/capabilities.js";
import type { CommandExecution, ToolkitWarning } from "../types/contracts.js";
export declare const MINIMUM_FFMPEG_VERSION: {
    readonly major: 6;
    readonly minor: 1;
    readonly patch: 0;
};
export declare const MINIMUM_FFMPEG_VERSION_LABEL: "6.1";
export interface BinaryVersionReport {
    path: string;
    version?: BinaryVersion;
    execution: CommandExecution;
}
export interface EnvironmentVersionReport {
    planned: boolean;
    minimumSupportedFFmpeg: string;
    ffmpeg: BinaryVersionReport;
    ffprobe: BinaryVersionReport;
    compatible?: boolean;
    warnings: ToolkitWarning[];
}
export interface InspectVersionOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
}
export declare function inspectEnvironmentVersions(options?: InspectVersionOptions): Promise<EnvironmentVersionReport>;
//# sourceMappingURL=version.d.ts.map