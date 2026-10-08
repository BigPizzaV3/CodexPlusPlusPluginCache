import type { DiagnoseOptions, DiagnosticIssue, DiagnosticReport, FreezeInterval } from "./types.js";
export declare function parseDecodeDiagnostics(stderr: string): DiagnosticIssue[];
export declare function parseFreezeDiagnostics(stderr: string): FreezeInterval[];
export declare function diagnoseMedia(input: string, options?: DiagnoseOptions): Promise<DiagnosticReport>;
//# sourceMappingURL=analyze.d.ts.map