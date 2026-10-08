import { ExtractedPageData, PillarScore, QuickWin, SeoAuditReport, SerpPreviewData } from './types.js';
import { auditOnPage, estimateTitlePixelWidth } from './rules/onpage.js';
import { auditTechnical } from './rules/technical.js';
import { auditSchema, generateSchemaTemplate } from './rules/schema.js';
import { auditSemantics } from './rules/semantics.js';

export class Auditor {
  /**
   * Ejecuta la auditoría SEO completa sobre los datos extraídos
   */
  static runAudit(data: ExtractedPageData, targetKeyword?: string): SeoAuditReport {
    const onpageChecks = auditOnPage(data, targetKeyword);
    const techChecks = auditTechnical(data);
    const schemaChecks = auditSchema(data);
    const semChecks = auditSemantics(data, targetKeyword);

    // Calcular score por pilar
    const techScore = this.calculatePillarScore('Técnico e Indexabilidad', techChecks, 30);
    const onpageScore = this.calculatePillarScore('SEO On-Page & Metas', onpageChecks, 35);
    const semScore = this.calculatePillarScore('Contenido & Semántica', semChecks, 25);
    const schemaScore = this.calculatePillarScore('Schema & Datos Estructurados', schemaChecks, 10);

    // Puntuación Global Ponderada
    const overallScore = Math.round(
      (techScore.score * 0.3) +
      (onpageScore.score * 0.35) +
      (semScore.score * 0.25) +
      (schemaScore.score * 0.1)
    );

    let overallStatus: SeoAuditReport['overallStatus'] = 'Óptimo';
    if (overallScore < 55 || techChecks.some(c => c.id === 'tech-robots-noindex' || c.status === 'critical')) {
      overallStatus = 'Crítico';
    } else if (overallScore < 80) {
      overallStatus = 'Mejorable';
    }

    // Generar Quick Wins (ordenados por impacto/facilidad)
    const quickWins = this.generateQuickWins(data, targetKeyword, [...techChecks, ...onpageChecks, ...semChecks, ...schemaChecks]);

    // Generar SERP Preview
    const serpPreview = this.generateSerpPreview(data);

    // Generar soluciones optimizadas
    const proposedSolutions = this.generateProposedSolutions(data, targetKeyword);

    // Generar Plan de Acción de Willy SEO
    const actionPlan = this.generateActionPlan(quickWins, overallScore, overallStatus);

    // Resumen ejecutivo
    const summary = this.generateExecutiveSummary(overallScore, overallStatus, data, targetKeyword, quickWins);

    return {
      brand: 'Willy SEO',
      url: data.url,
      targetKeyword,
      analyzedAt: new Date().toISOString(),
      overallScore,
      overallStatus,
      summary,
      quickWins,
      pillars: {
        technical: techScore,
        onpage: onpageScore,
        semantics: semScore,
        schema: schemaScore,
      },
      serpPreview,
      proposedSolutions,
      actionPlan,
    };
  }

  private static calculatePillarScore(name: string, checks: any[], weight: number): PillarScore {
    let totalScore = 0;
    let totalWeight = 0;

    for (const c of checks) {
      totalScore += c.score * c.weight;
      totalWeight += c.weight;
    }

    const avgScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 100;
    let status: PillarScore['status'] = 'good';
    if (avgScore < 50) status = 'critical';
    else if (avgScore < 80) status = 'warning';

    return {
      name,
      score: avgScore,
      weight,
      status,
      checks,
    };
  }

  private static generateQuickWins(data: ExtractedPageData, keyword?: string, allChecks?: any[]): QuickWin[] {
    const quickWins: QuickWin[] = [];

    // 1. Falta o problema crítico en Meta Robots
    if (data.metaRobots?.includes('noindex')) {
      quickWins.push({
        title: 'Eliminar directiva "noindex"',
        impact: 'high',
        effort: 'low',
        description: 'La página tiene etiqueta noindex, lo que impide al 100% que aparezca en Google.',
        solutionCode: '<meta name="robots" content="index, follow">',
      });
    }

    // 2. Falta de H1 o H1 no optimizado
    if (data.h1.length === 0) {
      const suggestedH1 = keyword ? `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}: Guía y Claves Principales` : 'Título Principal de la Página';
      quickWins.push({
        title: 'Añadir encabezado <h1> principal',
        impact: 'high',
        effort: 'low',
        description: 'No se detectó ningún <h1> en el contenido.',
        solutionCode: `<h1>${suggestedH1}</h1>`,
      });
    }

    // 3. Title tag ausente o mal dimensionado
    if (!data.title || data.title.length < 30 || data.title.length > 65) {
      const baseKw = keyword || data.h1[0] || 'Servicio';
      const cleanTitle = `${baseKw.charAt(0).toUpperCase() + baseKw.slice(1)} | Soluciones y Consejos de Willy SEO`;
      quickWins.push({
        title: 'Optimizar longitud y gancho del <title>',
        impact: 'high',
        effort: 'low',
        description: !data.title
          ? 'Falta la etiqueta <title> en el documento HTML.'
          : `El título actual tiene ${data.title.length} caracteres y no aprovecha el espacio SERP.`,
        solutionCode: `<title>${cleanTitle}</title>`,
      });
    }

    // 4. Meta Description ausente
    if (!data.metaDescription) {
      const baseKw = keyword || data.h1[0] || 'nuestros servicios';
      const suggestedDesc = `Descubre todo sobre ${baseKw}. Análisis profesional, consejos prácticos y optimización garantizada con Willy SEO. ¡Haz clic aquí!`;
      quickWins.push({
        title: 'Añadir Meta Description con llamada a la acción',
        impact: 'medium',
        effort: 'low',
        description: 'Permitirá controlar el fragmento visible en Google y aumentar el CTR de los clics orgánicos.',
        solutionCode: `<meta name="description" content="${suggestedDesc}">`,
      });
    }

    // 5. Falta de marcado Schema.org
    if (data.schemas.length === 0) {
      quickWins.push({
        title: 'Implementar Schema.org JSON-LD',
        impact: 'medium',
        effort: 'medium',
        description: 'Añade datos estructurados para facilitar la comprensión a Google y optar a resultados enriquecidos.',
        solutionCode: generateSchemaTemplate('Article', {
          url: data.url,
          title: data.title || data.h1[0] || 'Artículo de Willy SEO',
          description: data.metaDescription || 'Análisis y optimización SEO',
        }),
      });
    }

    // 6. Imágenes sin texto alternativo
    const missingAlt = data.images.filter(i => !i.hasAlt);
    if (missingAlt.length > 0) {
      quickWins.push({
        title: `Añadir atributos alt a ${missingAlt.length} imágenes`,
        impact: 'medium',
        effort: 'low',
        description: 'Mejora la accesibilidad web y el tráfico desde Google Imágenes.',
      });
    }

    return quickWins.slice(0, 4);
  }

