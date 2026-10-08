import { type RunSkillScriptOptions } from "./types.js";
/**
 * Execute one Skill-associated handler and emit exactly one machine-readable
 * envelope. The handler never receives raw process signals or a shell command.
 */
export declare function runSkillScript<T, O>(options: RunSkillScriptOptions<T, O>): Promise<number>;
//# sourceMappingURL=runner.d.ts.map