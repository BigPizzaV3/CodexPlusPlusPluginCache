import type { ErrorCode, ToolkitWarning } from "../types/contracts.js";
export declare const SKILL_SCRIPT_SCHEMA_VERSION: "1.0";
export type SkillExecutionContext = "chatgpt-regular" | "chatgpt-work" | "codex" | "ide" | "terminal" | "unknown";
export type SkillScriptStatus = "completed" | "planned" | "needs-authorization" | "needs-input" | "cancelled" | "failed";
export type ContextSource = "request" | "environment" | "observed" | "unknown";
export interface ExecutionContextInfo {
    name: SkillExecutionContext;
    source: ContextSource;
    canInspectFiles: boolean;
    canExecuteScripts: boolean;
    canInstallDependencies: boolean;
}
export interface SkillScriptRequest<T = unknown> {
    schemaVersion?: typeof SKILL_SCRIPT_SCHEMA_VERSION;
    operation?: string;
    requestId?: string;
    context?: SkillExecutionContext;
    cwd?: string;
    dryRun?: boolean;
    input?: T;
}
export interface SkillArtifact {
    kind: "file" | "directory" | "report" | "command" | "job";
    path?: string;
    description?: string;
    verified: boolean;
}
export interface SkillScriptError {
    code: ErrorCode;
    message: string;
    category: string;
    retryable: boolean;
    failedPhase?: string;
    recovery?: string;
    details?: Record<string, unknown>;
}
export interface SkillResultEnvelope<T = unknown> {
    schemaVersion: typeof SKILL_SCRIPT_SCHEMA_VERSION;
    ok: boolean;
    operation: string;
    status: SkillScriptStatus;
    context: SkillExecutionContext;
    requestId: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    input?: unknown;
    output?: T;
    artifacts: SkillArtifact[];
    warnings: ToolkitWarning[];
    next: string[];
    error?: SkillScriptError | null;
}
export interface SkillScriptHandlerContext<T = unknown> {
    request: SkillScriptRequest<T>;
    context: ExecutionContextInfo;
    signal: AbortSignal;
}
export interface SkillScriptHandlerResult<T = unknown> {
    status?: Exclude<SkillScriptStatus, "cancelled" | "failed">;
    input?: unknown;
    output?: T;
    artifacts?: readonly SkillArtifact[];
    warnings?: readonly ToolkitWarning[];
    next?: readonly string[];
}
export interface RunSkillScriptOptions<T = unknown, O = unknown> {
    operation: string;
    request: SkillScriptRequest<T>;
    handler: (context: SkillScriptHandlerContext<T>) => Promise<SkillScriptHandlerResult<O>>;
    signal?: AbortSignal;
    environment?: NodeJS.ProcessEnv;
    writeStdout?: (value: string) => void;
    writeStderr?: (value: string) => void;
}
//# sourceMappingURL=types.d.ts.map