import { type HardwareEncodingSelection } from "../hardware/index.js";
import type { VideoOutputFormat, VideoRuntimeOptions } from "./types.js";
export declare function resolveVideoHardware(format: VideoOutputFormat, request: VideoRuntimeOptions): Promise<HardwareEncodingSelection | undefined>;
export declare function hardwareReportDetails(selection: HardwareEncodingSelection | undefined): Record<string, unknown>;
//# sourceMappingURL=hardware.d.ts.map