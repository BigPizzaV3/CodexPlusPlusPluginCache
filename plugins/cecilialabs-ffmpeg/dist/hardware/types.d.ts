import type { ToolkitWarning } from "../types/contracts.js";
export type HardwareEncoderBackend = "nvenc" | "qsv" | "vaapi" | "videotoolbox";
export type HardwareMode = "auto" | "software" | HardwareEncoderBackend;
export type HardwareVideoCodec = "h264" | "vp9";
export interface HardwareRuntimeOptions {
    /** Hardware policy. Omitted/software preserves the v1 software encoder behavior. */
    hardware?: HardwareMode;
    /** Optional backend device path. Currently used by VAAPI. */
    hardwareDevice?: string;
    /** Fail instead of falling back to software when the requested hardware path cannot be used. */
    hardwareStrict?: boolean;
}
export interface HardwareEncodingAttempt {
    backend: HardwareEncoderBackend;
    encoder: string;
    compiled: boolean;
    runtimeUsable?: boolean;
    reason?: string;
    /** Short FFmpeg/runtime diagnostic retained when a hardware probe fails. */
    diagnostic?: string;
}
export interface HardwareEncodingSelection {
    requested: HardwareMode;
    resolved: "software" | HardwareEncoderBackend;
    codec: HardwareVideoCodec;
    encoder: string;
    softwareEncoder: string;
    runtimeVerified: boolean;
    fallback: boolean;
    device?: string;
    attempts: HardwareEncodingAttempt[];
    warning?: ToolkitWarning;
}
export interface SelectHardwareEncodingOptions extends HardwareRuntimeOptions {
    codec: HardwareVideoCodec;
    ffmpegPath?: string;
    cwd?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
    platform?: NodeJS.Platform;
}
//# sourceMappingURL=types.d.ts.map