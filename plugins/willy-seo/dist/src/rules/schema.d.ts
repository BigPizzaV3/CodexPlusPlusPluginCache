import { AuditCheck, ExtractedPageData } from '../types.js';
export declare function auditSchema(data: ExtractedPageData): AuditCheck[];
/**
 * Generador automático de marcado Schema listo para usar
 */
export declare function generateSchemaTemplate(type: 'Article' | 'FAQPage' | 'Organization' | 'Product' | 'LocalBusiness', params: {
    url: string;
    title?: string;
    description?: string;
    faqs?: Array<{
        question: string;
        answer: string;
    }>;
}): string;
