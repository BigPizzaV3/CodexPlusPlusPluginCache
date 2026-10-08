export type MediaFit = "contain" | "cover" | "stretch";
export interface FitGeometry {
    width: number;
    height: number;
    fit?: MediaFit;
    background?: string;
    flags?: string;
}
export declare function buildFitFilters(options: FitGeometry): string[];
//# sourceMappingURL=fit.d.ts.map