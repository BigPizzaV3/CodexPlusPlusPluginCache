import { ToolkitRuntimeError } from "../core/errors.js";
export const MAX_PIPELINE_PRESET_DEPTH = 32;
export const MAX_EXPANDED_PIPELINE_STEPS = 256;
function expandList(steps, document, stack, counter) {
    const expanded = [];
    for (const step of steps) {
        if (!("preset" in step)) {
            counter.value += 1;
            if (counter.value > MAX_EXPANDED_PIPELINE_STEPS) {
                throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Expanded pipeline exceeds the supported step limit.", {
                    details: { limit: MAX_EXPANDED_PIPELINE_STEPS },
                });
            }
            expanded.push(step);
            continue;
        }
        const name = step.preset;
        const preset = document.presets[name];
        if (preset === undefined) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline references an unknown preset.", {
                details: { preset: name, availablePresets: Object.keys(document.presets).sort() },
            });
        }
        if (stack.length >= MAX_PIPELINE_PRESET_DEPTH) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline preset nesting exceeds the supported depth.", {
                details: { limit: MAX_PIPELINE_PRESET_DEPTH, stack: [...stack, name] },
            });
        }
        if (stack.includes(name)) {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Pipeline preset cycle detected.", {
                details: { cycle: [...stack, name] },
            });
        }
        expanded.push(...expandList(preset, document, [...stack, name], counter));
    }
    return expanded;
}
export function expandPipelineSteps(document) {
    return expandList(document.steps, document, [], { value: 0 });
}
//# sourceMappingURL=presets.js.map