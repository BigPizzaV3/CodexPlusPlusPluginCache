export const ERROR_DEFINITIONS = {
    E_USAGE_INVALID_ARGUMENT: { category: "usage", exitCode: 2, retryable: false },
    E_USAGE_MISSING_ARGUMENT: { category: "usage", exitCode: 2, retryable: false },
    E_CONFIG_CONFLICT: { category: "config", exitCode: 2, retryable: false },
    E_ENV_FFMPEG_NOT_FOUND: { category: "environment", exitCode: 3, retryable: false },
    E_ENV_FFPROBE_NOT_FOUND: { category: "environment", exitCode: 3, retryable: false },
    E_ENV_UNSUPPORTED_FFMPEG: { category: "environment", exitCode: 3, retryable: false },
    E_ENV_NPM_NOT_FOUND: { category: "environment", exitCode: 3, retryable: false },
    E_ENV_INSTALL_FAILED: { category: "environment", exitCode: 3, retryable: true },
    E_CAPABILITY_FILTER_MISSING: { category: "capability", exitCode: 3, retryable: false },
    E_CAPABILITY_ENCODER_MISSING: { category: "capability", exitCode: 3, retryable: false },
    E_INPUT_NOT_FOUND: { category: "input", exitCode: 4, retryable: false },
    E_INPUT_UNREADABLE: { category: "input", exitCode: 4, retryable: false },
    E_PROBE_FAILED: { category: "probe", exitCode: 4, retryable: false },
    E_MEDIA_NO_MATCHING_STREAM: { category: "media", exitCode: 4, retryable: false },
    E_MEDIA_INCOMPATIBLE: { category: "media", exitCode: 4, retryable: false },
    E_OPERATION_INVALID_RANGE: { category: "operation", exitCode: 5, retryable: false },
    E_OPERATION_UNSUPPORTED: { category: "operation", exitCode: 5, retryable: false },
    E_FFMPEG_EXECUTION_FAILED: { category: "ffmpeg", exitCode: 5, retryable: false },
    E_IO_OUTPUT_EXISTS: { category: "io", exitCode: 6, retryable: false },
    E_IO_PERMISSION_DENIED: { category: "io", exitCode: 6, retryable: false },
    E_BATCH_EMPTY_SELECTION: { category: "batch", exitCode: 2, retryable: false },
    E_BATCH_PARTIAL_FAILURE: { category: "batch", exitCode: 7, retryable: true },
    E_INTERNAL_INVARIANT: { category: "internal", exitCode: 1, retryable: false },
    E_ABORTED: { category: "aborted", exitCode: 130, retryable: true },
};
export class ToolkitRuntimeError extends Error {
    code;
    category;
    retryable;
    details;
    cause;
    constructor(code, message, options = {}) {
        super(message);
        this.name = "ToolkitRuntimeError";
        this.code = code;
        const definition = ERROR_DEFINITIONS[code];
        this.category = definition.category;
        this.retryable = options.retryable ?? definition.retryable;
        if (options.details !== undefined)
            this.details = options.details;
        if (options.cause !== undefined)
            this.cause = options.cause;
    }
}
export function exitCodeForError(code) {
    return ERROR_DEFINITIONS[code].exitCode;
}
export function toToolkitError(error) {
    return {
        code: error.code,
        message: error.message,
        category: error.category,
        retryable: error.retryable,
        ...(error.details !== undefined ? { details: error.details } : {}),
    };
}
export function isToolkitRuntimeError(value) {
    return value instanceof ToolkitRuntimeError;
}
//# sourceMappingURL=errors.js.map