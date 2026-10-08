import type { Command } from "commander";
export type CommandAction = (command: Command, positional: readonly unknown[]) => Promise<void> | void;
export declare function resolveCommandAction(path: string): CommandAction | undefined;
//# sourceMappingURL=action-registry.d.ts.map