import type { ElementKind } from './elements';
import type { PortableSection } from './studio';
type ElementsPanelProps = {
    targetLabel: string;
    placement: 'before' | 'inside' | 'after';
    onAdd: (kind: ElementKind) => void;
    onClose: () => void;
    sections?: PortableSection[];
    onInsertSection?: (section: PortableSection) => void;
};
export declare function ElementsPanel({ targetLabel, placement, onAdd, onClose, sections, onInsertSection }: ElementsPanelProps): import("react").JSX.Element;
export {};
