export type MediaBinaryKind = "ffmpeg" | "ffprobe";
export interface ResolveBinaryOptions {
    kind: MediaBinaryKind;
    explicitPath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
}
/**
 * Resolve an FFmpeg-family binary without invoking a shell. Resolution order:
 * explicit CLI/API override -> FFMPEG_PATH/FFPROBE_PATH -> PATH lookup.
 */
export declare function resolveBinary(options: ResolveBinaryOptions): Promise<string>;
//# sourceMappingURL=binary-resolver.d.ts.map