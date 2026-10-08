import { parseCodecTable, parseEncoderDecoderTable, parseFilterTable, parseHardwareAccelerators, } from "../core/capabilities.js";
import { runFFmpeg } from "../core/ffmpeg-runner.js";
import { renderCommandForDisplay } from "../core/command-result.js";
function capturedCapabilityText(execution) {
    // FFmpeg capability tables are normally written to stdout, but packaging,
    // wrappers, and some downstream builds may route informational output to
    // stderr. Parse both streams; the table parsers ignore banners/legend noise.
    return [execution.stdout, execution.stderr]
        .filter((value) => typeof value === "string" && value.length > 0)
        .join("\n");
}
function backend(name, methods, encoders, decoders, acceleratorMethods, encoderSuffixes, decoderSuffixes = []) {
    const compiledEncoders = encoders
        .map((entry) => entry.name)
        .filter((encoderName) => encoderSuffixes.some((suffix) => encoderName.endsWith(suffix)));
    const compiledDecoders = decoders
        .map((entry) => entry.name)
        .filter((decoderName) => decoderSuffixes.some((suffix) => decoderName.endsWith(suffix)));
    const reportedMethods = acceleratorMethods.filter((method) => methods.includes(method));
    return {
        name,
        compiled: compiledEncoders.length > 0 || compiledDecoders.length > 0 || reportedMethods.length > 0,
        reportedMethods,
        encoders: compiledEncoders,
        decoders: compiledDecoders,
    };
}
function hardwareInfo(methods, encoders, decoders) {
    return {
        methods,
        backends: [
            backend("nvenc", methods, encoders, decoders, ["cuda"], ["_nvenc"]),
            backend("nvdec", methods, encoders, decoders, ["cuda"], [], ["_cuvid"]),
            backend("vaapi", methods, encoders, decoders, ["vaapi"], ["_vaapi"], ["_vaapi"]),
            backend("qsv", methods, encoders, decoders, ["qsv"], ["_qsv"], ["_qsv"]),
            backend("videotoolbox", methods, encoders, decoders, ["videotoolbox"], ["_videotoolbox"], ["_videotoolbox"]),
            backend("cuda", methods, encoders, decoders, ["cuda"], ["_cuda"], ["_cuda", "_cuvid"]),
            backend("vulkan", methods, encoders, decoders, ["vulkan"], ["_vulkan"], ["_vulkan"]),
            backend("opencl", methods, encoders, decoders, ["opencl"], ["_opencl"], ["_opencl"]),
        ],
        note: "Reported/compiled support is only capability discovery. Milestone 17 encoder selection also performs a runtime probe before choosing a hardware encoder.",
    };
}
export async function inspectEnvironmentCapabilities(options = {}) {
    const common = {
        ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}),
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
        ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        maxCaptureBytes: 8 * 1024 * 1024,
    };
    const executions = await Promise.all([
        runFFmpeg(["-hide_banner", "-codecs"], common),
        runFFmpeg(["-hide_banner", "-encoders"], common),
        runFFmpeg(["-hide_banner", "-decoders"], common),
        runFFmpeg(["-hide_banner", "-filters"], common),
        runFFmpeg(["-hide_banner", "-hwaccels"], common),
    ]);
    const [codecExecution, encoderExecution, decoderExecution, filterExecution, hwExecution] = executions;
    if (!codecExecution || !encoderExecution || !decoderExecution || !filterExecution || !hwExecution) {
        throw new Error("Capability execution invariant failed.");
    }
    const planned = executions.some((execution) => !execution.executed);
    const codecs = planned ? [] : parseCodecTable(capturedCapabilityText(codecExecution));
    const encoders = planned ? [] : parseEncoderDecoderTable(capturedCapabilityText(encoderExecution), "encoder");
    const decoders = planned ? [] : parseEncoderDecoderTable(capturedCapabilityText(decoderExecution), "decoder");
    const filters = planned ? [] : parseFilterTable(capturedCapabilityText(filterExecution));
    const methods = planned ? [] : parseHardwareAccelerators(capturedCapabilityText(hwExecution));
    return {
        planned,
        ffmpegPath: codecExecution.binary,
        codecs,
        encoders,
        decoders,
        filters,
        hardwareAcceleration: hardwareInfo(methods, encoders, decoders),
        plannedCommands: planned
            ? executions.map((execution) => renderCommandForDisplay({ binary: execution.binary, args: execution.args }))
            : [],
    };
}
//# sourceMappingURL=capabilities.js.map