import { ExtractedPageData, SeoAuditReport } from './types.js';
export declare class Auditor {
    /**
     * Ejecuta la auditoría SEO completa sobre los datos extraídos
     */
    static runAudit(data: ExtractedPageData, targetKeyword?: string): SeoAuditReport;
    private static calculatePillarScore;
    private static generateQuickWins;
    private static generateSerpPreview;
    private static generateProposedSolutions;
    private static generateActionPlan;
    private static generateExecutiveSummary;
}
