export type ElementKind = 'heading' | 'text' | 'button' | 'image' | 'divider' | 'spacer' | 'list' | 'card' | 'section' | 'columns-2' | 'columns-3';
export declare function getInsertionTarget(selected: HTMLElement | null): {
    parent: HTMLElement;
    index: number;
    placement: 'inside' | 'after';
};
export declare function createElementFromKind(kind: ElementKind): HTMLElement;
export declare function insertAt(parent: HTMLElement, element: HTMLElement, index: number): HTMLElement;
export declare function moveToIndex(parent: HTMLElement, element: HTMLElement, index: number): number;
export declare function restoreFromHtml(parent: HTMLElement, html: string, index: number): HTMLElement | null;
export declare function cloneWithUniqueLabels(element: HTMLElement): HTMLElement;
export declare function elementIndex(element: Element): number;
