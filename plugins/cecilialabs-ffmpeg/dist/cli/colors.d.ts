export declare const codes: {
    readonly reset: "\u001B[0m";
    readonly bold: "\u001B[1m";
    readonly cyan: "\u001B[38;2;0;210;255m";
    readonly green: "\u001B[38;2;0;255;140m";
    readonly yellow: "\u001B[93m";
    readonly red: "\u001B[91m";
    readonly magenta: "\u001B[95m";
    readonly log: "\u001B[38;2;110;130;125m";
    readonly white: "\u001B[97m";
};
export declare function wrap(text: string, ...styles: string[]): string;
export declare function brandCyan(text: string): string;
export declare function normalCyan(text: string): string;
export declare function brandGreen(text: string): string;
export declare function brandYellow(text: string): string;
export declare function normalGreen(text: string): string;
export declare function brandMagenta(text: string): string;
export declare function normalMagenta(text: string): string;
export declare function brandWhite(text: string): string;
export declare function normalWhite(text: string): string;
export declare function normalLog(text: string): string;
export declare function colorEnabled(requested: boolean, stream: {
    isTTY?: boolean;
}, env?: NodeJS.ProcessEnv): boolean;
export declare function colorizeHumanOutput(text: string, enabled: boolean): string;
export declare function colorizeProgressLine(text: string, enabled: boolean): string;
export declare function colorizeWarning(code: string, message: string, enabled: boolean): string;
export declare function colorizeError(code: string, message: string, enabled: boolean): string;
//# sourceMappingURL=colors.d.ts.map