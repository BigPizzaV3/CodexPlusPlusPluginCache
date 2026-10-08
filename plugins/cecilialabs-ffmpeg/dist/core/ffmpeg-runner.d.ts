import type { CommandExecution } from "../types/contracts.js";
import { type RunCommandOptions } from "./command-result.js";
export interface FFmpegRunOptions extends RunCommandOptions {
    ffmpegPath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}
export declare function runFFmpeg(args: readonly string[], options?: FFmpegRunOptions): Promise<CommandExecution>;
//# sourceMappingURL=ffmpeg-runner.d.ts.map