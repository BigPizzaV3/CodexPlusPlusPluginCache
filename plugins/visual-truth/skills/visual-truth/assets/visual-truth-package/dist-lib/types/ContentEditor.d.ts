export declare function ContentEditor({ selected, onAttribute, onText, onEditText, onClose }: {
    selected: HTMLElement | null;
    onAttribute: (attribute: string, value: string, label?: string) => void;
    onText: (value: string) => void;
    onEditText: () => void;
    onClose: () => void;
}): import("react").JSX.Element;
