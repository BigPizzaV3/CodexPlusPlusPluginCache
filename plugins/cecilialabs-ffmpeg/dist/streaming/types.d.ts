import type { CommandExecution, MediaInfo, ToolkitWarning } from "../types/contracts.js";
export type StreamTransport = "http" | "rtmp" | "rtsp" | "srt" | "udp" | "tcp" | "websocket";
export type StreamContainer = "mpegts" | "flv" | "rtsp";
export type StreamVideoCodec = "h264" | "mpeg1video" | "copy";
export type StreamAudioCodec = "aac" | "copy" | "none";
export type CameraInputFormat = "v4l2" | "avfoundation" | "dshow";
export type RtspTransport = "tcp" | "udp";
export interface StreamRuntimeOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
}
export interface StreamEncodingOptions {
    videoCodec?: StreamVideoCodec;
    audioCodec?: StreamAudioCodec;
    videoBitrate?: string;
    audioBitrate?: string;
    preset?: string;
    gop?: number;
    pixelFormat?: string;
}
export interface StreamDestinationOptions {
    url: string;
    transport?: StreamTransport;
    container?: StreamContainer;
    rtspTransport?: RtspTransport;
}
export interface StreamFileOptions extends StreamRuntimeOptions, StreamEncodingOptions, StreamDestinationOptions {
    realtime?: boolean;
}
export interface StreamCameraOptions extends StreamRuntimeOptions, StreamEncodingOptions, StreamDestinationOptions {
    device: string;
    inputFormat?: CameraInputFormat;
    framerate?: number;
    videoSize?: string;
}
export interface StreamDestination {
    url: string;
    transport: Exclude<StreamTransport, "websocket">;
    container: StreamContainer;
    rtspTransport?: RtspTransport;
}
export type StreamSource = {
    kind: "file";
    path: string;
    realtime: boolean;
} | {
    kind: "camera";
    device: string;
    inputFormat: CameraInputFormat;
    framerate?: number;
    videoSize?: string;
};
export interface StreamEncoding {
    videoCodec: StreamVideoCodec;
    audioCodec: StreamAudioCodec;
    videoBitrate?: string;
    audioBitrate?: string;
    preset?: string;
    gop?: number;
    pixelFormat?: string;
}
export interface StreamPlan {
    source: StreamSource;
    destination: StreamDestination;
    encoding: StreamEncoding;
    args: string[];
    invocation: string;
    warnings: ToolkitWarning[];
}
export interface StreamReport {
    planned: boolean;
    plan: StreamPlan;
    execution: CommandExecution;
    sourceMedia?: MediaInfo;
    warnings: ToolkitWarning[];
}
//# sourceMappingURL=types.d.ts.map