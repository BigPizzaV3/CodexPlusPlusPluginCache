import * as cheerio from 'cheerio';
import { ExtractedPageData } from './types.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 (WillySEO-Bot/1.0)';

export class Extractor {
  /**
   * Descarga y parsea una URL real
   */
  static async extractFromUrl(urlStr: string, userAgent = DEFAULT_USER_AGENT): Promise<ExtractedPageData> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    } catch {
      throw new Error(`URL no válida: ${urlStr}`);
    }

    const startTime = Date.now();
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    const responseTimeMs = Date.now() - startTime;
    const html = await response.text();
    const headersRecord: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersRecord[key.toLowerCase()] = val;
    });

    return this.parseHtml(html, response.url || parsedUrl.toString(), response.status, responseTimeMs, headersRecord);
  }

  /**
   * Parsea un string HTML (útil para borradores o tests)
   */
  static parseHtml(
    html: string,
    url: string = 'https://ejemplo.com',
    statusCode: number = 200,
    responseTimeMs: number = 100,
    headers: Record<string, string> = {}
  ): ExtractedPageData {
    const $ = cheerio.load(html);

    // Title y Metas
    const title = $('title').first().text().trim() || undefined;
    const metaDescription =
      $('meta[name="description" i]').attr('content')?.trim() ||
      $('meta[property="og:description" i]').attr('content')?.trim() ||
      undefined;

    const metaRobots =
      $('meta[name="robots" i]').attr('content')?.toLowerCase() ||
      headers['x-robots-tag']?.toLowerCase() ||
      undefined;

    const canonical = $('link[rel="canonical" i]').attr('href')?.trim() || undefined;

    // Headings
    const h1: string[] = [];
    $('h1').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) h1.push(txt);
    });

    const h2: string[] = [];
    $('h2').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) h2.push(txt);
    });

    const h3: string[] = [];
    $('h3').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) h3.push(txt);
    });

    const h4: string[] = [];
    $('h4').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) h4.push(txt);
    });

    // Imágenes
    const images: ExtractedPageData['images'] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const alt = $(el).attr('alt');
      const isLazy = $(el).attr('loading') === 'lazy' || !!$(el).attr('data-src');
      images.push({
        src,
        alt: alt !== undefined ? alt.trim() : '',
        hasAlt: alt !== undefined && alt.trim().length > 0,
        isLazy,
      });
    });

    // Enlaces
    const links: ExtractedPageData['links'] = [];
    let baseDomain = '';
    try {
      baseDomain = new URL(url).hostname;
    } catch {
      baseDomain = 'ejemplo.com';
    }

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim() || '';
      const text = $(el).text().trim();
      const rel = $(el).attr('rel')?.toLowerCase() || '';
      const isNofollow = rel.includes('nofollow');

      let isInternal = false;
      if (href.startsWith('/') || href.startsWith('#') || href.startsWith('./') || href.startsWith('../')) {
        isInternal = true;
      } else {
        try {
          const linkDomain = new URL(href, url).hostname;
          isInternal = linkDomain === baseDomain;
        } catch {
          isInternal = false;
        }
      }

      links.push({
        href,
        text,
        isInternal,
        isNofollow,
      });
    });

    // Schemas JSON-LD
    const schemas: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawJson = $(el).html();
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed)) {
            schemas.push(...parsed);
          } else {
            schemas.push(parsed);
          }
        }
      } catch {
        // Ignorar json-ld malformado pero registrar que intentó incluirlo
      }
    });

    // OpenGraph
    const openGraph: Record<string, string> = {};
    $('meta[property^="og:" i]').each((_, el) => {
      const prop = $(el).attr('property')?.toLowerCase() || '';
      const content = $(el).attr('content') || '';
      if (prop && content) {
        openGraph[prop] = content;
      }
    });

    // Twitter Card
    const twitterCard: Record<string, string> = {};
    $('meta[name^="twitter:" i]').each((_, el) => {
      const name = $(el).attr('name')?.toLowerCase() || '';
      const content = $(el).attr('content') || '';
      if (name && content) {
        twitterCard[name] = content;
      }
    });

    // Texto limpio y conteo de palabras
    $('script, style, noscript, svg, nav, footer, header').remove();
    const rawText = $('body').text().replace(/\s+/g, ' ').trim();
    const words = rawText.length > 0 ? rawText.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;

    // Otros metas
    const language = $('html').attr('lang') || undefined;
    const charset = $('meta[charset]').attr('charset') || undefined;
    const viewport = $('meta[name="viewport" i]').attr('content') || undefined;

    return {
      url,
      statusCode,
      responseTimeMs,
      contentType: headers['content-type'] || 'text/html',
      headers,
      title,
      metaDescription,
      metaRobots,
      canonical,
      h1,
      h2,
      h3,
      h4,
      images,
      links,
      schemas,
      openGraph,
      twitterCard,
      wordCount,
      rawText,
      language,
      charset,
      viewport,
    };
  }
}
