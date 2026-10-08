import type { MediaInfo } from "../types/contracts.js";
import type { AudioVideoMode } from "./types.js";
export interface AudioEncodingProfile {
    container: string;
    codec: string;
    codecArgs: string[];
    muxerArgs: string[];
}
export declare function resolveAudioEncodingProfile(output: string): AudioEncodingProfile;
export declare function audioEncodingArgs(profile: AudioEncodingProfile): string[];
export declare function audioCodecForVideoContainer(output: string): string;
export declare function canCopyVideoToContainer(media: MediaInfo, output: string): boolean;
export declare function resolveVideoMode(media: MediaInfo, output: string, requested: AudioVideoMode | undefined): "copy" | "encode";
//# sourceMappingURL=encoding.d.ts.map