/**
 * Milestone 0 contract sketch.
 * These declarations define architecture-level public shapes; Milestone 1 may
 * move them into source modules without changing their semantics.
 */
export type ErrorCategory = "usage" | "config" | "environment" | "capability" | "input" | "probe" | "media" | "operation" | "ffmpeg" | "io" | "batch" | "internal" | "aborted";
export type ErrorCode = "E_USAGE_INVALID_ARGUMENT" | "E_USAGE_MISSING_ARGUMENT" | "E_CONFIG_CONFLICT" | "E_ENV_FFMPEG_NOT_FOUND" | "E_ENV_FFPROBE_NOT_FOUND" | "E_ENV_UNSUPPORTED_FFMPEG" | "E_ENV_NPM_NOT_FOUND" | "E_ENV_INSTALL_FAILED" | "E_CAPABILITY_FILTER_MISSING" | "E_CAPABILITY_ENCODER_MISSING" | "E_INPUT_NOT_FOUND" | "E_INPUT_UNREADABLE" | "E_PROBE_FAILED" | "E_MEDIA_NO_MATCHING_STREAM" | "E_MEDIA_INCOMPATIBLE" | "E_OPERATION_INVALID_RANGE" | "E_OPERATION_UNSUPPORTED" | "E_FFMPEG_EXECUTION_FAILED" | "E_IO_OUTPUT_EXISTS" | "E_IO_PERMISSION_DENIED" | "E_BATCH_EMPTY_SELECTION" | "E_BATCH_PARTIAL_FAILURE" | "E_INTERNAL_INVARIANT" | "E_ABORTED";
export interface ToolkitError {
    code: ErrorCode;
    message: string;
    category: ErrorCategory;
    retryable: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
}
export interface ToolkitWarning {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface FFmpegInvocation {
    binary: string;
    args: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}
export interface CommandExecution {
    binary: string;
    args: string[];
    cwd?: string;
    exitCode: number | null;
    signal?: NodeJS.Signals;
    durationMs: number;
    stdout?: string;
    stderr?: string;
    /** False for --dry-run plans that were validated but not spawned. */
    executed: boolean;
    /** True when capture exceeded the configured tail buffer size. */
    stdoutTruncated: boolean;
    /** True when capture exceeded the configured tail buffer size. */
    stderrTruncated: boolean;
}
export interface ProgressRunSummary {
    runId: string;
    state: "continue" | "end";
    estimated: boolean;
    source?: string;
    totalSeconds?: number;
    processedSeconds?: number;
    percentage?: number;
    frame?: number;
    fps?: number;
    speedMultiplier?: number;
    etaSeconds?: number;
}
export interface ProgressSummary {
    runs: ProgressRunSummary[];
    completedRuns: number;
}
export interface ResultEnvelope<T = unknown> {
    schemaVersion: "1.0";
    ok: boolean;
    command: string;
    requestId: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    data?: T;
    warnings: ToolkitWarning[];
    error?: Omit<ToolkitError, "cause"> | null;
    execution?: Omit<CommandExecution, "durationMs" | "stdout" | "stderr">;
    progress?: ProgressSummary;
}
export type CapabilityMediaType = "video" | "audio" | "subtitle" | "data" | "attachment" | "unknown";
export interface CodecCapability {
    name: string;
    description: string;
    flags: string;
    decoding: boolean;
    encoding: boolean;
    mediaType: CapabilityMediaType;
    intraOnly: boolean;
    lossy: boolean;
    lossless: boolean;
}
export interface EncoderDecoderCapability {
    kind: "encoder" | "decoder";
    name: string;
    description: string;
    mediaType: CapabilityMediaType;
    flags: string;
    frameThreading: boolean;
    sliceThreading: boolean;
    experimental: boolean;
    drawHorizBand: boolean;
    directRendering: boolean;
}
export interface FilterCapability {
    name: string;
    description: string;
    flags: string;
    io: string;
    timelineSupport: boolean;
    sliceThreading: boolean;
    commandSupport: boolean;
}
export interface HardwareBackendCapability {
    name: "nvenc" | "nvdec" | "vaapi" | "qsv" | "videotoolbox" | "cuda" | "vulkan" | "opencl";
    /** True when FFmpeg reports the related accelerator and/or compiled codecs. */
    compiled: boolean;
    reportedMethods: string[];
    encoders: string[];
    decoders: string[];
}
export interface HardwareAccelerationInfo {
    methods: string[];
    backends: HardwareBackendCapability[];
    /** Clarifies that compile-time discovery is not a device-availability test. */
    note: string;
}
export interface MediaFormat {
    formatName?: string;
    formatLongName?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    bitrate?: number;
    tags?: Record<string, string>;
}
export type MediaStreamType = "video" | "audio" | "subtitle" | "data" | "attachment" | "unknown";
export interface BaseMediaStream<TCodecType extends MediaStreamType = MediaStreamType> {
    index: number;
    codecType: TCodecType;
    codecName?: string;
    codecLongName?: string;
    durationSeconds?: number;
    timeBase?: string;
    startTimeSeconds?: number;
    bitrate?: number;
    tags?: Record<string, string>;
}
export interface VideoStream extends BaseMediaStream<"video"> {
    codecType: "video";
    width?: number;
    height?: number;
    pixelFormat?: string;
    sampleAspectRatio?: string;
    displayAspectRatio?: string;
    averageFrameRate?: string;
    realFrameRate?: string;
    fieldOrder?: string;
}
export interface AudioStream extends BaseMediaStream<"audio"> {
    codecType: "audio";
    sampleRate?: number;
    channels?: number;
    channelLayout?: string;
    sampleFormat?: string;
}
export type AuxiliaryMediaStream = BaseMediaStream<Exclude<MediaStreamType, "video" | "audio">>;
export type MediaStream = VideoStream | AudioStream | AuxiliaryMediaStream;
export interface MediaInfo {
    source: string;
    format: MediaFormat;
    streams: MediaStream[];
    video: VideoStream[];
    audio: AudioStream[];
}
export type TrimMode = "auto" | "copy" | "accurate";
export interface TrimStartOptions {
    input: string;
    output?: string;
    seconds: number;
    mode?: TrimMode;
    overwrite?: boolean;
}
export interface SilenceInterval {
    start: number;
    end: number;
    duration: number;
}
export interface NormalizeVideoOptions {
    width?: number;
    height?: number;
    fps?: number;
    pixelFormat?: string;
    normalizeTimebase?: boolean;
    resetTimestamps?: boolean;
}
export interface BatchItemResult<T = unknown> {
    input: string;
    output?: string;
    ok: boolean;
    data?: T;
    warnings: ToolkitWarning[];
    error?: Omit<ToolkitError, "cause"> | null;
}
export interface BatchResult<T = unknown> {
    discovered: number;
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    items: BatchItemResult<T>[];
}
export interface GlobalCliOptions {
    output?: string;
    overwrite: boolean;
    dryRun: boolean;
    json: boolean;
    quiet: boolean;
    verbose: boolean;
    progress: boolean;
    color: boolean;
    ffmpegPath?: string;
    ffprobePath?: string;
    keepTemp: boolean;
}
//# sourceMappingURL=contracts.d.ts.map