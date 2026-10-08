export function auditSchema(data) {
    const checks = [];
    if (data.schemas.length === 0) {
        checks.push({
            id: 'schema-missing',
            category: 'schema',
            name: 'Datos Estructurados (Schema.org)',
            status: 'warning',
            score: 30,
            weight: 100,
            message: 'No se han detectado datos estructurados Schema.org en formato JSON-LD.',
            recommendation: 'Implementa marcado estructurado Schema (como Article, FAQPage, Product o Organization) para optar a Rich Snippets en Google.',
        });
    }
    else {
        const detectedTypes = [];
        for (const s of data.schemas) {
            if (s['@type']) {
                if (Array.isArray(s['@type'])) {
                    detectedTypes.push(...s['@type']);
                }
                else {
                    detectedTypes.push(s['@type']);
                }
            }
            else if (s['@graph'] && Array.isArray(s['@graph'])) {
                for (const node of s['@graph']) {
                    if (node['@type']) {
                        if (Array.isArray(node['@type']))
                            detectedTypes.push(...node['@type']);
                        else
                            detectedTypes.push(node['@type']);
                    }
                }
            }
        }
        const uniqueTypes = Array.from(new Set(detectedTypes));
        if (uniqueTypes.length > 0) {
            checks.push({
                id: 'schema-detected',
                category: 'schema',
                name: 'Datos Estructurados (Schema.org)',
                status: 'good',
                score: 100,
                weight: 100,
                message: `Schema.org JSON-LD detectado correctamente. Tipos identificados: ${uniqueTypes.join(', ')}.`,
                snippet: JSON.stringify(data.schemas[0], null, 2),
            });
        }
        else {
            checks.push({
                id: 'schema-empty-type',
                category: 'schema',
                name: 'Datos Estructurados (Schema.org)',
                status: 'warning',
                score: 60,
                weight: 100,
                message: 'Se detectó script JSON-LD pero sin propiedad @type clara.',
                recommendation: 'Revisa la sintaxis del JSON-LD para asegurar que cumple el estándar de Schema.org.',
            });
        }
    }
    return checks;
}
/**
 * Generador automático de marcado Schema listo para usar
 */
export function generateSchemaTemplate(type, params) {
    switch (type) {
        case 'Article':
            return JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: params.title || 'Título del artículo',
                description: params.description || 'Descripción del artículo',
                mainEntityOfPage: {
                    '@type': 'WebPage',
                    '@id': params.url,
                },
                author: {
                    '@type': 'Person',
                    name: 'Willy SEO',
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Willy SEO Consulting',
                },
                datePublished: new Date().toISOString(),
                dateModified: new Date().toISOString(),
            }, null, 2);
        case 'FAQPage':
            return JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: (params.faqs || [
                    {
                        question: '¿Por qué es importante optimizar el SEO On-Page?',
                        answer: 'El SEO On-Page ayuda a los motores de búsqueda a entender el contenido y su relevancia para los usuarios.',
                    },
                ]).map(f => ({
                    '@type': 'Question',
                    name: f.question,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: f.answer,
                    },
                })),
            }, null, 2);
        case 'LocalBusiness':
            return JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'LocalBusiness',
                name: params.title || 'Nombre del Negocio',
                url: params.url,
                telephone: '+34 900 000 000',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: 'Calle Ejemplo 123',
                    addressLocality: 'Madrid',
                    postalCode: '28001',
                    addressCountry: 'ES',
                },
                priceRange: '€€',
            }, null, 2);
        case 'Product':
            return JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: params.title || 'Nombre del Producto',
                description: params.description || 'Descripción del producto',
                offers: {
                    '@type': 'Offer',
                    priceCurrency: 'EUR',
                    price: '49.99',
                    availability: 'https://schema.org/InStock',
                    url: params.url,
                },
            }, null, 2);
        case 'Organization':
        default:
            return JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: params.title || 'Willy SEO',
                url: params.url,
                description: params.description || 'Asesoría y Consultoría SEO Estratégica',
            }, null, 2);
    }
}
