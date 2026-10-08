export type PreviewMode = 'desktop' | 'tablet' | 'phone' | 'all';
export declare const PREVIEW_DEVICES: {
    readonly desktop: {
        readonly label: "Desktop";
        readonly width: 1440;
        readonly height: 900;
        readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    };
    readonly tablet: {
        readonly label: "iPad";
        readonly width: 1024;
        readonly height: 1366;
        readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    };
    readonly phone: {
        readonly label: "Phone";
        readonly width: 440;
        readonly height: 956;
        readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    };
};
