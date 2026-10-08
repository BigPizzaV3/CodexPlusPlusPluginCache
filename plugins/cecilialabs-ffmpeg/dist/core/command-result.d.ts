import type { CommandExecution, FFmpegInvocation } from "../types/contracts.js";
export interface RunCommandOptions {
    dryRun?: boolean;
    verbose?: boolean;
    signal?: AbortSignal;
    teeStdout?: boolean;
    teeStderr?: boolean;
    maxCaptureBytes?: number;
    abortGraceMs?: number;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    onDiagnostic?: (message: string) => void;
}
/** Render an invocation for logs only. The returned string is never executed. */
export declare function renderCommandForDisplay(invocation: FFmpegInvocation): string;
/**
 * Execute a process using an argument array and `shell: false`.
 * Non-zero exit codes are returned to the caller; domain runners decide how to
 * classify them. Spawn failures and cancellations are raised as typed errors.
 */
export declare function runCommand(invocation: FFmpegInvocation, options?: RunCommandOptions): Promise<CommandExecution>;
//# sourceMappingURL=command-result.d.ts.map