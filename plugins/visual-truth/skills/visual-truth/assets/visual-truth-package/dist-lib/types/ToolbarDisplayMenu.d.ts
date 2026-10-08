import type { ContextMenuPosition } from './ElementContextMenu';
type ToolbarDisplayMenuProps = {
    position: ContextMenuPosition;
    labelsShown: boolean;
    hoverHints: boolean;
    onLabelsShown: (shown: boolean) => void;
    onHoverHints: (shown: boolean) => void;
    onFeedback: () => void;
    onClose: () => void;
};
export declare function ToolbarDisplayMenu({ position, labelsShown, hoverHints, onLabelsShown, onHoverHints, onFeedback, onClose }: ToolbarDisplayMenuProps): import("react").JSX.Element;
export {};
