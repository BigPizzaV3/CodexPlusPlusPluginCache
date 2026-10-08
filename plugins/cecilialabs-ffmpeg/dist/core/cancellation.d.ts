export interface ProcessSignalController {
    signal: AbortSignal;
    dispose(): void;
}
export interface ProcessSignalControllerOptions {
    signals?: readonly NodeJS.Signals[];
}
/**
 * Bridge process signals to AbortSignal for CLI entrypoints. Library callers
 * can instead pass their own AbortSignal directly to the runners.
 */
export declare function createProcessSignalController(options?: ProcessSignalControllerOptions): ProcessSignalController;
//# sourceMappingURL=cancellation.d.ts.map