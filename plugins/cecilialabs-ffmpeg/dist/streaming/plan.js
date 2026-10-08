import { ToolkitRuntimeError } from "../core/errors.js";
const VIDEO_SIZE = /^\d+x\d+$/;
const BITRATE = /^\d+(?:\.\d+)?[kKmMgG]?$/;
function schemeOf(value) {
    try {
        return new URL(value).protocol.replace(/:$/, "").toLowerCase();
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Streaming destination must be a valid URL.", {
            details: { url: value },
            cause: error,
        });
    }
}
export function inferTransport(url) {
    const scheme = schemeOf(url);
    switch (scheme) {
        case "http":
        case "https":
            return "http";
        case "rtmp":
        case "rtmps":
            return "rtmp";
        case "rtsp":
            return "rtsp";
        case "srt":
            return "srt";
        case "udp":
            return "udp";
        case "tcp":
            return "tcp";
        case "ws":
        case "wss":
            throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", "Stock FFmpeg does not provide the WebSocket relay required by this toolkit. Stream to an HTTP/TCP/UDP/SRT endpoint or place an explicit WebSocket relay in front of the destination.", { details: { url, transport: "websocket" } });
        default:
            throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `Unsupported streaming URL scheme: ${scheme || "(none)"}.`, {
                details: { url, supported: ["http", "https", "rtmp", "rtmps", "rtsp", "srt", "udp", "tcp"] },
            });
    }
}
function allowedSchemes(transport) {
    switch (transport) {
        case "http":
            return ["http", "https"];
        case "rtmp":
            return ["rtmp", "rtmps"];
        case "rtsp":
            return ["rtsp"];
        case "srt":
            return ["srt"];
        case "udp":
            return ["udp"];
        case "tcp":
            return ["tcp"];
    }
}
function defaultContainer(transport) {
    if (transport === "rtmp")
        return "flv";
    if (transport === "rtsp")
        return "rtsp";
    return "mpegts";
}
function validateContainer(transport, container) {
    if (transport === "rtmp" && container !== "flv") {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "RTMP output requires the FLV container.", {
            details: { transport, container },
        });
    }
    if (transport === "rtsp" && container !== "rtsp") {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "RTSP output requires the RTSP muxer.", {
            details: { transport, container },
        });
    }
    if (!["rtmp", "rtsp"].includes(transport) && container !== "mpegts") {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", `${transport.toUpperCase()} streaming currently uses MPEG-TS in Milestone 9.`, { details: { transport, container } });
    }
}
export function resolveDestination(options) {
    if (options.transport === "websocket") {
        throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", "Direct WebSocket streaming is intentionally not implemented. Use an HTTP/TCP/UDP/SRT relay and let that service bridge to WebSocket clients.", { details: { transport: "websocket", url: options.url } });
    }
    const inferred = inferTransport(options.url);
    const transport = options.transport ?? inferred;
    const scheme = schemeOf(options.url);
    if (!allowedSchemes(transport).includes(scheme)) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Destination URL scheme does not match --transport.", {
            details: { url: options.url, scheme, transport, allowedSchemes: allowedSchemes(transport) },
        });
    }
    const container = options.container ?? defaultContainer(transport);
    validateContainer(transport, container);
    return {
        url: options.url,
        transport,
        container,
        ...(transport === "rtsp" ? { rtspTransport: options.rtspTransport ?? "tcp" } : {}),
    };
}
function validateEncodingValue(value, name) {
    if (value !== undefined && !BITRATE.test(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a FFmpeg bitrate such as 500k, 2M, or 1500000.`, {
            details: { name, value },
        });
    }
}
export function resolveEncoding(options, defaults) {
    validateEncodingValue(options.videoBitrate, "videoBitrate");
    validateEncodingValue(options.audioBitrate, "audioBitrate");
    if (options.gop !== undefined && (!Number.isInteger(options.gop) || options.gop <= 0)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "GOP size must be a positive integer.", {
            details: { gop: options.gop },
        });
    }
    return {
        videoCodec: options.videoCodec ?? "h264",
        audioCodec: options.audioCodec ?? defaults.audio,
        ...(options.videoBitrate !== undefined ? { videoBitrate: options.videoBitrate } : {}),
        ...(options.audioBitrate !== undefined ? { audioBitrate: options.audioBitrate } : {}),
        ...(options.preset !== undefined ? { preset: options.preset } : {}),
        ...(options.gop !== undefined ? { gop: options.gop } : {}),
        ...(options.pixelFormat !== undefined ? { pixelFormat: options.pixelFormat } : {}),
    };
}
export function resolveCameraInputFormat(requested, platform = process.platform) {
    if (requested !== undefined)
        return requested;
    if (platform === "linux")
        return "v4l2";
    if (platform === "darwin")
        return "avfoundation";
    if (platform === "win32")
        return "dshow";
    throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", `Automatic camera capture format is not defined for platform ${platform}; pass --input-format explicitly.`, { details: { platform } });
}
function encodingArgs(encoding) {
    const args = [];
    if (encoding.videoCodec === "copy") {
        args.push("-c:v", "copy");
    }
    else if (encoding.videoCodec === "mpeg1video") {
        args.push("-c:v", "mpeg1video", "-bf", "0");
    }
    else {
        args.push("-c:v", "libx264", "-preset", encoding.preset ?? "veryfast", "-tune", "zerolatency", "-pix_fmt", encoding.pixelFormat ?? "yuv420p", "-g", String(encoding.gop ?? 60));
    }
    if (encoding.videoBitrate !== undefined)
        args.push("-b:v", encoding.videoBitrate);
    if (encoding.audioCodec === "none") {
        args.push("-an");
    }
    else if (encoding.audioCodec === "copy") {
        args.push("-c:a", "copy");
    }
    else {
        args.push("-c:a", "aac", "-b:a", encoding.audioBitrate ?? "128k");
    }
    return args;
}
function destinationArgs(destination) {
    const args = [];
    if (destination.transport === "rtsp") {
        args.push("-rtsp_transport", destination.rtspTransport ?? "tcp");
    }
    args.push("-f", destination.container, destination.url);
    return args;
}
function compatibilityWarnings(destination, encoding) {
    const warnings = [];
    if (encoding.videoCodec === "copy") {
        warnings.push({
            code: "W_STREAM_COPY_COMPATIBILITY",
            message: "Stream-copy mode depends on the source codec being compatible with the selected container and receiver.",
            details: { container: destination.container, transport: destination.transport },
        });
    }
    if (destination.transport === "http") {
        warnings.push({
            code: "W_HTTP_RECEIVER_REQUIRED",
            message: "HTTP output requires an endpoint that accepts a streaming FFmpeg request body; a normal static web server is not sufficient.",
            details: { url: destination.url },
        });
    }
    return warnings;
}
export function buildFileStreamPlan(source, media, options) {
    const destination = resolveDestination(options);
    const defaultAudio = media !== undefined && media.audio.length > 0 ? "aac" : "none";
    const encoding = resolveEncoding(options, { audio: defaultAudio });
    const args = ["-hide_banner"];
    if (options.realtime ?? true)
        args.push("-re");
    args.push("-i", source, "-map", "0:v:0?");
    if (encoding.audioCodec !== "none")
        args.push("-map", "0:a:0?");
    args.push(...encodingArgs(encoding), ...destinationArgs(destination));
    return { destination, encoding, args, warnings: compatibilityWarnings(destination, encoding) };
}
export function buildCameraStreamPlan(options) {
    if (options.device.trim().length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Camera device must not be empty.");
    }
    if (options.videoSize !== undefined && !VIDEO_SIZE.test(options.videoSize)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Camera video size must use WIDTHxHEIGHT syntax.", {
            details: { videoSize: options.videoSize },
        });
    }
    if (options.framerate !== undefined && (!Number.isFinite(options.framerate) || options.framerate <= 0)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "Camera frame rate must be greater than zero.", {
            details: { framerate: options.framerate },
        });
    }
    const inputFormat = resolveCameraInputFormat(options.inputFormat);
    const destination = resolveDestination(options);
    const encoding = resolveEncoding(options, { audio: "none" });
    const args = ["-hide_banner", "-thread_queue_size", "512", "-f", inputFormat];
    if (options.framerate !== undefined)
        args.push("-framerate", String(options.framerate));
    if (options.videoSize !== undefined)
        args.push("-video_size", options.videoSize);
    args.push("-i", options.device, "-map", "0:v:0", ...encodingArgs(encoding), ...destinationArgs(destination));
    return { inputFormat, destination, encoding, args, warnings: compatibilityWarnings(destination, encoding) };
}
//# sourceMappingURL=plan.js.map