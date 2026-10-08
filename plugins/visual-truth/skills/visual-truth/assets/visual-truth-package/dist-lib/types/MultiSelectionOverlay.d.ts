import type { PointerEvent as ReactPointerEvent } from 'react';
type MultiSelectionOverlayProps = {
    elements: HTMLElement[];
    revision: number;
    grouped: boolean;
    onMoveStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    onAlign: (axis: 'horizontal' | 'vertical', alignment: 'start' | 'center' | 'end') => void;
    onDistribute: (axis: 'horizontal' | 'vertical') => void;
    onGroup: () => void;
    onUngroup: () => void;
};
export declare function MultiSelectionOverlay({ elements, revision, grouped, onMoveStart, onAlign, onDistribute, onGroup, onUngroup }: MultiSelectionOverlayProps): import("react").JSX.Element | null;
export {};
