import { ToolkitRuntimeError } from "../core/errors.js";
const LABEL = /^[A-Za-z0-9_:.-]+$/;
function assertLabel(label) {
    if (!LABEL.test(label)) {
        throw new ToolkitRuntimeError("E_INTERNAL_INVARIANT", `Invalid filter-graph label: ${label}`);
    }
    return label;
}
export class FilterGraphBuilder {
    #chains = [];
    addRaw(chain) {
        const value = chain.trim().replace(/;+$/, "");
        if (value.length > 0)
            this.#chains.push(value);
        return this;
    }
    add(inputs, filters, output) {
        if (filters.length === 0) {
            throw new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "A filter graph chain requires at least one filter.");
        }
        const source = inputs.map((label) => `[${assertLabel(label)}]`).join("");
        const destination = `[${assertLabel(output)}]`;
        this.#chains.push(`${source}${filters.join(",")}${destination}`);
        return this;
    }
    build() {
        if (this.#chains.length === 0) {
            throw new ToolkitRuntimeError("E_INTERNAL_INVARIANT", "Cannot build an empty filter graph.");
        }
        return this.#chains.join(";");
    }
    get size() {
        return this.#chains.length;
    }
}
//# sourceMappingURL=filter-graph.js.map