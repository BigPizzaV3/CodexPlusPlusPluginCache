import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
export function resolveAudioEncodingProfile(output) {
    const extension = path.extname(output).toLowerCase();
    switch (extension) {
        case ".wav":
            return { container: "wav", codec: "pcm_s16le", codecArgs: [], muxerArgs: [] };
        case ".mp3":
            return { container: "mp3", codec: "libmp3lame", codecArgs: ["-q:a", "2"], muxerArgs: [] };
        case ".m4a":
        case ".aac":
            return { container: extension.slice(1), codec: "aac", codecArgs: ["-b:a", "192k"], muxerArgs: [] };
        case ".flac":
            return { container: "flac", codec: "flac", codecArgs: [], muxerArgs: [] };
        case ".ogg":
        case ".opus":
            return { container: extension.slice(1), codec: "libopus", codecArgs: ["-b:a", "128k"], muxerArgs: [] };
        case ".gsm":
            return { container: "gsm", codec: "libgsm", codecArgs: [], muxerArgs: ["-f", "gsm"] };
        case ".ulaw":
        case ".mulaw":
            return { container: "mulaw", codec: "pcm_mulaw", codecArgs: [], muxerArgs: ["-f", "mulaw"] };
        case ".alaw":
            return { container: "alaw", codec: "pcm_alaw", codecArgs: [], muxerArgs: ["-f", "alaw"] };
        case ".s16le":
        case ".pcm":
            return { container: "s16le", codec: "pcm_s16le", codecArgs: [], muxerArgs: ["-f", "s16le"] };
        default:
            throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", `Unsupported audio output extension: ${extension || "(none)"}`, {
                details: { output, supportedExtensions: [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".gsm", ".ulaw", ".mulaw", ".alaw", ".s16le", ".pcm"] },
            });
    }
}
export function audioEncodingArgs(profile) {
    return ["-c:a", profile.codec, ...profile.codecArgs, ...profile.muxerArgs];
}
export function audioCodecForVideoContainer(output) {
    const extension = path.extname(output).toLowerCase();
    if (extension === ".webm")
        return "libopus";
    if ([".mp4", ".m4v", ".mov", ".mkv"].includes(extension))
        return "aac";
    throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", `Unsupported video output extension for audio operation: ${extension || "(none)"}`, {
        details: { output, supportedExtensions: [".mp4", ".m4v", ".mov", ".mkv", ".webm"] },
    });
}
function codecName(media) {
    return media.video[0]?.codecName?.toLowerCase();
}
export function canCopyVideoToContainer(media, output) {
    const extension = path.extname(output).toLowerCase();
    const codec = codecName(media);
    if (!codec)
        return false;
    if (extension === ".mkv")
        return true;
    if (extension === ".webm")
        return ["vp8", "vp9", "av1"].includes(codec);
    if ([".mp4", ".m4v", ".mov"].includes(extension)) {
        return ["h264", "hevc", "mpeg4", "av1"].includes(codec);
    }
    return false;
}
export function resolveVideoMode(media, output, requested) {
    const mode = requested ?? "auto";
    if (mode === "copy" || mode === "encode")
        return mode;
    return canCopyVideoToContainer(media, output) ? "copy" : "encode";
}
//# sourceMappingURL=encoding.js.map