import type { Command } from "commander";
export declare function runTrimStartAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runTrimEndAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runTrimRangeAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runVideoSpeedAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runVideoFromImageAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runVideoUpscaleAction(command: Command, positional: readonly unknown[]): Promise<void>;
/** Compatibility alias for pre-v1 CLI users. */
export declare function runVideoRestoreAction(command: Command, positional: readonly unknown[]): Promise<void>;
//# sourceMappingURL=video.d.ts.map