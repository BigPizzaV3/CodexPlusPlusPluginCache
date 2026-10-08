import type { VisualChange } from './types';
export type ChangeSession = {
    id: string;
    name: string;
    changeIds: string[];
    enabled: boolean;
    createdAt: number;
};
type Props = {
    changes: VisualChange[];
    selectedIds: Set<string>;
    sessions: ChangeSession[];
    comparing: boolean;
    onToggle: (id: string) => void;
    onToggleSession: (session: ChangeSession) => void;
    onCreateSession: (name: string) => void;
    onCompare: (active: boolean) => void;
    onRevert: (change: VisualChange) => void;
    onSaveVersion: () => void;
    onApply: () => void;
    applying: boolean;
    applyMessage: string;
};
export declare function ChangeReview({ changes, selectedIds, sessions, comparing, onToggle, onToggleSession, onCreateSession, onCompare, onRevert, onSaveVersion, onApply, applying, applyMessage }: Props): import("react").JSX.Element;
export {};
