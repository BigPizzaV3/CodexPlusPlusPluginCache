import type { TrimEndRequest, TrimRangeRequest, TrimStartRequest, VideoOperationReport } from "./types.js";
export declare function trimVideoStart(input: string, request: TrimStartRequest): Promise<VideoOperationReport>;
export declare function trimVideoEnd(input: string, request: TrimEndRequest): Promise<VideoOperationReport>;
export declare function trimVideoRange(input: string, request: TrimRangeRequest): Promise<VideoOperationReport>;
//# sourceMappingURL=trim.d.ts.map