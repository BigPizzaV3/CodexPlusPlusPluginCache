import type { MediaInfo } from "../types/contracts.js";
import type { ConcretePipelineStep, PipelineDocument } from "./types.js";
/** Reject statically impossible transitions without executing media. */
export declare function validatePipelineStepCompatibility(steps: readonly ConcretePipelineStep[]): void;
export declare function validatePipelineOutput(document: PipelineDocument, steps: readonly ConcretePipelineStep[], output: string): void;
export declare function validatePipelineResultCodec(document: PipelineDocument, media: MediaInfo | undefined): void;
//# sourceMappingURL=validation.d.ts.map