export type RulerUnit = 'px' | 'in';
export type RulerGuide = {
    id: string;
    axis: 'x' | 'y';
    position: number;
};
type CanvasRulersProps = {
    unit: RulerUnit;
    guides: RulerGuide[];
    onUnitChange: (unit: RulerUnit) => void;
    onGuidesChange: (guides: RulerGuide[]) => void;
};
export declare function CanvasRulers({ unit, guides, onUnitChange, onGuidesChange }: CanvasRulersProps): import("react").JSX.Element;
export {};
