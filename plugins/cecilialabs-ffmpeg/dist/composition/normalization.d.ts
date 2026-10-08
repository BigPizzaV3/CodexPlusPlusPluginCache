import type { MediaInfo } from "../types/contracts.js";
import type { NormalizeCompositionOptions } from "./types.js";
export interface ResolvedVideoNormalization {
    width: number;
    height: number;
    fps: number;
    pixelFormat: string;
    fit: "contain" | "cover" | "stretch";
    background: string;
}
export declare function resolveVideoNormalization(media: readonly MediaInfo[], options: NormalizeCompositionOptions): ResolvedVideoNormalization;
export declare function videoNormalizationFilters(normalization: ResolvedVideoNormalization): string[];
export declare const AUDIO_NORMALIZATION_FILTERS: readonly ["aresample=48000", "asetpts=PTS-STARTPTS"];
//# sourceMappingURL=normalization.d.ts.map