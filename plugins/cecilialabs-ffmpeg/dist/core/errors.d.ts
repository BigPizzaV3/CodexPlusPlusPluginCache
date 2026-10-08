import type { ErrorCategory, ErrorCode, ToolkitError } from "../types/contracts.js";
interface ErrorDefinition {
    category: ErrorCategory;
    exitCode: number;
    retryable: boolean;
}
export declare const ERROR_DEFINITIONS: Readonly<Record<ErrorCode, ErrorDefinition>>;
export interface ToolkitRuntimeErrorOptions {
    details?: Record<string, unknown>;
    cause?: unknown;
    retryable?: boolean;
}
export declare class ToolkitRuntimeError extends Error {
    readonly code: ErrorCode;
    readonly category: ErrorCategory;
    readonly retryable: boolean;
    readonly details?: Record<string, unknown>;
    readonly cause?: unknown;
    constructor(code: ErrorCode, message: string, options?: ToolkitRuntimeErrorOptions);
}
export declare function exitCodeForError(code: ErrorCode): number;
export declare function toToolkitError(error: ToolkitRuntimeError): ToolkitError;
export declare function isToolkitRuntimeError(value: unknown): value is ToolkitRuntimeError;
export {};
//# sourceMappingURL=errors.d.ts.map