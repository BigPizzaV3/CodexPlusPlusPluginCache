import type { CommandExecution, MediaInfo } from "../types/contracts.js";
export interface ProbeMediaOptions {
    ffprobePath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
    cwd?: string;
}
export interface ProbeReport {
    source: string;
    planned: boolean;
    media?: MediaInfo;
    invocation: string;
    execution: CommandExecution;
}
export declare function probeMedia(input: string, options?: ProbeMediaOptions): Promise<ProbeReport>;
//# sourceMappingURL=probe.d.ts.map