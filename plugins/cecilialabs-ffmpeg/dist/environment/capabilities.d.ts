import type { CodecCapability, EncoderDecoderCapability, FilterCapability, HardwareAccelerationInfo } from "../types/contracts.js";
export interface EnvironmentCapabilities {
    planned: boolean;
    ffmpegPath: string;
    codecs: CodecCapability[];
    encoders: EncoderDecoderCapability[];
    decoders: EncoderDecoderCapability[];
    filters: FilterCapability[];
    hardwareAcceleration: HardwareAccelerationInfo;
    plannedCommands: string[];
}
export interface InspectCapabilitiesOptions {
    ffmpegPath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
}
export declare function inspectEnvironmentCapabilities(options?: InspectCapabilitiesOptions): Promise<EnvironmentCapabilities>;
//# sourceMappingURL=capabilities.d.ts.map