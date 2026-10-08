import type { LoadedPipeline, PipelineDocument } from "./types.js";
export declare function parsePipelineText(text: string, source?: string): PipelineDocument;
export declare function loadPipelineFile(file: string, cwd?: string): Promise<LoadedPipeline>;
//# sourceMappingURL=parser.d.ts.map