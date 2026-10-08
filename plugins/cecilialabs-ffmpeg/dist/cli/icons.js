import { normalLog } from './colors.js';
export const CLI_ICONS = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
    doctor: "🩺",
    probe: "🔎",
    environment: "⚙️",
    video: "🎬",
    image: "🖼️",
    audio: "🎧",
    convert: "🔄",
    compose: "🧩",
    diagnose: "🔎",
    repair: "🛠️",
    stream: "📡",
    input: "📥",
    output: "📦",
    result: "✅",
    command: "⚙️",
    resolution: "📐",
    duration: "⏱️",
    format: "🎞️",
    progress: "▶️",
    completed: "✅",
    frame: "🎞️",
    fps: "⚡",
    speed: "🚀",
    eta: "⌛",
    batch: "📚",
};
const COMMAND_ICONS = [
    ["cecilia-ffmpeg video trim", "✂️"],
    ["cecilia-ffmpeg video speed", "⚡"],
    ["cecilia-ffmpeg video from-image", "🖼️"],
    ["cecilia-ffmpeg video upscale", "📐"],
    ["cecilia-ffmpeg video restore", "🛠️"],
    ["cecilia-ffmpeg video attach-audio", "🎧"],
    ["cecilia-ffmpeg video add-silence", "🔇"],
    ["cecilia-ffmpeg image extract", "📸"],
    ["cecilia-ffmpeg image convert", "🔄"],
    ["cecilia-ffmpeg audio detect-silence", "🔎"],
    ["cecilia-ffmpeg audio remove-silence", "✂️"],
    ["cecilia-ffmpeg audio silence", "🔇"],
    ["cecilia-ffmpeg audio telephony", "☎️"],
    ["cecilia-ffmpeg convert batch", "📚"],
    ["cecilia-ffmpeg convert", "🔄"],
    ["cecilia-ffmpeg compose transition", "🔀"],
    ["cecilia-ffmpeg compose", "🧩"],
    ["cecilia-ffmpeg stream", "📡"],
    ["cecilia-ffmpeg repair", "🛠️"],
    ["cecilia-ffmpeg diagnose", "🔎"],
    ["cecilia-ffmpeg probe", "🔎"],
    ["cecilia-ffmpeg doctor", "🩺"],
    ["cecilia-ffmpeg environment", "⚙️"],
    ["cecilia-ffmpeg video", "🎬"],
    ["cecilia-ffmpeg image", "🖼️"],
    ["cecilia-ffmpeg audio", "🎧"],
];
export function iconForCommandPath(path) {
    return COMMAND_ICONS.find(([prefix]) => path.startsWith(`${prefix}`))?.[1] ?? "•";
}
export function decorateCommandDescription(path, description) {
    return `\t\t${iconForCommandPath(path)}\t\b\b\b\b${normalLog(description)}`;
}
export function progressSourceIcon(source) {
    if (source && /^[a-z][a-z0-9+.-]*:\/\//i.test(source))
        return `${CLI_ICONS.stream}`;
    return `${CLI_ICONS.video}`;
}
//# sourceMappingURL=icons.js.map