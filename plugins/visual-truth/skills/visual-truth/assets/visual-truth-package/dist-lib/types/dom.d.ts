import type { ElementMetrics, ResponsiveDevice, VisualChange, VisualChangeKind } from './types';
export declare function isEditorElement(target: EventTarget | null): boolean;
export declare function getSelectableTarget(target: EventTarget | null): HTMLElement | null;
export declare function getElementLabel(element: HTMLElement): string;
export declare function getSemanticElementLabel(element: HTMLElement): string;
export declare function getSelector(element: HTMLElement): string;
export declare function readTranslate(element: HTMLElement): {
    x: number;
    y: number;
};
export declare function readMetrics(element: HTMLElement): ElementMetrics;
export declare function createAttributeChange(element: HTMLElement, attribute: string, previousValue: string, runtimeValue: string, displayValue?: string): VisualChange;
export declare function createChange(element: HTMLElement, property: string, previousValue: string, runtimeValue: string, displayValue?: string): VisualChange;
export declare function createResponsiveStyleChange(element: HTMLElement, property: string, previousValue: string, runtimeValue: string, device: ResponsiveDevice, displayValue?: string): VisualChange;
export declare function createStructureChange(element: HTMLElement, kind: Extract<VisualChangeKind, 'insert' | 'remove' | 'reorder'>, parent: HTMLElement, index: number, previousIndex?: number, previousParent?: HTMLElement, previousSelector?: string): VisualChange;
export declare function applyChangeValue(element: HTMLElement, property: string, value: string): void;
export declare function isTextElement(element: HTMLElement | null): element is HTMLElement;
export declare function changesToCodexPrompt(changes: VisualChange[], note?: string, previewContext?: string): string;
