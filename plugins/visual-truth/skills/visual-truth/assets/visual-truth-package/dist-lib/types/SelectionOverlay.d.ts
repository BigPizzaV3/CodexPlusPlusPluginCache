import { type PointerEvent as ReactPointerEvent } from 'react';
type SpacingProperty = 'margin-top' | 'margin-right' | 'margin-bottom' | 'margin-left' | 'padding-top' | 'padding-right' | 'padding-bottom' | 'padding-left' | 'gap';
export type SelectionSpacing = Record<SpacingProperty, number>;
export type AppearanceProperty = 'color' | 'background-color' | 'border-color' | 'border-width' | 'border-radius' | 'opacity' | 'box-shadow';
export type SelectionAppearance = {
    color: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
    boxShadow: string;
};
export type SelectionSize = {
    width: number;
    height: number;
};
export type SelectionTypography = {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    letterSpacing: number;
    lineHeight: number;
    textAlign: string;
};
export type SelectionPosition = {
    x: number;
    y: number;
};
export type SelectionLiveReadout = {
    kind: 'move';
    x: number;
    y: number;
    axis: 'x' | 'y' | null;
    snappingPaused: boolean;
} | {
    kind: 'resize';
    width: number;
    height: number;
    deltaWidth: number;
    deltaHeight: number;
    ratioLocked: boolean;
    fontSize?: number;
} | {
    kind: 'type';
    fontSize: number;
    delta: number;
} | {
    kind: 'spacing';
    property: SpacingProperty;
    value: number;
    delta: number;
} | {
    kind: 'appearance';
    property: AppearanceProperty;
    value: string;
    previous: string;
    delta?: number;
};
type SelectionOverlayProps = {
    element: HTMLElement;
    revision: number;
    onMoveStart: (event: ReactPointerEvent<HTMLElement>) => void;
    onResizeStart: (handle: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
    liveReadout?: SelectionLiveReadout | null;
    editing?: boolean;
    onDoubleClick: () => void;
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
    onNudge: (x: number, y: number) => void;
    position: SelectionPosition;
    onTranslate: (x: number, y: number) => void;
    onAlign: (axis: 'horizontal' | 'vertical', alignment: 'start' | 'center' | 'end') => void;
    onScale: (factor: number) => void;
    size: SelectionSize;
    aspectLocked: boolean;
    onAspectLocked: (locked: boolean) => void;
    onResize: (dimension: 'width' | 'height', value: string) => void;
    onFitParent: () => void;
    onFontSize: (delta: number) => void;
    typography: SelectionTypography;
    onTypography: (property: string, value: string) => void;
    spacing: SelectionSpacing;
    showGap?: boolean;
    onSpacing: (property: SpacingProperty, delta: number) => void;
    appearance: SelectionAppearance;
    onAppearance: (property: AppearanceProperty, value: string) => void;
    hasChanges: boolean;
    copied: boolean;
    onSendToCodex: () => void;
    canAdjustText?: boolean;
    textDragBehavior?: 'scale' | 'reflow';
    onTextDragBehavior?: (behavior: 'scale' | 'reflow') => void;
    locked?: boolean;
    easyMode?: boolean;
};
export declare function SelectionOverlay({ element, revision, onMoveStart, onResizeStart, liveReadout, editing, onDoubleClick, onContextMenu, onNudge, position, onTranslate, onAlign, onScale, size, aspectLocked, onAspectLocked, onResize, onFitParent, onFontSize, typography, onTypography, spacing, showGap, onSpacing, appearance, onAppearance, hasChanges, copied, onSendToCodex, canAdjustText, textDragBehavior, onTextDragBehavior, locked, easyMode }: SelectionOverlayProps): import("react").JSX.Element;
export {};
