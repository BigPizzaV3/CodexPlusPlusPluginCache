import type { ConversionFormat, ConversionReport, ConvertFileRequest } from "./types.js";
export declare function deriveConversionOutputPath(source: string, target: ConversionFormat, explicitOutput?: string, cwd?: string): string;
export declare function convertFile(input: string, request: ConvertFileRequest): Promise<ConversionReport>;
//# sourceMappingURL=convert.d.ts.map