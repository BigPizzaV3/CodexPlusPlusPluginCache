import type { ConcretePipelineStep, LoadedPipeline, PipelineDocument, PipelineStepKind } from "./types.js";
export interface PipelineInspectionStep {
    index: number;
    kind: PipelineStepKind;
    declaration: ConcretePipelineStep;
}
export interface PipelineInspectionReport {
    operation: "pipeline.validate" | "pipeline.print";
    file: string;
    baseDirectory: string;
    input: string;
    output: string;
    stepCount: number;
    document: PipelineDocument;
    steps: PipelineInspectionStep[];
}
export declare function inspectPipeline(loaded: LoadedPipeline, operation: "pipeline.validate" | "pipeline.print", outputOverride?: string): PipelineInspectionReport;
//# sourceMappingURL=inspection.d.ts.map