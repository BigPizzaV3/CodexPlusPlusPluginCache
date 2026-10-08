import type { Command } from "commander";
export declare function runDoctorAction(command: Command): Promise<void>;
export declare function runEnvironmentVersionAction(command: Command): Promise<void>;
export declare function runEnvironmentCapabilitiesAction(command: Command): Promise<void>;
export declare function runEnvironmentCheckAction(command: Command): Promise<void>;
export declare function runProbeAction(command: Command, positional: readonly unknown[]): Promise<void>;
export declare function runEnvironmentInstallAction(command: Command, positional: readonly unknown[]): Promise<void>;
//# sourceMappingURL=environment.d.ts.map