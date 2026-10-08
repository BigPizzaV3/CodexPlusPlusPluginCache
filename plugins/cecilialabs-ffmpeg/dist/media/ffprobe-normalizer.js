import { ToolkitRuntimeError } from "../core/errors.js";
function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function stringValue(value) {
    return typeof value === "string" && value.length > 0 && value !== "N/A" ? value : undefined;
}
function numberValue(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value !== "string" || value.length === 0 || value === "N/A")
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function integerValue(value) {
    const parsed = numberValue(value);
    return parsed !== undefined ? Math.trunc(parsed) : undefined;
}
function tagsValue(value) {
    const input = record(value);
    if (!input)
        return undefined;
    const tags = {};
    for (const [key, item] of Object.entries(input)) {
        if (typeof item === "string")
            tags[key] = item;
    }
    return Object.keys(tags).length > 0 ? tags : undefined;
}
function codecType(value) {
    switch (value) {
        case "video":
        case "audio":
        case "subtitle":
        case "data":
        case "attachment":
            return value;
        default:
            return "unknown";
    }
}
function normalizeBaseStream(raw, fallbackIndex) {
    const result = {
        index: integerValue(raw["index"]) ?? fallbackIndex,
        codecType: codecType(raw["codec_type"]),
    };
    const codecName = stringValue(raw["codec_name"]);
    const codecLongName = stringValue(raw["codec_long_name"]);
    const duration = numberValue(raw["duration"]);
    const timeBase = stringValue(raw["time_base"]);
    const startTime = numberValue(raw["start_time"]);
    const bitrate = numberValue(raw["bit_rate"]);
    const tags = tagsValue(raw["tags"]);
    if (codecName !== undefined)
        result.codecName = codecName;
    if (codecLongName !== undefined)
        result.codecLongName = codecLongName;
    if (duration !== undefined)
        result.durationSeconds = duration;
    if (timeBase !== undefined)
        result.timeBase = timeBase;
    if (startTime !== undefined)
        result.startTimeSeconds = startTime;
    if (bitrate !== undefined)
        result.bitrate = bitrate;
    if (tags !== undefined)
        result.tags = tags;
    return result;
}
function normalizeStream(raw, fallbackIndex) {
    const base = normalizeBaseStream(raw, fallbackIndex);
    if (base.codecType === "video") {
        const stream = { ...base, codecType: "video" };
        const width = integerValue(raw["width"]);
        const height = integerValue(raw["height"]);
        const pixelFormat = stringValue(raw["pix_fmt"]);
        const sampleAspectRatio = stringValue(raw["sample_aspect_ratio"]);
        const displayAspectRatio = stringValue(raw["display_aspect_ratio"]);
        const averageFrameRate = stringValue(raw["avg_frame_rate"]);
        const realFrameRate = stringValue(raw["r_frame_rate"]);
        const fieldOrder = stringValue(raw["field_order"]);
        if (width !== undefined)
            stream.width = width;
        if (height !== undefined)
            stream.height = height;
        if (pixelFormat !== undefined)
            stream.pixelFormat = pixelFormat;
        if (sampleAspectRatio !== undefined)
            stream.sampleAspectRatio = sampleAspectRatio;
        if (displayAspectRatio !== undefined)
            stream.displayAspectRatio = displayAspectRatio;
        if (averageFrameRate !== undefined)
            stream.averageFrameRate = averageFrameRate;
        if (realFrameRate !== undefined)
            stream.realFrameRate = realFrameRate;
        if (fieldOrder !== undefined)
            stream.fieldOrder = fieldOrder;
        return stream;
    }
    if (base.codecType === "audio") {
        const stream = { ...base, codecType: "audio" };
        const sampleRate = integerValue(raw["sample_rate"]);
        const channels = integerValue(raw["channels"]);
        const channelLayout = stringValue(raw["channel_layout"]);
        const sampleFormat = stringValue(raw["sample_fmt"]);
        if (sampleRate !== undefined)
            stream.sampleRate = sampleRate;
        if (channels !== undefined)
            stream.channels = channels;
        if (channelLayout !== undefined)
            stream.channelLayout = channelLayout;
        if (sampleFormat !== undefined)
            stream.sampleFormat = sampleFormat;
        return stream;
    }
    return base;
}
function normalizeFormat(raw) {
    const result = {};
    if (!raw)
        return result;
    const formatName = stringValue(raw["format_name"]);
    const formatLongName = stringValue(raw["format_long_name"]);
    const duration = numberValue(raw["duration"]);
    const size = numberValue(raw["size"]);
    const bitrate = numberValue(raw["bit_rate"]);
    const tags = tagsValue(raw["tags"]);
    if (formatName !== undefined)
        result.formatName = formatName;
    if (formatLongName !== undefined)
        result.formatLongName = formatLongName;
    if (duration !== undefined)
        result.durationSeconds = duration;
    if (size !== undefined)
        result.sizeBytes = size;
    if (bitrate !== undefined)
        result.bitrate = bitrate;
    if (tags !== undefined)
        result.tags = tags;
    return result;
}
export function normalizeFFprobeJson(source, raw) {
    const root = record(raw);
    if (!root) {
        throw new ToolkitRuntimeError("E_PROBE_FAILED", "FFprobe returned a non-object JSON document.");
    }
    const rawStreams = Array.isArray(root["streams"]) ? root["streams"] : [];
    const streams = rawStreams.flatMap((value, index) => {
        const item = record(value);
        return item ? [normalizeStream(item, index)] : [];
    });
    const video = streams.filter((stream) => stream.codecType === "video");
    const audio = streams.filter((stream) => stream.codecType === "audio");
    return {
        source,
        format: normalizeFormat(record(root["format"])),
        streams,
        video,
        audio,
    };
}
//# sourceMappingURL=ffprobe-normalizer.js.map