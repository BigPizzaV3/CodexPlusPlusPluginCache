type LayersPanelProps = {
    selected: HTMLElement | null;
    onSelect: (element: HTMLElement) => void;
    onReorder: (element: HTMLElement, target: HTMLElement, placement: 'before' | 'inside' | 'after') => void;
    revision: number;
    width: number;
    onWidthChange: (width: number) => void;
};
export declare function LayersPanel({ selected, onSelect, onReorder, revision, width, onWidthChange }: LayersPanelProps): import("react").JSX.Element;
export {};
