import type { EditScope, ElementMetrics } from './types';
export type TextDragBehavior = 'reflow' | 'scale';
type EasyInspectorProps = {
    selected: HTMLElement | null;
    metrics: ElementMetrics | null;
    dragBehavior: TextDragBehavior;
    onDragBehavior: (behavior: TextDragBehavior) => void;
    onStyle: (property: string, value: string) => void;
    onAttribute: (attribute: string, value: string, label?: string) => void;
    onEditText: () => void;
    editScope: EditScope;
    onEditScope: (scope: EditScope) => void;
    onSmartAction: (action: 'match-spacing' | 'distribute' | 'responsive' | 'typography' | 'contrast') => void;
};
export declare function EasyInspector({ selected, metrics, dragBehavior, onDragBehavior, onStyle, onAttribute, onEditText, editScope, onEditScope, onSmartAction }: EasyInspectorProps): import("react").JSX.Element;
export {};
