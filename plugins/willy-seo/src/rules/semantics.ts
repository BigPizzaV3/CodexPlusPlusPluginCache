import { AuditCheck, ExtractedPageData } from '../types.js';

export function auditSemantics(data: ExtractedPageData, keyword?: string): AuditCheck[] {
  const checks: AuditCheck[] = [];
  const cleanKw = keyword ? keyword.toLowerCase().trim() : undefined;

  // 1. Longitud del contenido (Word count)
  if (data.wordCount < 150) {
    checks.push({
      id: 'sem-thin-content',
      category: 'semantics',
      name: 'Profundidad de Contenido (Thin Content)',
      status: 'critical',
      score: 20,
      weight: 25,
      message: `Página con muy poco texto (${data.wordCount} palabras). Riesgo alto de Thin Content según directrices de Google.`,
      recommendation: 'Desarrolla el contenido para responder a la intención del usuario con mayor profundidad (mínimo 300-600 palabras para landing pages, 800+ para artículos).',
    });
  } else if (data.wordCount < 400) {
    checks.push({
      id: 'sem-content-medium',
      category: 'semantics',
      name: 'Profundidad de Contenido',
      status: 'warning',
      score: 70,
      weight: 20,
      message: `Contenido moderado (${data.wordCount} palabras). Adecuado para fichas o páginas de contacto, pero mejorable para posicionamiento orgánico.`,
      recommendation: 'Si compites en keywords informacionales o comerciales, añade secciones explicativas o preguntas frecuentes.',
    });
  } else {
    checks.push({
      id: 'sem-content-rich',
      category: 'semantics',
      name: 'Profundidad de Contenido',
      status: 'good',
      score: 100,
      weight: 25,
      message: `Extensión de contenido sólida (${data.wordCount} palabras).`,
    });
  }

  // 2. Keyword en URL / Slug
  if (cleanKw) {
    try {
      const urlObj = new URL(data.url);
      const pathname = decodeURIComponent(urlObj.pathname.toLowerCase());
      const kwSlug = cleanKw.replace(/\s+/g, '-');

      if (pathname.includes(cleanKw) || pathname.includes(kwSlug)) {
        checks.push({
          id: 'sem-url-kw-match',
          category: 'semantics',
          name: 'Keyword en la URL / Slug',
          status: 'good',
          score: 100,
          weight: 15,
          message: `La URL contiene la palabra clave objetivo (${pathname}).`,
        });
      } else {
        checks.push({
          id: 'sem-url-kw-missing',
          category: 'semantics',
          name: 'Keyword en la URL / Slug',
          status: 'warning',
          score: 60,
          weight: 15,
          message: `La URL (${pathname}) no incluye explícitamente la palabra clave "${keyword}".`,
          recommendation: 'Si se trata de una página nueva, incluye la palabra clave principal en el slug limpio.',
        });
      }
    } catch {
      // Ignorar error de URL
    }

    // 3. Keyword en primer párrafo o primeras 100 palabras
    const first100Words = data.rawText.toLowerCase().split(/\s+/).slice(0, 100).join(' ');
    if (first100Words.includes(cleanKw)) {
      checks.push({
        id: 'sem-kw-intro-found',
        category: 'semantics',
        name: 'Presencia de Keyword en la introducción',
        status: 'good',
        score: 100,
        weight: 15,
        message: `La keyword "${keyword}" aparece en el primer párrafo o inicio del texto (fundamental para confirmar relevancia).`,
      });
    } else {
      checks.push({
        id: 'sem-kw-intro-missing',
        category: 'semantics',
        name: 'Presencia de Keyword en la introducción',
        status: 'warning',
        score: 50,
        weight: 15,
        message: `No se ha encontrado la keyword "${keyword}" en las primeras 100 palabras del texto.`,
        recommendation: 'Menciona la palabra clave o entidad principal de forma natural en el primer párrafo para fijar el contexto temático.',
      });
    }

    // 4. Keyword en H1
    if (data.h1.length > 0) {
      const h1Text = data.h1.join(' ').toLowerCase();
      if (h1Text.includes(cleanKw)) {
        checks.push({
          id: 'sem-h1-kw-match',
          category: 'semantics',
          name: 'Keyword en el H1',
          status: 'good',
          score: 100,
          weight: 20,
          message: `El encabezado principal H1 incluye la palabra clave "${keyword}".`,
        });
      } else {
        checks.push({
          id: 'sem-h1-kw-missing',
          category: 'semantics',
          name: 'Keyword en el H1',
          status: 'warning',
          score: 45,
          weight: 20,
          message: `El encabezado H1 ("${data.h1[0]}") no contiene la palabra clave objetivo.`,
          recommendation: `Alinea el H1 con la intención de búsqueda de "${keyword}".`,
        });
      }
    }
  }

  // 5. Enlazado Interno y Externo
  const internalLinks = data.links.filter(l => l.isInternal);
  const externalLinks = data.links.filter(l => !l.isInternal);

  if (internalLinks.length === 0 && data.wordCount > 200) {
    checks.push({
      id: 'sem-internal-links-missing',
      category: 'semantics',
      name: 'Enlazado Interno (Internal Linking)',
      status: 'warning',
      score: 40,
      weight: 15,
      message: 'No se detectaron enlaces internos en el contenido.',
      recommendation: 'Añade enlaces internos contextuales hacia páginas relacionadas o categorías para distribuir el link equity.',
    });
  } else {
    checks.push({
      id: 'sem-internal-links-ok',
      category: 'semantics',
      name: 'Enlazado Interno',
      status: 'good',
      score: 100,
      weight: 15,
      message: `Detectados ${internalLinks.length} enlaces internos y ${externalLinks.length} enlaces salientes.`,
    });
  }

  return checks;
}
