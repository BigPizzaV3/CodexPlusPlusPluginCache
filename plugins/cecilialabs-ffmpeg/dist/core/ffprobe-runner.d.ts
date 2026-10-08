import type { CommandExecution } from "../types/contracts.js";
import { type RunCommandOptions } from "./command-result.js";
export interface FFprobeRunOptions extends RunCommandOptions {
    ffprobePath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}
export declare function runFFprobe(args: readonly string[], options?: FFprobeRunOptions): Promise<CommandExecution>;
//# sourceMappingURL=ffprobe-runner.d.ts.map