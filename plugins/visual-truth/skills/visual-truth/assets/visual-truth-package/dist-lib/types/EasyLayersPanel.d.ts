type Props = {
    selected: HTMLElement | null;
    revision: number;
    onSelect: (element: HTMLElement) => void;
    onIsolate: (element: HTMLElement) => void;
};
export declare function EasyLayersPanel({ selected, revision, onSelect, onIsolate }: Props): import("react").JSX.Element;
export {};
