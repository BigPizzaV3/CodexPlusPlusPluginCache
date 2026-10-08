import type { AudioOperationReport, TelephonyCodec, TelephonyContainer, TelephonyRequest } from "./types.js";
interface TelephonyProfile {
    codec: TelephonyCodec;
    ffmpegCodec: string;
    container: TelephonyContainer;
    extension: string;
    muxer?: string;
    sampleRate: number;
    channels: number;
    sampleFormat: string;
}
export declare function resolveTelephonyProfile(request: TelephonyRequest): TelephonyProfile;
export declare function transcodeTelephony(input: string, request: TelephonyRequest): Promise<AudioOperationReport>;
export {};
//# sourceMappingURL=telephony.d.ts.map