  private static generateSerpPreview(data: ExtractedPageData): SerpPreviewData {
    const rawTitle = data.title || 'Sin Título Definido';
    const rawDesc = data.metaDescription || 'No se ha configurado meta description para esta página en los resultados de búsqueda.';
    const pixelWidth = estimateTitlePixelWidth(rawTitle);

    return {
      desktop: {
        title: pixelWidth > 580 ? rawTitle.substring(0, 58) + '...' : rawTitle,
        pixelWidth,
        isTruncated: pixelWidth > 580,
        url: data.url,
        description: rawDesc.length > 158 ? rawDesc.substring(0, 155) + '...' : rawDesc,
      },
      mobile: {
        title: pixelWidth > 520 ? rawTitle.substring(0, 50) + '...' : rawTitle,
        pixelWidth,
        isTruncated: pixelWidth > 520,
        url: data.url,
        description: rawDesc.length > 120 ? rawDesc.substring(0, 118) + '...' : rawDesc,
      },
    };
  }

  private static generateProposedSolutions(data: ExtractedPageData, keyword?: string) {
    const kw = keyword || data.h1[0] || 'Estrategia';
    const capitalizedKw = kw.charAt(0).toUpperCase() + kw.slice(1);

    const optimizedTitle = `${capitalizedKw} — Guía Completa y Consejos Clave | Willy SEO`;
    const optimizedMetaDescription = `¿Buscas optimizar ${kw}? Descubre la guía definitiva paso a paso, errores comunes y cómo mejorar tus resultados orgánicos hoy mismo.`;

    const recommendedHeadings = [
      `<h1>${capitalizedKw}: Todo lo que Necesitas Saber</h1>`,
      `<h2>1. ¿Qué es y por qué es importante?</h2>`,
      `<h2>2. Factores Clave de Optimización</h2>`,
      `<h2>3. Errores Frecuentes y Cómo Evitarlos</h2>`,
      `<h2>4. Preguntas Frecuentes (FAQ)</h2>`,
    ];

    const schemaJsonLd = generateSchemaTemplate('Article', {
      url: data.url,
      title: data.title || optimizedTitle,
      description: data.metaDescription || optimizedMetaDescription,
    });

    return {
      optimizedTitle,
      optimizedMetaDescription,
      recommendedHeadings,
      schemaJsonLd,
    };
  }

  private static generateActionPlan(
    quickWins: QuickWin[],
    score: number,
    status: string
  ): SeoAuditReport['actionPlan'] {
    const plan: SeoAuditReport['actionPlan'] = [];
    let stepIndex = 1;

    for (const qw of quickWins) {
      plan.push({
        step: stepIndex++,
        priority: qw.impact === 'high' ? 'Alta' : 'Media',
        task: qw.title,
        details: qw.description,
      });
    }

    plan.push({
      step: stepIndex++,
      priority: 'Media',
      task: 'Monitoreo en Google Search Console',
      details: 'Solicita la reindexación de la URL una vez aplicadas las correcciones y revisa clics e impresiones a los 7-14 días.',
    });

    return plan;
  }

  private static generateExecutiveSummary(
    score: number,
    status: string,
    data: ExtractedPageData,
    keyword?: string,
    quickWins: QuickWin[] = []
  ): string {
    const kwText = keyword ? ` enfocada en la palabra clave "${keyword}"` : '';
    return `Auditoría completada para ${data.url}${kwText}. Puntuación global: ${score}/100 (${status}). Se han detectado ${quickWins.length} acciones prioritarias inmediatas (Quick Wins) para maximizar visibilidad y CTR orgánico.`;
  }
}
