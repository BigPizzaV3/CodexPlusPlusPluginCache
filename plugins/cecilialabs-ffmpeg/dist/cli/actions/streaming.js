import { z } from "zod";
import { ToolkitRuntimeError } from "../../core/errors.js";
import { streamCamera, streamFile, } from "../../streaming/index.js";
import { executeAction } from "./shared.js";
const positive = z.coerce.number().positive();
const positiveInt = z.coerce.number().int().positive();
const commonSchema = z.object({
    url: z.string().min(1),
    transport: z.enum(["http", "rtmp", "rtsp", "srt", "udp", "tcp", "websocket"]).optional(),
    container: z.enum(["mpegts", "flv", "rtsp"]).optional(),
    rtspTransport: z.enum(["tcp", "udp"]).default("tcp"),
    videoCodec: z.enum(["h264", "mpeg1video", "copy"]).default("h264"),
    audioCodec: z.enum(["aac", "copy", "none"]).optional(),
    videoBitrate: z.string().min(1).optional(),
    audioBitrate: z.string().min(1).default("128k"),
    preset: z.string().min(1).default("veryfast"),
    gop: positiveInt.optional(),
    pixelFormat: z.string().min(1).default("yuv420p"),
});
function input(positional) {
    const value = positional[0];
    if (typeof value !== "string" || value.length === 0) {
        throw new ToolkitRuntimeError("E_USAGE_MISSING_ARGUMENT", "stream file requires an input file.");
    }
    return value;
}
function runtime(global, signal) {
    return {
        ...(global.ffmpegPath !== undefined ? { ffmpegPath: global.ffmpegPath } : {}),
        ...(global.ffprobePath !== undefined ? { ffprobePath: global.ffprobePath } : {}),
        dryRun: global.dryRun,
        verbose: global.verbose,
        signal,
    };
}
function commonOptions(parsed) {
    return {
        url: parsed.url,
        ...(parsed.transport !== undefined ? { transport: parsed.transport } : {}),
        ...(parsed.container !== undefined ? { container: parsed.container } : {}),
        rtspTransport: parsed.rtspTransport,
        videoCodec: parsed.videoCodec,
        ...(parsed.audioCodec !== undefined ? { audioCodec: parsed.audioCodec } : {}),
        ...(parsed.videoBitrate !== undefined ? { videoBitrate: parsed.videoBitrate } : {}),
        audioBitrate: parsed.audioBitrate,
        preset: parsed.preset,
        ...(parsed.gop !== undefined ? { gop: parsed.gop } : {}),
        pixelFormat: parsed.pixelFormat,
    };
}
function render(report) {
    return [
        `stream ${report.plan.source.kind}${report.planned ? " (dry run)" : ""}`,
        `Source: ${report.plan.source.kind === "file" ? report.plan.source.path : report.plan.source.device}`,
        `Transport: ${report.plan.destination.transport}`,
        `Container: ${report.plan.destination.container}`,
        `Destination: ${report.plan.destination.url}`,
        `Video: ${report.plan.encoding.videoCodec}`,
        `Audio: ${report.plan.encoding.audioCodec}`,
        `Command: ${report.plan.invocation}`,
    ].join("\n");
}
export async function runStreamFileAction(command, positional) {
    await executeAction(command, async (global, signal) => {
        const parsed = commonSchema.extend({ realtime: z.boolean().default(true) }).parse(command.opts());
        const options = {
            ...runtime(global, signal),
            ...commonOptions(parsed),
            realtime: parsed.realtime,
        };
        const report = await streamFile(input(positional), options);
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, render);
}
export async function runStreamCameraAction(command) {
    await executeAction(command, async (global, signal) => {
        const parsed = commonSchema
            .extend({
            device: z.string().min(1),
            inputFormat: z.enum(["v4l2", "avfoundation", "dshow"]).optional(),
            framerate: positive.optional(),
            videoSize: z.string().regex(/^\d+x\d+$/).optional(),
        })
            .parse(command.opts());
        const options = {
            ...runtime(global, signal),
            ...commonOptions(parsed),
            device: parsed.device,
            ...(parsed.inputFormat !== undefined ? { inputFormat: parsed.inputFormat } : {}),
            ...(parsed.framerate !== undefined ? { framerate: parsed.framerate } : {}),
            ...(parsed.videoSize !== undefined ? { videoSize: parsed.videoSize } : {}),
        };
        const report = await streamCamera(options);
        return { data: report, warnings: report.warnings, execution: report.execution };
    }, render);
}
//# sourceMappingURL=streaming.js.map