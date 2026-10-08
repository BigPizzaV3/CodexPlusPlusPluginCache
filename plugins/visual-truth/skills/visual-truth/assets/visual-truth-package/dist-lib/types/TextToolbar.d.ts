import type { ElementMetrics } from './types';
type TextToolbarProps = {
    element: HTMLElement;
    metrics: ElementMetrics;
    onStyle: (property: string, value: string) => void;
    onStyles: (styles: Record<string, string>) => void;
    onConfirm: () => void;
    onCancel: () => void;
};
export declare function TextToolbar({ element, metrics, onStyle, onStyles, onConfirm, onCancel }: TextToolbarProps): import("react").JSX.Element;
export {};
