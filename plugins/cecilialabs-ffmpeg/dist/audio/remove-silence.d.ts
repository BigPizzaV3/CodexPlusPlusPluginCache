import type { AudioOperationReport, RemoveSilenceRequest } from "./types.js";
export declare function buildSilenceRemoveFilter(noiseDb: number, minDuration: number, keepSilence: number): string;
export declare function removeSilence(input: string, request?: RemoveSilenceRequest): Promise<AudioOperationReport>;
//# sourceMappingURL=remove-silence.d.ts.map