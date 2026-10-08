import type { MouseEventHandler } from 'react';
export type WorkspacePreset = 'duda' | 'squarespace' | 'elementor';
export type WorkspaceTool = 'add' | 'pages' | 'layers' | 'theme' | 'content' | 'seo' | 'more';
type WorkspaceSwitcherProps = {
    value: WorkspacePreset;
    onChange: (preset: WorkspacePreset) => void;
};
export declare function WorkspaceSwitcher({ value, onChange }: WorkspaceSwitcherProps): import("react").JSX.Element;
type WorkspaceRailProps = {
    preset: WorkspacePreset;
    activeTool: WorkspaceTool;
    onTool: (tool: WorkspaceTool) => void;
    onDisplayMenu: MouseEventHandler<HTMLElement>;
};
export declare function WorkspaceRail({ preset, activeTool, onTool, onDisplayMenu }: WorkspaceRailProps): import("react").JSX.Element | null;
export {};
