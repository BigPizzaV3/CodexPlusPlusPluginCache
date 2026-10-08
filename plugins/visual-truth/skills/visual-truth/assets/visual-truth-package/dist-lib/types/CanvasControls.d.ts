export declare function CanvasControls({ zoom, panMode, isolated, onZoom, onFitPage, onFitSelection, onPanMode, onIsolate, onExitIsolation, sections }: {
    zoom: number;
    panMode: boolean;
    isolated: HTMLElement | null;
    onZoom: (zoom: number) => void;
    onFitPage: () => void;
    onFitSelection: () => void;
    onPanMode: (active: boolean) => void;
    onIsolate: () => void;
    onExitIsolation: () => void;
    sections: HTMLElement[];
}): import("react").JSX.Element;
