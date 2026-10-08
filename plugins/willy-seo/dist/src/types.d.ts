export type Severity = 'critical' | 'warning' | 'info' | 'good';
export interface AuditCheck {
    id: string;
    category: 'technical' | 'onpage' | 'semantics' | 'schema' | 'performance';
    name: string;
    status: Severity;
    score: number;
    weight: number;
    message: string;
    recommendation?: string;
    snippet?: string;
}
export interface ExtractedPageData {
    url: string;
    statusCode: number;
    responseTimeMs: number;
    contentType: string;
    headers: Record<string, string>;
    title?: string;
    metaDescription?: string;
    metaRobots?: string;
    canonical?: string;
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    images: Array<{
        src: string;
        alt: string;
        hasAlt: boolean;
        isLazy: boolean;
    }>;
    links: Array<{
        href: string;
        text: string;
        isInternal: boolean;
        isNofollow: boolean;
    }>;
    schemas: any[];
    openGraph: Record<string, string>;
    twitterCard: Record<string, string>;
    wordCount: number;
    rawText: string;
    language?: string;
    charset?: string;
    viewport?: string;
}
export interface PillarScore {
    name: string;
    score: number;
    weight: number;
    status: Severity;
    checks: AuditCheck[];
}
export interface QuickWin {
    title: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    description: string;
    solutionCode?: string;
}
export interface SerpPreviewData {
    desktop: {
        title: string;
        pixelWidth: number;
        isTruncated: boolean;
        url: string;
        description: string;
    };
    mobile: {
        title: string;
        pixelWidth: number;
        isTruncated: boolean;
        url: string;
        description: string;
    };
}
export interface SeoAuditReport {
    brand: 'Willy SEO';
    url: string;
    targetKeyword?: string;
    analyzedAt: string;
    overallScore: number;
    overallStatus: 'Óptimo' | 'Mejorable' | 'Crítico';
    summary: string;
    quickWins: QuickWin[];
    pillars: {
        technical: PillarScore;
        onpage: PillarScore;
        semantics: PillarScore;
        schema: PillarScore;
    };
    serpPreview: SerpPreviewData;
    proposedSolutions: {
        optimizedTitle?: string;
        optimizedMetaDescription?: string;
        recommendedHeadings?: string[];
        schemaJsonLd?: string;
    };
    actionPlan: Array<{
        step: number;
        priority: 'Alta' | 'Media' | 'Baja';
        task: string;
        details: string;
    }>;
}
