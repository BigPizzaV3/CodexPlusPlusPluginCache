import { z } from "zod";
/**
 * Stable global options defined by Milestone 0.
 * Unknown properties are intentionally ignored so command-local options can be
 * validated independently by their own schemas in later milestones.
 */
export declare const globalCliOptionsSchema: z.ZodObject<{
    output: z.ZodOptional<z.ZodString>;
    overwrite: z.ZodDefault<z.ZodBoolean>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
    json: z.ZodDefault<z.ZodBoolean>;
    quiet: z.ZodDefault<z.ZodBoolean>;
    verbose: z.ZodDefault<z.ZodBoolean>;
    progress: z.ZodDefault<z.ZodBoolean>;
    color: z.ZodDefault<z.ZodBoolean>;
    ffmpegPath: z.ZodOptional<z.ZodString>;
    ffprobePath: z.ZodOptional<z.ZodString>;
    keepTemp: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type GlobalCliOptions = z.infer<typeof globalCliOptionsSchema>;
export declare function validateGlobalCliOptions(value: unknown): GlobalCliOptions;
//# sourceMappingURL=global-options.d.ts.map