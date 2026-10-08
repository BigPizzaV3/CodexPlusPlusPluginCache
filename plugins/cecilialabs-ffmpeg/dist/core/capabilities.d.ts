import type { CodecCapability, EncoderDecoderCapability, FilterCapability } from "../types/contracts.js";
/** Remove terminal escape sequences before parsing FFmpeg capability tables. */
export declare function stripAnsi(text: string): string;
export interface BinaryVersion {
    product: "ffmpeg" | "ffprobe";
    version: string;
    major?: number;
    minor?: number;
    patch?: number;
    raw: string;
}
/** Parse the first line produced by `ffmpeg -version` or `ffprobe -version`. */
export declare function parseBinaryVersionLine(line: string): BinaryVersion | undefined;
export declare function isVersionAtLeast(version: BinaryVersion, minimum: {
    major: number;
    minor: number;
    patch?: number;
}): boolean | undefined;
/** Parse the table emitted by `ffmpeg -encoders` or `ffmpeg -decoders`. */
export declare function parseEncoderDecoderTable(text: string, kind: "encoder" | "decoder"): EncoderDecoderCapability[];
/** Parse the table emitted by `ffmpeg -codecs`. */
export declare function parseCodecTable(text: string): CodecCapability[];
/** Parse the table emitted by `ffmpeg -filters`. */
export declare function parseFilterTable(text: string): FilterCapability[];
/** Parse the simple list emitted by `ffmpeg -hwaccels`. */
export declare function parseHardwareAccelerators(text: string): string[];
//# sourceMappingURL=capabilities.d.ts.map