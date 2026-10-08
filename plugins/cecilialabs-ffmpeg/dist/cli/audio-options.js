export function configureAudioOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg audio attach":
        case "cecilia-ffmpeg video attach-audio":
            command
                .option("--mode <mode>", "audio attach mode: replace or append", "replace")
                .option("--video-mode <mode>", "video handling: auto, copy, or encode", "auto")
                .option("--no-pad", "do not pad the attached audio to the video duration");
            break;
        case "cecilia-ffmpeg audio silence":
            command
                .option("--duration <seconds>", "silence duration", "1")
                .option("--sample-rate <hz>", "output sample rate", "48000")
                .option("--channels <count>", "output channel count", "2")
                .option("--channel-layout <layout>", "explicit FFmpeg channel layout");
            break;
        case "cecilia-ffmpeg audio add-silence":
        case "cecilia-ffmpeg video add-silence":
            command
                .option("--sample-rate <hz>", "silent-track sample rate", "48000")
                .option("--channels <count>", "silent-track channel count", "2")
                .option("--channel-layout <layout>", "explicit FFmpeg channel layout")
                .option("--video-mode <mode>", "video handling: auto, copy, or encode", "auto")
                .option("--replace-existing", "replace existing audio streams with silence", false);
            break;
        case "cecilia-ffmpeg audio detect-silence":
            command
                .option("--noise-db <db>", "silence threshold in dB", "-30")
                .option("--min-duration <seconds>", "minimum silence duration", "0.5");
            break;
        case "cecilia-ffmpeg audio remove-silence":
            command
                .option("--noise-db <db>", "silence threshold in dB", "-30")
                .option("--min-duration <seconds>", "minimum silence duration", "0.5")
                .option("--keep-silence <seconds>", "maximum silence retained around cuts", "0.05");
            break;
        case "cecilia-ffmpeg audio telephony":
            command
                .requiredOption("--codec <codec>", "telephony codec: mulaw, alaw, gsm, or pcm")
                .option("--container <container>", "container: wav, mulaw, alaw, gsm, or s16le")
                .option("--sample-rate <hz>", "output sample rate", "8000")
                .option("--channels <count>", "output channel count", "1")
                .option("--sample-format <format>", "FFmpeg sample format", "s16");
            break;
        default:
            break;
    }
}
//# sourceMappingURL=audio-options.js.map