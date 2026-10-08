/**
 * Estimación aproximada de ancho de píxeles para Google Desktop (fuente Arial 20px)
 */
export function estimateTitlePixelWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (/[ijlI1\.,\s\':;!]/.test(char))
            width += 4.5;
        else if (/[mwWM@#%&]/.test(char))
            width += 13.5;
        else if (/[A-Z]/.test(char))
            width += 10.5;
        else
            width += 8.5;
    }
    return Math.round(width);
}
export function auditOnPage(data, keyword) {
    const checks = [];
    const cleanKw = keyword ? keyword.toLowerCase().trim() : undefined;
    // 1. Title Tag
    if (!data.title) {
        checks.push({
            id: 'onpage-title-missing',
            category: 'onpage',
            name: 'Etiqueta <title>',
            status: 'critical',
            score: 0,
            weight: 25,
            message: 'Falta la etiqueta <title> en la página.',
            recommendation: 'Añade una etiqueta <title> única, descriptiva y optimizada para la palabra clave principal.',
        });
    }
    else {
        const titleLen = data.title.length;
        const pxWidth = estimateTitlePixelWidth(data.title);
        if (titleLen < 30) {
            checks.push({
                id: 'onpage-title-short',
                category: 'onpage',
                name: 'Longitud del <title>',
                status: 'warning',
                score: 60,
                weight: 15,
                message: `El título es demasiado corto (${titleLen} caracteres / ~${pxWidth}px).`,
                recommendation: 'Aprovecha el espacio (50-60 caracteres) para incluir propuesta de valor o marca.',
                snippet: `<title>${data.title}</title>`,
            });
        }
        else if (pxWidth > 580 || titleLen > 65) {
            checks.push({
                id: 'onpage-title-long',
                category: 'onpage',
                name: 'Longitud del <title>',
                status: 'warning',
                score: 70,
                weight: 15,
                message: `El título es demasiado largo (${titleLen} caracteres / ~${pxWidth}px) y podría truncarse en Google.`,
                recommendation: 'Reduce el título a menos de 580px (~60 caracteres) para evitar que Google corte el mensaje.',
                snippet: `<title>${data.title}</title>`,
            });
        }
        else {
            checks.push({
                id: 'onpage-title-optimal',
                category: 'onpage',
                name: 'Longitud del <title>',
                status: 'good',
                score: 100,
                weight: 15,
                message: `Título con longitud óptima (${titleLen} caracteres / ~${pxWidth}px).`,
                snippet: `<title>${data.title}</title>`,
            });
        }
        if (cleanKw) {
            const titleLower = data.title.toLowerCase();
            if (titleLower.includes(cleanKw)) {
                const isAtStart = titleLower.indexOf(cleanKw) < 20;
                checks.push({
                    id: 'onpage-title-kw',
                    category: 'onpage',
                    name: 'Keyword en <title>',
                    status: 'good',
                    score: 100,
                    weight: 10,
                    message: `La keyword objetivo "${keyword}" aparece en el título${isAtStart ? ' al principio (excelente para CTR y relevancia).' : '.'}`,
                });
            }
            else {
                checks.push({
                    id: 'onpage-title-kw-missing',
                    category: 'onpage',
                    name: 'Keyword en <title>',
                    status: 'warning',
                    score: 40,
                    weight: 10,
                    message: `La palabra clave "${keyword}" no se encuentra en el <title>.`,
                    recommendation: `Incluye "${keyword}" preferiblemente al inicio del título.`,
                });
            }
        }
    }
    // 2. Meta Description
    if (!data.metaDescription) {
        checks.push({
            id: 'onpage-metadesc-missing',
            category: 'onpage',
            name: 'Meta Description',
            status: 'warning',
            score: 30,
            weight: 15,
            message: 'No se ha definido meta description.',
            recommendation: 'Añade una meta description de 130-155 caracteres con gancho comercial y llamada a la acción (CTA).',
        });
    }
    else {
        const descLen = data.metaDescription.length;
        if (descLen < 70) {
            checks.push({
                id: 'onpage-metadesc-short',
                category: 'onpage',
                name: 'Meta Description',
                status: 'warning',
                score: 65,
                weight: 10,
                message: `La meta description es muy corta (${descLen} caracteres).`,
                recommendation: 'Amplía la descripción hasta 130-155 caracteres para mejorar el CTR en la SERP.',
                snippet: data.metaDescription,
            });
        }
        else if (descLen > 165) {
            checks.push({
                id: 'onpage-metadesc-long',
                category: 'onpage',
                name: 'Meta Description',
                status: 'warning',
                score: 75,
                weight: 10,
                message: `La meta description es extensa (${descLen} caracteres) y podría ser truncada en dispositivos móviles.`,
                recommendation: 'Mantén la descripción entre 130 y 155 caracteres con el mensaje clave al principio.',
                snippet: data.metaDescription,
            });
        }
        else {
            checks.push({
                id: 'onpage-metadesc-optimal',
                category: 'onpage',
                name: 'Meta Description',
                status: 'good',
                score: 100,
                weight: 15,
                message: `Meta description con extensión óptima (${descLen} caracteres).`,
                snippet: data.metaDescription,
            });
        }
    }
    // 3. Encabezados H1
    if (data.h1.length === 0) {
        checks.push({
            id: 'onpage-h1-missing',
            category: 'onpage',
            name: 'Encabezado principal (H1)',
            status: 'critical',
            score: 0,
            weight: 20,
            message: 'No existe ningún encabezado <h1> en la página.',
            recommendation: 'Añade exactamente un encabezado <h1> que describa el tema principal de la URL.',
        });
    }
    else if (data.h1.length > 1) {
        checks.push({
            id: 'onpage-h1-multiple',
            category: 'onpage',
            name: 'Múltiples H1 detectados',
            status: 'warning',
            score: 60,
            weight: 10,
            message: `Se han detectado ${data.h1.length} etiquetas <h1>.`,
            recommendation: 'Es recomendable mantener un único <h1> por página para una jerarquía semántica clara.',
            snippet: data.h1.map(h => `<h1>${h}</h1>`).join('\n'),
        });
    }
    else {
        checks.push({
            id: 'onpage-h1-optimal',
            category: 'onpage',
            name: 'Encabezado H1',
            status: 'good',
            score: 100,
            weight: 20,
            message: `H1 único detectado: "${data.h1[0]}"`,
            snippet: `<h1>${data.h1[0]}</h1>`,
        });
    }
    // 4. Jerarquía H2/H3
    if (data.h2.length === 0 && data.wordCount > 300) {
        checks.push({
            id: 'onpage-h2-missing',
            category: 'onpage',
            name: 'Estructura de subtítulos (H2)',
            status: 'warning',
            score: 50,
            weight: 10,
            message: 'No se han detectado encabezados <h2> a pesar de tener contenido extenso.',
            recommendation: 'Estructura el contenido con secciones <h2> y <h3> para mejorar la legibilidad y escaneabilidad de Google.',
        });
    }
    else if (data.h2.length > 0) {
        checks.push({
            id: 'onpage-h2-good',
            category: 'onpage',
            name: 'Estructura H2/H3',
            status: 'good',
            score: 100,
            weight: 10,
            message: `Estructura semántica rica: ${data.h2.length} H2 y ${data.h3.length} H3.`,
        });
    }
    // 5. Imágenes y Atributos Alt
    if (data.images.length > 0) {
        const missingAlt = data.images.filter(img => !img.hasAlt);
        if (missingAlt.length > 0) {
            const percentageMissing = Math.round((missingAlt.length / data.images.length) * 100);
            checks.push({
                id: 'onpage-images-missing-alt',
                category: 'onpage',
                name: 'Texto alternativo (Alt) en imágenes',
                status: percentageMissing > 50 ? 'warning' : 'info',
                score: Math.max(0, 100 - percentageMissing),
                weight: 10,
                message: `${missingAlt.length} de ${data.images.length} imágenes no tienen atributo alt descriptivo (${percentageMissing}% sin alt).`,
                recommendation: 'Añade textos alternativos descriptivos en todas las imágenes clave para accesibilidad y posicionamiento en Google Imágenes.',
            });
        }
        else {
            checks.push({
                id: 'onpage-images-alt-good',
                category: 'onpage',
                name: 'Atributos Alt en imágenes',
                status: 'good',
                score: 100,
                weight: 10,
                message: `Todas las imágenes (${data.images.length}) cuentan con atributo alt.`,
            });
        }
    }
    return checks;
}
