import { preflightOutputPath } from "../media/io.js";
const SINGLE_FILE_OUTPUT_COMMANDS = new Set([
    "cecilia-ffmpeg video trim-start",
    "cecilia-ffmpeg video trim-end",
    "cecilia-ffmpeg video trim",
    "cecilia-ffmpeg video speed",
    "cecilia-ffmpeg video from-image",
    "cecilia-ffmpeg video upscale",
    "cecilia-ffmpeg video restore",
    "cecilia-ffmpeg video attach-audio",
    "cecilia-ffmpeg video add-silence",
    "cecilia-ffmpeg image convert",
    "cecilia-ffmpeg image extract",
    "cecilia-ffmpeg audio attach",
    "cecilia-ffmpeg audio silence",
    "cecilia-ffmpeg audio add-silence",
    "cecilia-ffmpeg audio remove-silence",
    "cecilia-ffmpeg audio telephony",
    "cecilia-ffmpeg convert file",
    "cecilia-ffmpeg compose concat",
    "cecilia-ffmpeg compose transition",
    "cecilia-ffmpeg compose slideshow",
    "cecilia-ffmpeg repair timestamps",
    "cecilia-ffmpeg repair normalize",
]);
export function cliCommandPath(command) {
    const parts = [];
    let current = command;
    while (current) {
        if (current.name())
            parts.push(current.name());
        current = current.parent;
    }
    return parts.reverse().join(" ");
}
export async function preflightExplicitCliOutput(command, options) {
    if (options.output === undefined)
        return;
    if (!SINGLE_FILE_OUTPUT_COMMANDS.has(cliCommandPath(command)))
        return;
    await preflightOutputPath({
        output: options.output,
        overwrite: options.overwrite,
    });
}
//# sourceMappingURL=output-preflight.js.map