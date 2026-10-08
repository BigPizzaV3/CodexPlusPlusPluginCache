import { ToolkitRuntimeError } from "../core/errors.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "../media/io.js";
import { resolveEncodingProfile } from "../video/encoding.js";
import { audioCodecForVideoContainer, resolveVideoMode } from "./encoding.js";
import { executeAudioTransform, inspectAudioInput, requireAudio, requireVideo } from "./helpers.js";
function validateAttachMode(value) {
    const mode = value ?? "replace";
    if (mode !== "replace" && mode !== "append") {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "attach mode must be replace or append.", { details: { mode } });
    }
    return mode;
}
export async function attachAudio(videoInput, audioInput, request = {}) {
    const video = await resolveReadableFile(videoInput, request.cwd);
    const audio = await resolveReadableFile(audioInput, request.cwd);
    const mode = validateAttachMode(request.mode);
    const pad = request.pad ?? true;
    const output = deriveOutputPath(video, mode === "replace" ? "audio-replaced" : "audio-attached", request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source: video, output, overwrite: request.overwrite ?? false });
    const [videoMedia, audioMedia] = await Promise.all([inspectAudioInput(video, request), inspectAudioInput(audio, request)]);
    requireVideo(videoMedia, video);
    requireAudio(audioMedia, audio);
    const videoMode = resolveVideoMode(videoMedia, output, request.videoMode);
    const audioCodec = audioCodecForVideoContainer(output);
    const encodeProfile = videoMode === "encode" ? resolveEncodingProfile(output) : undefined;
    const videoArgs = videoMode === "copy"
        ? ["-c:v", "copy"]
        : ["-c:v", encodeProfile.videoCodec, ...encodeProfile.videoQualityArgs, ...encodeProfile.muxerArgs];
    const filterArgs = pad ? ["-filter_complex", "[1:a:0]apad[newa]"] : [];
    const newAudioMap = pad ? "[newa]" : "1:a:0";
    const mapArgs = mode === "replace"
        ? ["-map", "0:v:0", "-map", newAudioMap]
        : ["-map", "0:v:0", "-map", "0:a?", "-map", newAudioMap];
    const videoDuration = videoMedia.format.durationSeconds;
    const durationArgs = videoDuration !== undefined ? ["-t", String(videoDuration)] : ["-shortest"];
    return await executeAudioTransform({
        operation: "attach",
        sources: [video, audio],
        output,
        argsBeforeOutput: [
            "-i", video,
            "-i", audio,
            ...filterArgs,
            ...mapArgs,
            ...videoArgs,
            "-c:a", audioCodec,
            ...(audioCodec === "aac" ? ["-b:a", "192k"] : audioCodec === "libopus" ? ["-b:a", "128k"] : []),
            ...durationArgs,
            "-map_metadata", "0",
        ],
        runtime: request,
        inputMedia: [videoMedia, audioMedia],
        details: {
            mode,
            pad,
            videoMode,
            audioCodec,
            originalAudioStreams: videoMedia.audio.length,
            attachedAudioStreams: 1,
            ...(videoDuration !== undefined ? { targetDuration: videoDuration } : {}),
        },
    });
}
//# sourceMappingURL=attach.js.map