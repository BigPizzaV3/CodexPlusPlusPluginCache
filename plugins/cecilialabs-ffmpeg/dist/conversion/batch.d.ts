import type { BatchConversionReport, ConversionFormat, ConvertBatchRequest } from "./types.js";
export interface DiscoveredBatchInput {
    input: string;
    relativeInput: string;
}
export declare function discoverBatchInputs(directory: string, options: {
    from: ConversionFormat;
    recursive?: boolean;
    includes?: readonly string[];
    excludes?: readonly string[];
}): Promise<DiscoveredBatchInput[]>;
export declare function convertBatch(directoryInput: string, request: ConvertBatchRequest): Promise<BatchConversionReport>;
export declare function batchExitCode(report: BatchConversionReport): number | undefined;
//# sourceMappingURL=batch.d.ts.map