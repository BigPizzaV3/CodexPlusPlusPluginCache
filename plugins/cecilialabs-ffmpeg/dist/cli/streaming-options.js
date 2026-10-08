import { Option } from "commander";
const TRANSPORTS = ["http", "rtmp", "rtsp", "srt", "udp", "tcp", "websocket"];
const CONTAINERS = ["mpegts", "flv", "rtsp"];
const VIDEO_CODECS = ["h264", "mpeg1video", "copy"];
const AUDIO_CODECS = ["aac", "copy", "none"];
function addDestination(command) {
    command
        .requiredOption("--url <url>", "network destination URL")
        .addOption(new Option("--transport <transport>", "network transport; inferred from URL when omitted").choices(TRANSPORTS))
        .addOption(new Option("--container <container>", "output container/muxer; inferred from transport when omitted").choices(CONTAINERS))
        .addOption(new Option("--rtsp-transport <mode>", "RTSP lower transport").choices(["tcp", "udp"]).default("tcp"));
}
function addEncoding(command) {
    command
        .addOption(new Option("--video-codec <codec>", "video encoding mode").choices(VIDEO_CODECS).default("h264"))
        .addOption(new Option("--audio-codec <codec>", "audio encoding mode").choices(AUDIO_CODECS))
        .option("--video-bitrate <rate>", "video bitrate, for example 500k or 2M")
        .option("--audio-bitrate <rate>", "AAC audio bitrate", "128k")
        .option("--preset <name>", "libx264 preset", "veryfast")
        .option("--gop <frames>", "video GOP/keyframe interval")
        .option("--pixel-format <format>", "encoded video pixel format", "yuv420p");
}
export function configureStreamingOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg stream camera":
            addDestination(command);
            addEncoding(command);
            command
                .requiredOption("--device <device>", "camera device, for example /dev/video0 or video=Camera")
                .addOption(new Option("--input-format <format>", "capture backend").choices(["v4l2", "avfoundation", "dshow"]))
                .option("--framerate <fps>", "capture frame rate")
                .option("--video-size <size>", "capture frame size as WIDTHxHEIGHT");
            break;
        case "cecilia-ffmpeg stream file":
            addDestination(command);
            addEncoding(command);
            command.option("--no-realtime", "do not throttle file input to its native playback rate");
            break;
        default:
            break;
    }
}
//# sourceMappingURL=streaming-options.js.map