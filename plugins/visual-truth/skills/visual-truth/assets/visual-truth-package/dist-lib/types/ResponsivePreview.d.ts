import { PREVIEW_DEVICES, type PreviewMode } from './previewDevices';
import type { VisualChange } from './types';
type ResponsivePreviewProps = {
    mode: PreviewMode;
    onModeChange: (mode: PreviewMode) => void;
    onClose: () => void;
    changes: VisualChange[];
    selectedSelector: string | null;
    selectedLabel: string;
    onMeasurement: (device: keyof typeof PREVIEW_DEVICES, measurement: PreviewMeasurement | null) => void;
};
export type PreviewMeasurement = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function DeviceSwitcher({ value, onChange, includeAll, showHoverHints }: {
    value: PreviewMode | null;
    onChange: (mode: PreviewMode) => void;
    includeAll?: boolean;
    showHoverHints?: boolean;
}): import("react").JSX.Element;
export declare function ResponsivePreview({ mode, onModeChange, onClose, changes, selectedSelector, selectedLabel, onMeasurement }: ResponsivePreviewProps): import("react").JSX.Element;
export {};
