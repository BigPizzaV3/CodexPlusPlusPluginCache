import { Option } from "commander";
export function configureImageOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg image convert":
            command
                .requiredOption("--to <format>", "target image format: png, jpeg/jpg, webp, or gif")
                .option("--from <format>", "explicit source image format")
                .option("--width <pixels>", "target width")
                .option("--height <pixels>", "target height")
                .addOption(new Option("--fit <mode>", "image fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
                .option("--background <color>", "padding color for contain fit", "black")
                .option("--quality <value>", "WebP quality from 0 to 100")
                .option("--fps <fps>", "animated image frame rate")
                .option("--max-colors <count>", "GIF palette size from 2 to 256")
                .option("--loop <count>", "animation loop count; 0 means infinite");
            break;
        case "cecilia-ffmpeg image extract":
            command
                .option("--at <seconds>", "timestamp in seconds", "0")
                .addOption(new Option("--to <format>", "target still-image format").choices(["png", "jpeg", "jpg", "webp"]).default("png"))
                .option("--width <pixels>", "target width")
                .option("--height <pixels>", "target height")
                .addOption(new Option("--fit <mode>", "image fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
                .option("--background <color>", "padding color for contain fit", "black")
                .option("--quality <value>", "JPEG/WebP quality from 0 to 100", "90");
            break;
        default:
            break;
    }
}
//# sourceMappingURL=image-options.js.map