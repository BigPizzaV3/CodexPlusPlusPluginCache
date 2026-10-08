import type { AddSilenceRequest, AudioOperationReport, GenerateSilenceRequest } from "./types.js";
export declare function channelLayoutFor(channels: number, explicit?: string): string;
export declare function generateSilence(request?: GenerateSilenceRequest): Promise<AudioOperationReport>;
export declare function addSilenceToVideo(input: string, request?: AddSilenceRequest): Promise<AudioOperationReport>;
//# sourceMappingURL=silence.d.ts.map