/** Remove terminal escape sequences before parsing FFmpeg capability tables. */
export function stripAnsi(text) {
    // Build control bytes dynamically so `no-control-regex` remains useful for
    // accidental regex literals elsewhere while this terminal parser stays valid.
    const escape = String.fromCharCode(27);
    const bell = String.fromCharCode(7);
    const pattern = new RegExp(`${escape}(?:\\[[0-?]*[ -/]*[@-~]|\\][^${bell}]*(?:${bell}|${escape}\\\\))`, "g");
    return text.replace(pattern, "");
}
/** Parse the first line produced by `ffmpeg -version` or `ffprobe -version`. */
export function parseBinaryVersionLine(line) {
    const match = /^(ffmpeg|ffprobe) version\s+([^\s]+)/i.exec(line.trim());
    if (!match)
        return undefined;
    const product = match[1]?.toLowerCase();
    const version = match[2];
    if ((product !== "ffmpeg" && product !== "ffprobe") || version === undefined)
        return undefined;
    const numeric = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version);
    return {
        product,
        version,
        ...(numeric?.[1] !== undefined ? { major: Number(numeric[1]) } : {}),
        ...(numeric?.[2] !== undefined ? { minor: Number(numeric[2]) } : {}),
        ...(numeric?.[3] !== undefined ? { patch: Number(numeric[3]) } : {}),
        raw: line.trim(),
    };
}
export function isVersionAtLeast(version, minimum) {
    if (version.major === undefined || version.minor === undefined)
        return undefined;
    const patch = version.patch ?? 0;
    const minimumPatch = minimum.patch ?? 0;
    if (version.major !== minimum.major)
        return version.major > minimum.major;
    if (version.minor !== minimum.minor)
        return version.minor > minimum.minor;
    return patch >= minimumPatch;
}
function mediaTypeFromFlag(flag) {
    switch (flag) {
        case "V": return "video";
        case "A": return "audio";
        case "S": return "subtitle";
        case "D": return "data";
        case "T": return "attachment";
        default: return "unknown";
    }
}
/** Parse the table emitted by `ffmpeg -encoders` or `ffmpeg -decoders`. */
export function parseEncoderDecoderTable(text, kind) {
    const result = [];
    for (const line of stripAnsi(text).split(/\r?\n/)) {
        const match = /^\s*([A-Z.]{6})\s+(\S+)\s+(.*)$/.exec(line);
        if (!match)
            continue;
        const flags = match[1];
        const name = match[2];
        const description = match[3]?.trim() ?? "";
        if (!flags || !name || name === "=")
            continue;
        result.push({
            kind,
            name,
            description,
            mediaType: mediaTypeFromFlag(flags[0]),
            flags,
            frameThreading: flags[1] === "F",
            sliceThreading: flags[2] === "S",
            experimental: flags[3] === "X",
            drawHorizBand: flags[4] === "B",
            directRendering: flags[5] === "D",
        });
    }
    return result;
}
/** Parse the table emitted by `ffmpeg -codecs`. */
export function parseCodecTable(text) {
    const result = [];
    for (const line of stripAnsi(text).split(/\r?\n/)) {
        const match = /^\s*([A-Z.]{6})\s+(\S+)\s+(.*)$/.exec(line);
        if (!match)
            continue;
        const flags = match[1];
        const name = match[2];
        const description = match[3]?.trim() ?? "";
        if (!flags || !name || name === "=")
            continue;
        result.push({
            name,
            description,
            flags,
            decoding: flags[0] === "D",
            encoding: flags[1] === "E",
            mediaType: mediaTypeFromFlag(flags[2]),
            intraOnly: flags[3] === "I",
            lossy: flags[4] === "L",
            lossless: flags[5] === "S",
        });
    }
    return result;
}
/** Parse the table emitted by `ffmpeg -filters`. */
export function parseFilterTable(text) {
    const result = [];
    for (const line of stripAnsi(text).split(/\r?\n/)) {
        // FFmpeg filter capability columns differ across major versions.
        // FFmpeg <= 7 commonly emits three flags (for example `TSC` / `...`),
        // while FFmpeg 8 emits two flags (for example `TS`, `..`, `.S`, `T.`).
        // Restrict accepted characters to the known T/S/C capability markers and
        // dots so legend/header prose cannot be mistaken for filter entries.
        const match = /^\s*([TSC.]{2,3})\s+(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(line);
        if (!match)
            continue;
        const flags = match[1];
        const name = match[2];
        const io = match[3];
        const description = match[4]?.trim() ?? "";
        if (!flags || !name || !io || name === "=")
            continue;
        result.push({
            name,
            description,
            flags,
            io,
            timelineSupport: flags[0] === "T",
            sliceThreading: flags[1] === "S",
            commandSupport: flags[2] === "C",
        });
    }
    return result;
}
/** Parse the simple list emitted by `ffmpeg -hwaccels`. */
export function parseHardwareAccelerators(text) {
    const lines = stripAnsi(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const headerIndex = lines.findIndex((line) => /^Hardware acceleration methods:/i.test(line));
    const candidates = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
    return candidates.filter((line) => /^[A-Za-z0-9_+-]+$/.test(line));
}
//# sourceMappingURL=capabilities.js.map