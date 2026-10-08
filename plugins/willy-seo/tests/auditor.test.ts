import test from 'node:test';
import assert from 'node:assert/strict';
import { Extractor } from '../src/extractor.js';
import { Auditor } from '../src/auditor.js';
import { estimateTitlePixelWidth } from '../src/rules/onpage.js';
import { generateSchemaTemplate } from '../src/rules/schema.js';

test('Estimación de ancho de píxeles del Title', () => {
  const shortTitle = 'SEO Tips';
  const longTitle = 'Esta es una guía de SEO extraordinariamente larga diseñada para exceder con creces el límite de píxeles de Google SERP';
  
  assert.ok(estimateTitlePixelWidth(shortTitle) < 300);
  assert.ok(estimateTitlePixelWidth(longTitle) > 580);
});

test('Auditoría de página con fallos críticos (noindex y sin H1)', () => {
  const badHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="robots" content="noindex, nofollow">
      </head>
      <body>
        <p>Texto muy corto sin estructura.</p>
      </body>
    </html>
  `;

  const extracted = Extractor.parseHtml(badHtml, 'https://ejemplo.com/pagina-mala', 200, 150, {});
  const report = Auditor.runAudit(extracted, 'consultoria seo');

  assert.equal(report.overallStatus, 'Crítico');
  assert.ok(report.overallScore < 60);
  
  // Debe detectar fallo crítico de noindex y falta de H1
  const hasNoindexCheck = report.pillars.technical.checks.some(c => c.id === 'tech-robots-noindex');
  const hasMissingH1 = report.pillars.onpage.checks.some(c => c.id === 'onpage-h1-missing');
  const hasThinContent = report.pillars.semantics.checks.some(c => c.id === 'sem-thin-content');

  assert.ok(hasNoindexCheck, 'Debe detectar la directiva noindex');
  assert.ok(hasMissingH1, 'Debe detectar la ausencia de H1');
  assert.ok(hasThinContent, 'Debe detectar Thin Content');
});

test('Auditoría de página optimizada', () => {
  const goodHtml = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <title>Consultoría SEO Profesional | Posiciona tu Negocio con Willy SEO</title>
        <meta name="description" content="Especialistas en consultoría SEO estratégica. Aumenta tu tráfico orgánico y ventas con auditorías técnicas y optimización On-Page personalizada.">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="canonical" href="https://ejemplo.com/consultoria-seo" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Consultoría SEO Profesional"
          }
        </script>
      </head>
      <body>
        <h1>Consultoría SEO Profesional y Estratégica</h1>
        <p>En este artículo analizamos cómo una consultoría SEO profesional puede transformar la visibilidad de tu marca en Google.</p>
        <h2>¿Qué incluye una auditoría SEO?</h2>
        <p>Revisión exhaustiva de indexabilidad, rastreo, rendimiento Core Web Vitals, arquitectura web y semántica de contenidos.</p>
        <img src="/img/seo.jpg" alt="Gráfico de crecimiento SEO" />
        <a href="/servicios">Ver servicios</a>
      </body>
    </html>
  `;

  const extracted = Extractor.parseHtml(goodHtml, 'https://ejemplo.com/consultoria-seo', 200, 80, {});
  const report = Auditor.runAudit(extracted, 'consultoría seo');

  assert.equal(report.overallStatus, 'Óptimo');
  assert.ok(report.overallScore >= 80);
  assert.equal(report.pillars.technical.status, 'good');
  assert.equal(report.pillars.schema.status, 'good');
});

test('Generador de Schema JSON-LD', () => {
  const faqSchema = generateSchemaTemplate('FAQPage', {
    url: 'https://ejemplo.com/faq',
    faqs: [
      { question: '¿Cuánto tarda el SEO?', answer: 'Entre 3 y 6 meses para ver tracción sólida.' }
    ]
  });

  const parsed = JSON.parse(faqSchema);
  assert.equal(parsed['@type'], 'FAQPage');
  assert.equal(parsed.mainEntity[0].name, '¿Cuánto tarda el SEO?');
});
