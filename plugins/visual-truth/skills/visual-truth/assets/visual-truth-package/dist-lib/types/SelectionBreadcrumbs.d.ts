export declare function SelectionBreadcrumbs({ selected, onSelect, isolated, onExitIsolation }: {
    selected: HTMLElement | null;
    onSelect: (element: HTMLElement) => void;
    isolated: HTMLElement | null;
    onExitIsolation: () => void;
}): import("react").JSX.Element | null;
