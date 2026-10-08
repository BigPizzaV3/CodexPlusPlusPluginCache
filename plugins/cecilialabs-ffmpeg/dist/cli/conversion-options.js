import { Option } from "commander";
function collect(value, previous) {
    return [...previous, value];
}
const FORMATS = "mp4, webm, gif, webp, png, jpeg/jpg, wav, mp3, aac, m4a, flac, opus, or ogg";
function addConversionTuningOptions(command) {
    command
        .option("--fps <fps>", "target frame rate for animated/video conversion")
        .option("--width <pixels>", "target visual width")
        .option("--height <pixels>", "target visual height")
        .addOption(new Option("--fit <mode>", "visual fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
        .option("--background <color>", "padding color used by --fit contain", "black")
        .option("--quality <value>", "WebP quality from 0 to 100")
        .option("--max-colors <count>", "GIF palette size from 2 to 256")
        .option("--loop <count>", "animation loop count; 0 means infinite")
        .option("--audio-bitrate <rate>", "audio bitrate, for example 128k or 192k")
        .option("--sample-rate <hz>", "audio output sample rate")
        .option("--channels <count>", "audio output channel count")
        .addOption(new Option("--hardware <mode>", "video encoder policy: software, auto, nvenc, qsv, vaapi, or videotoolbox")
        .choices(["software", "auto", "nvenc", "qsv", "vaapi", "videotoolbox"])
        .default("software"))
        .option("--hardware-device <path>", "explicit hardware device path; currently used by VAAPI")
        .option("--hardware-strict", "fail instead of falling back to software when hardware is unavailable", false);
}
export function configureConversionOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg convert file":
            command
                .requiredOption("--to <format>", `target format: ${FORMATS}`)
                .option("--from <format>", `explicit source format: ${FORMATS}`);
            addConversionTuningOptions(command);
            break;
        case "cecilia-ffmpeg convert batch":
            command
                .requiredOption("--from <format>", `source extension/format selector: ${FORMATS}`)
                .requiredOption("--to <format>", `target format: ${FORMATS}`)
                .option("--recursive", "scan subdirectories recursively", false)
                .option("--include <pattern>", "include glob pattern; repeatable", collect, [])
                .option("--exclude <pattern>", "exclude glob pattern; repeatable", collect, [])
                .option("--parallelism <count>", "maximum concurrent conversions", "2")
                .addOption(new Option("--fail-fast", "stop scheduling new work after the first failure").conflicts("continueOnError"))
                .addOption(new Option("--continue-on-error", "continue converting after item failures").conflicts("failFast"))
                .option("--output-dir <directory>", "write batch outputs under this directory")
                .option("--no-preserve-hierarchy", "flatten discovered files into the output directory")
                .option("--existing <strategy>", "existing output strategy: error, skip, or replace");
            addConversionTuningOptions(command);
            break;
        default:
            break;
    }
}
//# sourceMappingURL=conversion-options.js.map