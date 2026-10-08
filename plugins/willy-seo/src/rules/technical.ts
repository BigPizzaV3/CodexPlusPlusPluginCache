import { AuditCheck, ExtractedPageData } from '../types.js';

export function auditTechnical(data: ExtractedPageData): AuditCheck[] {
  const checks: AuditCheck[] = [];

  // 1. HTTP Status Code
  if (data.statusCode >= 200 && data.statusCode < 300) {
    checks.push({
      id: 'tech-status-200',
      category: 'technical',
      name: 'Código de Estado HTTP',
      status: 'good',
      score: 100,
      weight: 30,
      message: `La página responde con código de estado HTTP ${data.statusCode} OK.`,
    });
  } else if (data.statusCode >= 300 && data.statusCode < 400) {
    checks.push({
      id: 'tech-status-redirect',
      category: 'technical',
      name: 'Código de Estado HTTP',
      status: 'warning',
      score: 70,
      weight: 30,
      message: `La URL genera una redirección (HTTP ${data.statusCode}).`,
      recommendation: 'Asegúrate de que la redirección sea 301 (permanente) y no cree bucles ni cadenas de redirección.',
    });
  } else {
    checks.push({
      id: 'tech-status-error',
      category: 'technical',
      name: 'Código de Estado HTTP',
      status: 'critical',
      score: 0,
      weight: 35,
      message: `La página devuelve un error HTTP ${data.statusCode}.`,
      recommendation: 'Revisa la disponibilidad del servidor o la ruta del recurso solicitado.',
    });
  }

  // 2. Meta Robots (Index / Noindex)
  if (data.metaRobots) {
    if (data.metaRobots.includes('noindex')) {
      checks.push({
        id: 'tech-robots-noindex',
        category: 'technical',
        name: 'Directiva de Indexación (Meta Robots)',
        status: 'critical',
        score: 0,
        weight: 30,
        message: `Detectada directiva "noindex" (${data.metaRobots}). Esta página está bloqueada para los buscadores y NO aparecerá en Google.`,
        recommendation: 'Si deseas posicionar esta página, elimina la etiqueta "noindex".',
        snippet: `<meta name="robots" content="${data.metaRobots}">`,
      });
    } else {
      checks.push({
        id: 'tech-robots-index',
        category: 'technical',
        name: 'Directiva de Indexación (Meta Robots)',
        status: 'good',
        score: 100,
        weight: 20,
        message: `Página indexable. Directiva: "${data.metaRobots}".`,
      });
    }
  } else {
    checks.push({
      id: 'tech-robots-default',
      category: 'technical',
      name: 'Directiva de Indexación (Meta Robots)',
      status: 'good',
      score: 100,
      weight: 20,
      message: 'No hay restricción de indexación (por defecto Google indexará la página: index, follow).',
    });
  }

  // 3. Etiqueta Canonical
  if (!data.canonical) {
    checks.push({
      id: 'tech-canonical-missing',
      category: 'technical',
      name: 'Etiqueta Canonical',
      status: 'warning',
      score: 50,
      weight: 15,
      message: 'No se ha especificado etiqueta <link rel="canonical">.',
      recommendation: 'Añade una etiqueta canonical autorreferencial para prevenir problemas de contenido duplicado (con parámetros URL, www vs non-www, etc.).',
    });
  } else {
    try {
      const pageUrl = new URL(data.url);
      const canUrl = new URL(data.canonical, data.url);

      const isSelfCanonical = pageUrl.origin + pageUrl.pathname === canUrl.origin + canUrl.pathname;

      if (isSelfCanonical) {
        checks.push({
          id: 'tech-canonical-self',
          category: 'technical',
          name: 'Etiqueta Canonical',
          status: 'good',
          score: 100,
          weight: 15,
          message: 'Etiqueta canonical autorreferencial correctamente configurada.',
          snippet: `<link rel="canonical" href="${data.canonical}" />`,
        });
      } else {
        checks.push({
          id: 'tech-canonical-cross',
          category: 'technical',
          name: 'Etiqueta Canonical',
          status: 'info',
          score: 85,
          weight: 15,
          message: `La etiqueta canonical apunta a otra URL: "${data.canonical}".`,
          recommendation: 'Verifica si esta página transfiere intencionadamente su autoridad a la URL canónica indicada.',
          snippet: `<link rel="canonical" href="${data.canonical}" />`,
        });
      }
    } catch {
      checks.push({
        id: 'tech-canonical-invalid',
        category: 'technical',
        name: 'Etiqueta Canonical',
        status: 'warning',
        score: 40,
        weight: 15,
        message: `La URL de la etiqueta canonical es inválida: "${data.canonical}".`,
      });
    }
  }

  // 4. Tiempo de respuesta (TTFB/Server Response)
  if (data.responseTimeMs > 2500) {
    checks.push({
      id: 'tech-response-time-slow',
      category: 'technical',
      name: 'Tiempo de Respuesta del Servidor (TTFB)',
      status: 'critical',
      score: 40,
      weight: 15,
      message: `Tiempo de respuesta elevado: ${data.responseTimeMs} ms.`,
      recommendation: 'Optimiza la caché de servidor, consulta a base de datos o utiliza una CDN (Cloudflare) para reducir el tiempo por debajo de 600ms.',
    });
  } else if (data.responseTimeMs > 1000) {
    checks.push({
      id: 'tech-response-time-medium',
      category: 'technical',
      name: 'Tiempo de Respuesta del Servidor (TTFB)',
      status: 'warning',
      score: 75,
      weight: 15,
      message: `Tiempo de respuesta moderado: ${data.responseTimeMs} ms.`,
      recommendation: 'Recomendable optimizar para servir la respuesta en menos de 600 ms.',
    });
  } else {
    checks.push({
      id: 'tech-response-time-fast',
      category: 'technical',
      name: 'Tiempo de Respuesta del Servidor (TTFB)',
      status: 'good',
      score: 100,
      weight: 15,
      message: `Excelente tiempo de respuesta: ${data.responseTimeMs} ms.`,
    });
  }

  // 5. Viewport Móvil
  if (!data.viewport) {
    checks.push({
      id: 'tech-viewport-missing',
      category: 'technical',
      name: 'Optimización Mobile-Friendly (Viewport)',
      status: 'critical',
      score: 0,
      weight: 15,
      message: 'Falta la metaetiqueta viewport. El sitio no se adaptará correctamente a dispositivos móviles.',
      recommendation: 'Añade `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.',
    });
  } else {
    checks.push({
      id: 'tech-viewport-ok',
      category: 'technical',
      name: 'Optimización Mobile-Friendly (Viewport)',
      status: 'good',
      score: 100,
      weight: 15,
      message: 'Meta viewport configurado correctamente.',
    });
  }

  // 6. Protocolo HTTPS
  if (data.url.startsWith('http://')) {
    checks.push({
      id: 'tech-https-missing',
      category: 'technical',
      name: 'Seguridad HTTPS',
      status: 'critical',
      score: 0,
      weight: 15,
      message: 'La página se sirve mediante protocolo HTTP no seguro.',
      recommendation: 'Instala un certificado SSL/TLS y fuerza la redirección a HTTPS (HSTS).',
    });
  } else {
    checks.push({
      id: 'tech-https-ok',
      category: 'technical',
      name: 'Seguridad HTTPS',
      status: 'good',
      score: 100,
      weight: 10,
      message: 'Protocolo HTTPS seguro y verificado.',
    });
  }

  return checks;
}
