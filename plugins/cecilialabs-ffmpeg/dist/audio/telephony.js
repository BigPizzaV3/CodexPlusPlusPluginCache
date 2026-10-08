import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
import { preflightOutputPath, resolveReadableFile } from "../media/io.js";
import { executeAudioTransform, inspectAudioInput, integerInRange, requireAudio } from "./helpers.js";
const COMPATIBLE_CONTAINERS = {
    mulaw: ["wav", "mulaw"],
    alaw: ["wav", "alaw"],
    gsm: ["gsm"],
    pcm: ["wav", "s16le"],
};
function defaultContainer(codec) {
    switch (codec) {
        case "mulaw": return "wav";
        case "alaw": return "wav";
        case "gsm": return "gsm";
        case "pcm": return "wav";
    }
}
function extensionFor(container) {
    switch (container) {
        case "wav": return ".wav";
        case "mulaw": return ".ulaw";
        case "alaw": return ".alaw";
        case "gsm": return ".gsm";
        case "s16le": return ".s16le";
    }
}
function inferContainerFromOutput(output) {
    if (output === undefined)
        return undefined;
    switch (path.extname(output).toLowerCase()) {
        case ".wav": return "wav";
        case ".ulaw":
        case ".mulaw": return "mulaw";
        case ".alaw": return "alaw";
        case ".gsm": return "gsm";
        case ".s16le":
        case ".pcm": return "s16le";
        default: return undefined;
    }
}
function codecName(codec) {
    switch (codec) {
        case "mulaw": return "pcm_mulaw";
        case "alaw": return "pcm_alaw";
        case "gsm": return "libgsm";
        case "pcm": return "pcm_s16le";
    }
}
function muxerName(container) {
    switch (container) {
        case "mulaw": return "mulaw";
        case "alaw": return "alaw";
        case "gsm": return "gsm";
        case "s16le": return "s16le";
        case "wav": return undefined;
    }
}
function validateCodec(value) {
    if (!["mulaw", "alaw", "gsm", "pcm"].includes(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "codec must be mulaw, alaw, gsm, or pcm.", { details: { codec: value } });
    }
    return value;
}
export function resolveTelephonyProfile(request) {
    const codec = validateCodec(request.codec);
    const container = request.container ?? inferContainerFromOutput(request.output) ?? defaultContainer(codec);
    if (!COMPATIBLE_CONTAINERS[codec].includes(container)) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", `Container ${container} is not supported for ${codec}.`, {
            details: { codec, container, supportedContainers: COMPATIBLE_CONTAINERS[codec] },
        });
    }
    const sampleRate = integerInRange(Math.trunc(request.sampleRate ?? 8_000), "sampleRate", 1_000, 192_000);
    const channels = integerInRange(Math.trunc(request.channels ?? 1), "channels", 1, 8);
    if (codec === "gsm" && sampleRate !== 8_000) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "GSM audio requires an 8000 Hz sample rate.", { details: { codec, sampleRate } });
    }
    if (codec === "gsm" && channels !== 1) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "GSM audio requires mono output.", { details: { codec, channels } });
    }
    return {
        codec,
        ffmpegCodec: codecName(codec),
        container,
        extension: extensionFor(container),
        ...(muxerName(container) !== undefined ? { muxer: muxerName(container) } : {}),
        sampleRate,
        channels,
        sampleFormat: request.sampleFormat ?? "s16",
    };
}
function resolveOutput(source, profile, explicitOutput, cwd) {
    if (explicitOutput !== undefined)
        return path.resolve(cwd ?? process.cwd(), explicitOutput);
    const parsed = path.parse(source);
    return path.join(parsed.dir, `${parsed.name}.telephony-${profile.codec}${profile.extension}`);
}
export async function transcodeTelephony(input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const profile = resolveTelephonyProfile(request);
    const output = resolveOutput(source, profile, request.output, request.cwd);
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectAudioInput(source, request);
    requireAudio(media, source);
    if (request.container !== undefined && request.output !== undefined) {
        const actualExtension = path.extname(output).toLowerCase();
        const acceptedExtensions = profile.container === "mulaw" ? [".ulaw", ".mulaw"]
            : profile.container === "s16le" ? [".s16le", ".pcm"]
                : [profile.extension];
        if (!acceptedExtensions.includes(actualExtension)) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Explicit output extension does not match the selected telephony container.", {
                details: { output, actualExtension, container: profile.container, expectedExtensions: acceptedExtensions },
            });
        }
    }
    return await executeAudioTransform({
        operation: "telephony",
        sources: [source],
        output,
        argsBeforeOutput: [
            "-i", source,
            "-map", "0:a:0",
            "-vn",
            "-ar", String(profile.sampleRate),
            "-ac", String(profile.channels),
            "-sample_fmt", profile.sampleFormat,
            "-c:a", profile.ffmpegCodec,
            ...(profile.muxer !== undefined ? ["-f", profile.muxer] : []),
        ],
        runtime: request,
        inputMedia: [media],
        details: {
            codec: profile.codec,
            ffmpegCodec: profile.ffmpegCodec,
            container: profile.container,
            sampleRate: profile.sampleRate,
            channels: profile.channels,
            sampleFormat: profile.sampleFormat,
        },
    });
}
//# sourceMappingURL=telephony.js.map