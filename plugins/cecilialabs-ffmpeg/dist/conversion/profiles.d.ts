import { type HardwareEncodingSelection } from "../hardware/index.js";
import type { MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { ConversionFormat, ConversionTuningOptions } from "./types.js";
export interface ConversionPlan {
    argsBeforeOutput: string[];
    warnings: ToolkitWarning[];
    details: Record<string, unknown>;
}
export declare function targetExtension(format: ConversionFormat): string;
export declare function normalizeConversionFormat(value: string): ConversionFormat | undefined;
export declare function inferConversionFormat(file: string): ConversionFormat | undefined;
export declare function isExtensionForFormat(file: string, format: ConversionFormat): boolean;
export declare function assertSupportedConversion(from: ConversionFormat, to: ConversionFormat): void;
export declare function buildConversionPlan(source: string, from: ConversionFormat, to: ConversionFormat, media: MediaInfo, options?: ConversionTuningOptions, hardware?: HardwareEncodingSelection): ConversionPlan;
//# sourceMappingURL=profiles.d.ts.map