import type { RestoreProfile, RestoreVideoRequest, VideoOperationReport } from "./types.js";
export declare function buildRestoreFilter(width: number, height: number, profile: RestoreProfile, request?: Pick<RestoreVideoRequest, "fit" | "background">): string;
export declare function upscaleVideo(input: string, request: RestoreVideoRequest): Promise<VideoOperationReport>;
/** @deprecated Use upscaleVideo(). Retained for v0.x CLI/API compatibility. */
export declare function restoreVideo(input: string, request: RestoreVideoRequest): Promise<VideoOperationReport>;
//# sourceMappingURL=restore.d.ts.map