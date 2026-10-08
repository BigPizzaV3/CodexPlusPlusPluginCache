import { Option } from "commander";
const TRANSITIONS = "fade, fadeblack, fadewhite, wipeleft, wiperight, slideup, slidedown, circleopen, circleclose, dissolve, pixelize, distance, zoomin, or zoomout";
function collect(value, previous) {
    return [...previous, value];
}
function addNormalizeOptions(command) {
    command
        .option("--width <pixels>", "normalized output width")
        .option("--height <pixels>", "normalized output height")
        .option("--fps <fps>", "normalized output frame rate", "30")
        .addOption(new Option("--fit <mode>", "visual fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
        .option("--background <color>", "padding color for contain fit", "black")
        .addOption(new Option("--to <format>", "video output format").choices(["mp4", "webm"]).default("mp4"));
}
function addAudioOption(command) {
    command.option("--audio <mode>", "audio policy: auto, preserve, or drop", "auto");
}
export function configureCompositionOptions(command, path) {
    switch (path) {
        case "cecilia-ffmpeg compose concat":
            command
                .option("--transition <name>", `transition: none or ${TRANSITIONS}`, "none")
                .option("--transition-duration <seconds>", "transition duration in seconds", "1");
            addNormalizeOptions(command);
            addAudioOption(command);
            break;
        case "cecilia-ffmpeg compose transition":
            command
                .option("--transition <name>", `xfade transition: ${TRANSITIONS}`, "fade")
                .option("--duration <seconds>", "transition duration in seconds", "1")
                .option("--offset <seconds>", "transition start offset in the left input");
            addNormalizeOptions(command);
            addAudioOption(command);
            break;
        case "cecilia-ffmpeg compose slideshow":
            command
                .option("--width <pixels>", "output width", "1280")
                .option("--height <pixels>", "output height", "720")
                .option("--fps <fps>", "output frame rate", "30")
                .option("--duration <seconds>", "total slideshow duration", "10")
                .option("--background <color>", "background/padding color", "black")
                .addOption(new Option("--fit <mode>", "image fit: contain, cover, or stretch").choices(["contain", "cover", "stretch"]).default("contain"))
                .addOption(new Option("--style <style>", "slideshow style").choices(["vertical-stack", "sequence"]).default("vertical-stack"))
                .addOption(new Option("--direction <direction>", "vertical-stack travel direction").choices(["up", "down"]).default("up"))
                .option("--transition <name>", `sequence transition: none or ${TRANSITIONS}`, "none")
                .option("--transition-duration <seconds>", "sequence transition duration", "0.75")
                .addOption(new Option("--to <format>", "slideshow output format").choices(["mp4", "webm", "gif", "webp"]).default("mp4"))
                .option("--include <pattern>", "include image glob; repeatable", collect, [])
                .option("--exclude <pattern>", "exclude image glob; repeatable", collect, [])
                .option("--no-intro", "do not include an empty-screen intro")
                .option("--outro", "include an empty-screen outro", false)
                .option("--recursive", "discover images recursively", false);
            break;
        default:
            break;
    }
}
//# sourceMappingURL=composition-options.js.map