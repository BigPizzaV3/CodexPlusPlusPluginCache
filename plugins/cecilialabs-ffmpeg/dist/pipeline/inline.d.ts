import type { PipelineDocument } from "./types.js";
export type PipelineCliAction = "validate" | "print" | "run";
export interface PipelineInvocation {
    action: PipelineCliAction;
    source: "file" | "inline";
    file?: string;
    document?: PipelineDocument;
}
export declare function parsePipelineInvocation(tokens: readonly string[], options?: {
    cwd?: string;
    outputOverride?: string;
}): PipelineInvocation;
//# sourceMappingURL=inline.d.ts.map