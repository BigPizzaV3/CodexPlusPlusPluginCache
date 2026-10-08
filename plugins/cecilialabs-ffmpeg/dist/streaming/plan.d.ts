import type { MediaInfo, ToolkitWarning } from "../types/contracts.js";
import type { CameraInputFormat, RtspTransport, StreamAudioCodec, StreamCameraOptions, StreamContainer, StreamDestination, StreamEncoding, StreamFileOptions, StreamTransport, StreamVideoCodec } from "./types.js";
export declare function inferTransport(url: string): Exclude<StreamTransport, "websocket">;
export declare function resolveDestination(options: {
    url: string;
    transport?: StreamTransport;
    container?: StreamContainer;
    rtspTransport?: RtspTransport;
}): StreamDestination;
export declare function resolveEncoding(options: {
    videoCodec?: StreamVideoCodec;
    audioCodec?: StreamAudioCodec;
    videoBitrate?: string;
    audioBitrate?: string;
    preset?: string;
    gop?: number;
    pixelFormat?: string;
}, defaults: {
    audio: StreamAudioCodec;
}): StreamEncoding;
export declare function resolveCameraInputFormat(requested?: CameraInputFormat, platform?: NodeJS.Platform): CameraInputFormat;
export declare function buildFileStreamPlan(source: string, media: MediaInfo | undefined, options: StreamFileOptions): {
    destination: StreamDestination;
    encoding: StreamEncoding;
    args: string[];
    warnings: ToolkitWarning[];
};
export declare function buildCameraStreamPlan(options: StreamCameraOptions): {
    inputFormat: CameraInputFormat;
    destination: StreamDestination;
    encoding: StreamEncoding;
    args: string[];
    warnings: ToolkitWarning[];
};
//# sourceMappingURL=plan.d.ts.map