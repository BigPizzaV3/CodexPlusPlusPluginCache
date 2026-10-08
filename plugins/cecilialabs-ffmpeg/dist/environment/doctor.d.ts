import type { ToolkitWarning } from "../types/contracts.js";
import { type EnvironmentCapabilities } from "./capabilities.js";
import { type EnvironmentVersionReport } from "./version.js";
export type DoctorStatus = "ok" | "warning" | "error" | "planned";
export interface DoctorReport {
    status: DoctorStatus;
    planned: boolean;
    runtime: {
        platform: NodeJS.Platform;
        architecture: string;
        nodeVersion: string;
        hostname: string;
        cpus: number;
    };
    versions: EnvironmentVersionReport;
    capabilitySummary: {
        codecs: number;
        encoders: number;
        decoders: number;
        filters: number;
        hardwareMethods: string[];
        backends: EnvironmentCapabilities["hardwareAcceleration"]["backends"];
    };
    warnings: ToolkitWarning[];
}
export interface DoctorOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
}
export declare function inspectDoctor(options?: DoctorOptions): Promise<DoctorReport>;
//# sourceMappingURL=doctor.d.ts.map