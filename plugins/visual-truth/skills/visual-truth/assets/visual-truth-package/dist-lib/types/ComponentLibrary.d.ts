export type VisualComponentDefinition = {
    id: string;
    name: string;
    html: string;
    createdAt: number;
};
export declare function ComponentLibrary({ components, selected, onCreate, onInsert, onUpdate, onDelete, onClose }: {
    components: VisualComponentDefinition[];
    selected: HTMLElement | null;
    onCreate: () => void;
    onInsert: (component: VisualComponentDefinition) => void;
    onUpdate: (component: VisualComponentDefinition) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}): import("react").JSX.Element;
