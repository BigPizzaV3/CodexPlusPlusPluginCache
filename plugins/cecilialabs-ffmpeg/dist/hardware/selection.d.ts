import type { HardwareEncoderBackend, HardwareEncodingSelection, HardwareVideoCodec, SelectHardwareEncodingOptions } from "./types.js";
export declare const HARDWARE_RUNTIME_PROBE_SIZE: "256x256";
export declare function hardwareEncoderName(backend: HardwareEncoderBackend, codec: HardwareVideoCodec): string | undefined;
export declare function softwareEncoderName(codec: HardwareVideoCodec): string;
export declare function preferredHardwareBackends(platform: NodeJS.Platform, codec: HardwareVideoCodec): HardwareEncoderBackend[];
export declare function hardwareGlobalArgs(selection: HardwareEncodingSelection): string[];
export declare function hardwareFilterSuffix(selection: HardwareEncodingSelection): string[];
export declare function hardwareVideoEncodingArgs(selection: HardwareEncodingSelection, options?: {
    softwareCrf?: number;
    softwarePreset?: string;
}): string[];
export declare function selectHardwareEncoding(options: SelectHardwareEncodingOptions): Promise<HardwareEncodingSelection>;
//# sourceMappingURL=selection.d.ts.map