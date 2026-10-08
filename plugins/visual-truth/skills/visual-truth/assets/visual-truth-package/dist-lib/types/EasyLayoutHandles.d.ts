import type { ElementMetrics } from './types';
type Props = {
    selected: HTMLElement;
    metrics: ElementMetrics;
    onStyle: (property: string, value: string) => void;
};
export declare function EasyLayoutHandles({ selected, metrics, onStyle }: Props): import("react").JSX.Element;
export {};
