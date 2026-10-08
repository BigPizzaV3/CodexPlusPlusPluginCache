export interface CommandSpec {
    /** Commander command syntax, including positional argument declarations. */
    syntax: string;
    description: string;
    /** Milestone that owns the real implementation of this command. */
    implementationMilestone: number;
    children?: readonly CommandSpec[];
}
/**
 * Milestone 0 command grammar represented as data. The recursive registration
 * layer means adding a future leaf does not require changes to CLI plumbing.
 */
export declare const COMMAND_TREE: readonly CommandSpec[];
//# sourceMappingURL=command-spec.d.ts.map