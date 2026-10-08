import { readdir } from "node:fs/promises";
import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { inspectEnvironmentCapabilities } from "../environment/capabilities.js";
const ENCODERS = {
    h264: {
        nvenc: "h264_nvenc",
        qsv: "h264_qsv",
        vaapi: "h264_vaapi",
        videotoolbox: "h264_videotoolbox",
    },
    vp9: {
        nvenc: undefined,
        qsv: "vp9_qsv",
        vaapi: "vp9_vaapi",
        videotoolbox: undefined,
    },
};
const SOFTWARE_ENCODERS = {
    h264: "libx264",
    vp9: "libvpx-vp9",
};
export const HARDWARE_RUNTIME_PROBE_SIZE = "256x256";
const probeCache = new Map();
const capabilityCache = new Map();
async function capabilitiesFor(options) {
    const key = options.ffmpegPath ?? "ffmpeg";
    const cached = capabilityCache.get(key);
    if (cached !== undefined)
        return cached;
    const capabilities = await inspectEnvironmentCapabilities({
        ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
    capabilityCache.set(key, capabilities);
    return capabilities;
}
export function hardwareEncoderName(backend, codec) {
    return ENCODERS[codec][backend];
}
export function softwareEncoderName(codec) {
    return SOFTWARE_ENCODERS[codec];
}
export function preferredHardwareBackends(platform, codec) {
    const base = platform === "darwin"
        ? ["videotoolbox", "qsv", "nvenc", "vaapi"]
        : platform === "win32"
            ? ["nvenc", "qsv", "videotoolbox", "vaapi"]
            : ["nvenc", "qsv", "vaapi", "videotoolbox"];
    return base.filter((backend) => hardwareEncoderName(backend, codec) !== undefined);
}
async function defaultVaapiDevice() {
    if (process.platform !== "linux")
        return undefined;
    try {
        const entries = (await readdir("/dev/dri"))
            .filter((name) => /^renderD\d+$/.test(name))
            .sort();
        return entries[0] === undefined ? undefined : path.join("/dev/dri", entries[0]);
    }
    catch {
        return undefined;
    }
}
function qualityArgs(backend, codec) {
    if (backend === "nvenc") {
        return codec === "h264"
            ? ["-preset", "p4", "-cq", "23", "-b:v", "0"]
            : [];
    }
    if (backend === "qsv") {
        return ["-global_quality", codec === "h264" ? "23" : "28"];
    }
    if (backend === "vaapi") {
        return ["-qp", codec === "h264" ? "23" : "28"];
    }
    return codec === "h264" ? ["-q:v", "65"] : [];
}
export function hardwareGlobalArgs(selection) {
    if (selection.resolved === "vaapi" && selection.device !== undefined) {
        return ["-vaapi_device", selection.device];
    }
    return [];
}
export function hardwareFilterSuffix(selection) {
    if (selection.resolved === "vaapi")
        return ["format=nv12", "hwupload"];
    if (selection.resolved === "qsv")
        return ["format=nv12"];
    return [];
}
export function hardwareVideoEncodingArgs(selection, options = {}) {
    if (selection.resolved === "software") {
        if (selection.codec === "h264") {
            return [
                "-c:v", selection.softwareEncoder,
                "-preset", options.softwarePreset ?? "medium",
                "-crf", String(options.softwareCrf ?? 18),
                "-pix_fmt", "yuv420p",
            ];
        }
        return [
            "-c:v", selection.softwareEncoder,
            "-crf", String(options.softwareCrf ?? 32),
            "-b:v", "0",
            "-pix_fmt", "yuv420p",
        ];
    }
    return [
        "-c:v", selection.encoder,
        ...qualityArgs(selection.resolved, selection.codec),
        ...(selection.resolved === "vaapi" ? [] : ["-pix_fmt", selection.resolved === "qsv" ? "nv12" : "yuv420p"]),
    ];
}
function runtimeProbeDiagnostic(error) {
    if (error instanceof ToolkitRuntimeError) {
        const stderr = error.details?.["stderrTail"];
        if (typeof stderr === "string" && stderr.trim().length > 0) {
            const lines = stderr
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
            const diagnostic = lines.find((line) => /initialize|error|failed|cannot|unsupported|invalid|driver|device/i.test(line)) ?? lines.at(-1);
            if (diagnostic !== undefined)
                return diagnostic.slice(0, 600);
        }
        return error.message;
    }
    if (error instanceof Error)
        return error.message;
    return undefined;
}
async function runtimeProbe(backend, codec, encoder, device, options) {
    const key = [
        options.ffmpegPath ?? "ffmpeg",
        options.cwd ?? process.cwd(),
        backend,
        codec,
        device ?? "",
    ].join("|");
    const cached = probeCache.get(key);
    if (cached !== undefined)
        return cached;
    const pseudo = {
        requested: backend,
        resolved: backend,
        codec,
        encoder,
        softwareEncoder: softwareEncoderName(codec),
        runtimeVerified: false,
        fallback: false,
        ...(device !== undefined ? { device } : {}),
        attempts: [],
    };
    try {
        await runFFmpeg([
            "-hide_banner",
            "-loglevel", "error",
            ...hardwareGlobalArgs(pseudo),
            "-f", "lavfi",
            "-i", `color=c=black:s=${HARDWARE_RUNTIME_PROBE_SIZE}:r=1`,
            ...(hardwareFilterSuffix(pseudo).length > 0 ? ["-vf", hardwareFilterSuffix(pseudo).join(",")] : []),
            "-frames:v", "1",
            "-an",
            ...hardwareVideoEncodingArgs(pseudo),
            "-f", "null",
            "-",
        ], {
            ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
            ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
            ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
            ...(options.signal !== undefined ? { signal: options.signal } : {}),
            maxCaptureBytes: 2 * 1024 * 1024,
        });
        const result = { usable: true };
        probeCache.set(key, result);
        return result;
    }
    catch (error) {
        if (error instanceof ToolkitRuntimeError && error.code === "E_ABORTED")
            throw error;
        const diagnostic = runtimeProbeDiagnostic(error);
        const result = {
            usable: false,
            ...(diagnostic !== undefined ? { diagnostic } : {}),
        };
        probeCache.set(key, result);
        return result;
    }
}
function fallbackWarning(requested, codec, attempts) {
    return {
        code: "W_HARDWARE_SOFTWARE_FALLBACK",
        message: "No requested hardware encoder passed capability/runtime checks; using the software encoder.",
        details: { requested, codec, attempts },
    };
}
function unavailableError(requested, codec, attempts) {
    return new ToolkitRuntimeError("E_CAPABILITY_ENCODER_MISSING", "No usable hardware encoder satisfies the requested hardware policy.", { details: { requested, codec, attempts } });
}
export async function selectHardwareEncoding(options) {
    const requested = options.hardware ?? "software";
    const codec = options.codec;
    const softwareEncoder = softwareEncoderName(codec);
    if (requested === "software") {
        return {
            requested,
            resolved: "software",
            codec,
            encoder: softwareEncoder,
            softwareEncoder,
            runtimeVerified: true,
            fallback: false,
            attempts: [],
        };
    }
    const capabilities = await capabilitiesFor(options);
    const compiledEncoders = new Set(capabilities.encoders.map((entry) => entry.name));
    const platform = options.platform ?? process.platform;
    const candidates = requested === "auto"
        ? preferredHardwareBackends(platform, codec)
        : [requested];
    const attempts = [];
    for (const backend of candidates) {
        const encoder = hardwareEncoderName(backend, codec);
        if (encoder === undefined) {
            attempts.push({
                backend,
                encoder: "(unsupported)",
                compiled: false,
                reason: codec + " is not mapped to " + backend + ".",
            });
            continue;
        }
        const compiled = compiledEncoders.has(encoder);
        if (!compiled) {
            attempts.push({
                backend,
                encoder,
                compiled: false,
                reason: "FFmpeg does not report this encoder.",
            });
            continue;
        }
        const device = backend === "vaapi"
            ? (options.hardwareDevice ?? await defaultVaapiDevice())
            : options.hardwareDevice;
        if (backend === "vaapi" && device === undefined) {
            attempts.push({
                backend,
                encoder,
                compiled: true,
                runtimeUsable: false,
                reason: "No VAAPI render device was found; pass --hardware-device explicitly.",
            });
            continue;
        }
        if (options.dryRun) {
            attempts.push({ backend, encoder, compiled: true });
            return {
                requested,
                resolved: backend,
                codec,
                encoder,
                softwareEncoder,
                runtimeVerified: false,
                fallback: false,
                ...(device !== undefined ? { device } : {}),
                attempts,
                warning: {
                    code: "W_HARDWARE_DRY_RUN_UNVERIFIED",
                    message: "Dry-run selected a compiled hardware encoder without executing the runtime usability probe.",
                    details: { requested, backend, encoder, codec },
                },
            };
        }
        const runtimeProbeResult = await runtimeProbe(backend, codec, encoder, device, options);
        attempts.push({
            backend,
            encoder,
            compiled: true,
            runtimeUsable: runtimeProbeResult.usable,
            ...(!runtimeProbeResult.usable ? { reason: "Runtime encoder probe failed." } : {}),
            ...(runtimeProbeResult.diagnostic !== undefined ? { diagnostic: runtimeProbeResult.diagnostic } : {}),
        });
        if (!runtimeProbeResult.usable)
            continue;
        return {
            requested,
            resolved: backend,
            codec,
            encoder,
            softwareEncoder,
            runtimeVerified: true,
            fallback: false,
            ...(device !== undefined ? { device } : {}),
            attempts,
        };
    }
    if (options.hardwareStrict)
        throw unavailableError(requested, codec, attempts);
    return {
        requested,
        resolved: "software",
        codec,
        encoder: softwareEncoder,
        softwareEncoder,
        runtimeVerified: true,
        fallback: true,
        attempts,
        warning: fallbackWarning(requested, codec, attempts),
    };
}
//# sourceMappingURL=selection.js.map