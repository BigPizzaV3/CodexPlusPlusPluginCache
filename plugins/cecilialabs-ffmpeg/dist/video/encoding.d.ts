import { type HardwareEncodingSelection } from "../hardware/index.js";
export interface EncodingProfile {
    container: "mp4" | "mov" | "mkv" | "webm";
    videoCodec: string;
    audioCodec: string;
    videoQualityArgs: string[];
    audioArgs: string[];
    muxerArgs: string[];
    softwareCrf: number;
    softwarePreset?: string;
}
export declare function resolveEncodingProfile(output: string, options?: {
    crf?: number;
    preset?: string;
}): EncodingProfile;
export declare function encodingArgs(profile: EncodingProfile, includeAudio: boolean, hardware?: HardwareEncodingSelection): string[];
//# sourceMappingURL=encoding.d.ts.map