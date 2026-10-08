import type { Command } from "commander";
import { type ConversionFormat } from "../../conversion/index.js";
export declare function runConvertFileAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runConvertBatchAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function isConversionFormat(value: string): value is ConversionFormat;
//# sourceMappingURL=conversion.d.ts.map