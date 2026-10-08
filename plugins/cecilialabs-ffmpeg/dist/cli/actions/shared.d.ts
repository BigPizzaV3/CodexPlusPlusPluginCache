import type { Command } from "commander";
import type { CommandExecution, ToolkitWarning } from "../../types/contracts.js";
import { type GlobalCliOptions } from "../global-options.js";
export interface ActionPayload<T> {
    data: T;
    warnings?: readonly ToolkitWarning[];
    execution?: CommandExecution;
    exitCode?: number;
}
export declare function commandPath(command: Command): string;
export declare function executeAction<T>(command: Command, operation: (options: GlobalCliOptions, signal: AbortSignal) => Promise<ActionPayload<T>>, renderHuman: (data: T) => string): Promise<void>;
//# sourceMappingURL=shared.d.ts.map