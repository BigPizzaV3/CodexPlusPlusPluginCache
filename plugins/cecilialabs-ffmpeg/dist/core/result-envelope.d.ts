import type { CommandExecution, ProgressSummary, ResultEnvelope, ToolkitWarning } from "../types/contracts.js";
import { type ToolkitRuntimeError } from "./errors.js";
export interface ResultContext {
    command: string;
    requestId: string;
    startedAt: string;
    startedMonotonicMs: number;
}
export declare function createResultContext(command: string, requestId?: string): ResultContext;
export declare function createSuccessEnvelope<T>(context: ResultContext, data: T, options?: {
    warnings?: readonly ToolkitWarning[];
    execution?: CommandExecution;
    progress?: ProgressSummary;
}): ResultEnvelope<T>;
export declare function createFailureEnvelope(context: ResultContext, error: ToolkitRuntimeError, options?: {
    warnings?: readonly ToolkitWarning[];
    execution?: CommandExecution;
    progress?: ProgressSummary;
}): ResultEnvelope<never>;
//# sourceMappingURL=result-envelope.d.ts.map