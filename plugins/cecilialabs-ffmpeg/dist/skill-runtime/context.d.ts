import type { ExecutionContextInfo, SkillExecutionContext } from "./types.js";
export declare function getExecutionContext(requested: SkillExecutionContext | undefined, environment?: NodeJS.ProcessEnv): ExecutionContextInfo;
export declare function contextGuidance(context: ExecutionContextInfo): string[];
//# sourceMappingURL=context.d.ts.map