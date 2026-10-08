export type VisualTruthCommand = {
    id: string;
    label: string;
    hint?: string;
    run: () => void;
};
export declare function CommandPalette({ open, commands, onClose }: {
    open: boolean;
    commands: VisualTruthCommand[];
    onClose: () => void;
}): import("react").JSX.Element | null;
