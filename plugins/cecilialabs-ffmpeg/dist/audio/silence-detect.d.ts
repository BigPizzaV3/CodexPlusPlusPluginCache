import type { SilenceInterval } from "../types/contracts.js";
import type { DetectSilenceRequest, SilenceDetectionReport } from "./types.js";
export declare function parseSilenceDetectOutput(stderr: string): SilenceInterval[];
export declare function detectSilence(input: string, request?: DetectSilenceRequest): Promise<SilenceDetectionReport>;
//# sourceMappingURL=silence-detect.d.ts.map