import type { ExecutionContextInfo, SkillExecutionContext } from "../skill-runtime/types.js";
import { type EnvironmentCapabilities } from "./capabilities.js";
import { type EnvironmentVersionReport } from "./version.js";
export type EnvironmentReadinessStatus = "ready" | "warning" | "blocked" | "planned";
export interface EnvironmentCheckOptions {
    context?: SkillExecutionContext;
    cwd?: string;
    outputPath?: string;
    ffmpegPath?: string;
    ffprobePath?: string;
    toolkitPath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
    environment?: NodeJS.ProcessEnv;
}
export interface ExecutableCheck {
    available: boolean;
    path?: string;
    version?: string;
    error?: string;
}
export interface RuntimeExecutableCheck extends ExecutableCheck {
    minimumSupported?: string;
    compatible?: boolean;
}
export interface EnvironmentVersionSummary {
    planned: boolean;
    minimumSupportedFFmpeg: string;
    ffmpeg: {
        path: string;
        version?: string;
    };
    ffprobe: {
        path: string;
        version?: string;
    };
    compatible?: boolean;
    warnings: EnvironmentVersionReport["warnings"];
}
export interface EnvironmentCapabilitySummary {
    planned: boolean;
    ffmpegPath: string;
    codecs: string[];
    encoders: string[];
    decoders: string[];
    filters: string[];
    hardwareAcceleration: EnvironmentCapabilities["hardwareAcceleration"];
    plannedCommands: string[];
}
export interface EnvironmentCheckReport {
    status: EnvironmentReadinessStatus;
    context: ExecutionContextInfo;
    observed: {
        platform: NodeJS.Platform;
        architecture: string;
        hostname: string;
        cwd: string;
        canInspectFiles: boolean;
        canExecuteScripts: boolean;
        canInstallDependencies: boolean;
    };
    runtime: {
        node: RuntimeExecutableCheck;
        npm: RuntimeExecutableCheck;
    };
    toolkit: ExecutableCheck;
    ffmpeg: ExecutableCheck & {
        minimumSupported?: string;
        compatible?: boolean;
    };
    ffprobe: ExecutableCheck;
    versions?: EnvironmentVersionSummary;
    capabilities?: EnvironmentCapabilitySummary;
    output?: {
        path: string;
        exists: boolean;
        writable: boolean;
        parent: string;
    };
    plannedCommands: string[];
    warnings: Array<{
        code: string;
        message: string;
        details?: Record<string, unknown>;
    }>;
    next: string[];
}
/**
 * Inspect the host without installing packages or changing shell state.
 * Missing FFmpeg-family binaries are reported as readiness facts, not thrown
 * away as an opaque command failure.
 */
export declare function inspectEnvironmentReadiness(options?: EnvironmentCheckOptions): Promise<EnvironmentCheckReport>;
//# sourceMappingURL=readiness.d.ts.map