import { Option } from "commander";
export function configureVideoOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg video trim-start":
        case "cecilia-ffmpeg video trim-end":
            command.requiredOption("--seconds <seconds>", "seconds to remove").option("--mode <mode>", "trim mode: auto, copy, or accurate", "auto");
            break;
        case "cecilia-ffmpeg video trim":
            command
                .option("--start <seconds>", "range start in seconds", "0")
                .option("--end <seconds>", "range end in seconds")
                .option("--duration <seconds>", "range duration in seconds")
                .option("--mode <mode>", "trim mode: auto, copy, or accurate", "auto");
            break;
        case "cecilia-ffmpeg video speed":
            command
                .requiredOption("--factor <factor>", "playback-speed multiplier")
                .option("--audio <mode>", "audio handling: sync or drop", "sync");
            break;
        case "cecilia-ffmpeg video from-image":
            command
                .option("--duration <seconds>", "clip duration in seconds", "5")
                .option("--resolution <widthxheight>", "output resolution", "1920x1080")
                .option("--fps <fps>", "output frame rate", "30")
                .option("--pixel-format <format>", "output pixel format", "yuv420p")
                .addOption(new Option("--fit <mode>", "image fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
                .option("--background <color>", "padding color for contain fit", "black")
                .addOption(new Option("--to <format>", "video output format").choices(["mp4", "webm"]).default("mp4"))
                .addOption(new Option("--hardware <mode>", "video encoder policy: software, auto, nvenc, qsv, vaapi, or videotoolbox").choices(["software", "auto", "nvenc", "qsv", "vaapi", "videotoolbox"]).default("software"))
                .option("--hardware-device <path>", "explicit hardware device path; currently used by VAAPI")
                .option("--hardware-strict", "fail instead of falling back to software when hardware is unavailable", false);
            break;
        case "cecilia-ffmpeg video restore":
        case "cecilia-ffmpeg video upscale":
            command
                .requiredOption("--resolution <widthxheight>", "target resolution")
                .option("--profile <profile>", "upscale profile: balanced or aggressive", "balanced")
                .option("--fps <fps>", "optional output frame rate")
                .option("--crf <crf>", "encoder quality CRF")
                .option("--preset <preset>", "encoder preset")
                .addOption(new Option("--fit <mode>", "frame fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
                .option("--background <color>", "padding color for contain fit", "black")
                .addOption(new Option("--to <format>", "video output format").choices(["mp4", "webm"]).default("mp4"))
                .addOption(new Option("--hardware <mode>", "video encoder policy: software, auto, nvenc, qsv, vaapi, or videotoolbox").choices(["software", "auto", "nvenc", "qsv", "vaapi", "videotoolbox"]).default("software"))
                .option("--hardware-device <path>", "explicit hardware device path; currently used by VAAPI")
                .option("--hardware-strict", "fail instead of falling back to software when hardware is unavailable", false);
            break;
        default:
            break;
    }
}
//# sourceMappingURL=video-options.js.map