import { AuditCheck, ExtractedPageData } from '../types.js';
/**
 * Estimación aproximada de ancho de píxeles para Google Desktop (fuente Arial 20px)
 */
export declare function estimateTitlePixelWidth(text: string): number;
export declare function auditOnPage(data: ExtractedPageData, keyword?: string): AuditCheck[];
