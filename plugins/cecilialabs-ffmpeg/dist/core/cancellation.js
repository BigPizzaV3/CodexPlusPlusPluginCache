/**
 * Bridge process signals to AbortSignal for CLI entrypoints. Library callers
 * can instead pass their own AbortSignal directly to the runners.
 */
export function createProcessSignalController(options = {}) {
    const controller = new AbortController();
    const signals = options.signals ?? ["SIGINT", "SIGTERM"];
    const listeners = new Map();
    for (const signal of signals) {
        const listener = () => {
            if (!controller.signal.aborted) {
                controller.abort(new Error(`Received ${signal}`));
            }
        };
        listeners.set(signal, listener);
        process.once(signal, listener);
    }
    return {
        signal: controller.signal,
        dispose() {
            for (const [signal, listener] of listeners) {
                process.removeListener(signal, listener);
            }
            listeners.clear();
        },
    };
}
//# sourceMappingURL=cancellation.js.map