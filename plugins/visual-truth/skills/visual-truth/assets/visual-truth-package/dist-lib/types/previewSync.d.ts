import type { VisualChange } from './types';
export declare function applyChangesToPreview(document: Document | null, changes: VisualChange[]): void;
export declare function applyResponsiveStyles(document: Document | null, changes: VisualChange[]): void;
export declare function syncChangesToPreview(iframe: HTMLIFrameElement, changes: VisualChange[]): void;
