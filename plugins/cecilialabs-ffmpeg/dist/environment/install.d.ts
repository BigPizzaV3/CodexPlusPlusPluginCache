import { runCommand } from "../core/command-result.js";
import type { SkillExecutionContext } from "../skill-runtime/types.js";
export declare const TOOLKIT_PACKAGE: "@cecilialabs/ffmpeg";
export type ToolkitInstallScope = "global" | "local" | "npm-exec";
export interface InstallToolkitOptions {
    scope: ToolkitInstallScope;
    cwd?: string;
    context?: SkillExecutionContext;
    authorized?: boolean;
    dryRun?: boolean;
    signal?: AbortSignal;
    environment?: NodeJS.ProcessEnv;
}
export interface ToolkitInstallPlan {
    scope: ToolkitInstallScope;
    package: typeof TOOLKIT_PACKAGE;
    cwd: string;
    mutatesProject: boolean;
    command: string;
    args: string[];
    authorizationRequired: boolean;
    verification: string;
}
export interface ToolkitInstallReport {
    status: "planned" | "completed";
    plan: ToolkitInstallPlan;
    execution?: Awaited<ReturnType<typeof runCommand>>;
}
/** Plan or explicitly execute a package installation; never edits shell state. */
export declare function installToolkit(options: InstallToolkitOptions): Promise<ToolkitInstallReport>;
export declare function installCommand(plan: ToolkitInstallPlan): string;
//# sourceMappingURL=install.d.ts.map