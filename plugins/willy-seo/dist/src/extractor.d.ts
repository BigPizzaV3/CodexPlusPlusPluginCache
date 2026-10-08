import { ExtractedPageData } from './types.js';
export declare class Extractor {
    /**
     * Descarga y parsea una URL real
     */
    static extractFromUrl(urlStr: string, userAgent?: string): Promise<ExtractedPageData>;
    /**
     * Parsea un string HTML (útil para borradores o tests)
     */
    static parseHtml(html: string, url?: string, statusCode?: number, responseTimeMs?: number, headers?: Record<string, string>): ExtractedPageData;
}
