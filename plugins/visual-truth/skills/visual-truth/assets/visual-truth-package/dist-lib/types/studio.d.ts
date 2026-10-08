import type { VisualChange } from './types';
export type PortableSection = {
    id: string;
    name: string;
    html: string;
    createdAt: number;
};
export type NamedStyle = {
    id: string;
    name: string;
    properties: Record<string, string>;
    createdAt: number;
};
export type DataBindingTarget = 'text' | 'src' | 'href' | 'background-image';
export type DataBinding = {
    selector: string;
    field: string;
    target: DataBindingTarget;
};
export type RepeaterDefinition = {
    id: string;
    name: string;
    templateSelector: string;
    bindings: DataBinding[];
    data: Array<Record<string, unknown>>;
    createdAt: number;
};
export type PortableSectionPayload = {
    format: 'visual-truth-section';
    version: 1;
    section: PortableSection;
};
export declare const CAPTURED_STYLE_PROPERTIES: readonly ["display", "position", "inset", "width", "height", "min-width", "min-height", "max-width", "max-height", "margin", "padding", "gap", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "flex", "flex-direction", "flex-wrap", "justify-content", "align-items", "align-self", "order", "color", "background", "background-color", "background-image", "background-size", "background-position", "background-repeat", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-decoration", "border", "border-color", "border-width", "border-style", "border-radius", "box-shadow", "opacity", "object-fit", "object-position", "overflow", "aspect-ratio", "translate", "transform", "z-index"];
export declare const loadPortableSections: () => PortableSection[];
export declare const savePortableSections: (value: PortableSection[]) => void;
export declare const loadNamedStyles: () => NamedStyle[];
export declare const saveNamedStyles: (value: NamedStyle[]) => void;
export declare const loadRepeaters: () => RepeaterDefinition[];
export declare const saveRepeaters: (value: RepeaterDefinition[]) => void;
export declare function capturePortableSection(element: HTMLElement, name?: string): PortableSection;
export declare function captureNamedStyle(element: HTMLElement, name?: string): NamedStyle;
export declare function parsePortableSection(value: string): PortableSection | null;
export declare function serializePortableSection(section: PortableSection): string;
export declare function bindingSelector(template: HTMLElement, target: HTMLElement): string;
export declare function preparePortableInsertion(element: HTMLElement): void;
export declare function applyRepeater(template: HTMLElement, definition: RepeaterDefinition): HTMLElement[];
export declare function responsiveOverridesFor(selected: HTMLElement | null, changes: VisualChange[]): Record<string, Set<string>>;
export declare function latestDurableChanges(changes: VisualChange[]): VisualChange[];
export declare function generateDurablePatchSource(changes: VisualChange[]): string;
