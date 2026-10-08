import { Option } from "commander";
export function configureDiagnosticsOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg diagnose":
            command
                .option("--deep", "run additional freeze detection", false)
                .option("--log <path>", "merge diagnostics from an existing FFmpeg stderr log")
                .option("--freeze-noise-db <db>", "freezedetect noise threshold in dB", "-50")
                .option("--freeze-duration <seconds>", "minimum freeze duration", "2");
            break;
        case "cecilia-ffmpeg repair timestamps":
            command
                .addOption(new Option("--mode <mode>", "repair mode").choices(["remux", "reencode"]).default("reencode"))
                .option("--fps <fps>", "force a constant output frame rate when re-encoding");
            break;
        case "cecilia-ffmpeg repair normalize":
            command
                .option("--width <pixels>", "normalized video width")
                .option("--height <pixels>", "normalized video height")
                .option("--fps <fps>", "normalized video frame rate")
                .option("--pixel-format <format>", "normalized video pixel format", "yuv420p")
                .option("--sample-rate <hz>", "normalized audio sample rate")
                .option("--channels <count>", "normalized audio channel count");
            break;
        default:
            break;
    }
}
//# sourceMappingURL=diagnostics-options.js.map