import { TeleCallProduct } from '../types/product';
import { UserNeeds } from '../types/userNeeds';
import {
  Recommendation,
  ComparisonResult,
  ComparisonRow,
  RecommendationEngineResult,
  ObjectiveReason
} from '../types/recommendation';
import { COMBINED_PRODUCTS } from '../catalog/combined';
import { FIBER_PRODUCTS } from '../catalog/fiber';
import { MOBILE_PRODUCTS } from '../catalog/mobile';
import { pricingService } from './pricingService';
import { formatFiberSpeed, formatMobileData, formatTelevisionSummary, formatCurrency } from '../utils/formatting';

export class RecommendationService {
  /**
   * Motor principal de recomendación basado en necesidades objetivas
   */
  public recommendProducts(needs: UserNeeds): RecommendationEngineResult {
    // 1. Determinar el tipo de catálogo base según las necesidades
    const needsFiber = Boolean(needs.fiberRequired || needs.secondResidence || (needs.mobileLines && needs.mobileLines > 1));
    const needsMobile = Boolean((needs.mobileLines && needs.mobileLines > 0) || (needs.mobileDataRequired && needs.mobileDataRequired > 0));
    const needsStreaming = Boolean(needs.netflix || needs.disneyPlus || needs.movistarPlus);

    let candidateBaseProducts: TeleCallProduct[] = [];

    if (needsFiber && needsMobile) {
      // Necesita paquete convergente Fibra + Móvil
      candidateBaseProducts = [...COMBINED_PRODUCTS];
    } else if (needsFiber && !needsMobile) {
      // Solo fibra
      candidateBaseProducts = [...FIBER_PRODUCTS];
    } else if (needsMobile && !needsFiber) {
      // Solo móvil
      candidateBaseProducts = [...MOBILE_PRODUCTS];
    } else {
      // Si no está explícito, evaluar combinados si hay streaming, o todos los activos
      if (needsStreaming) {
        candidateBaseProducts = [...COMBINED_PRODUCTS];
      } else {
        candidateBaseProducts = [...COMBINED_PRODUCTS, ...FIBER_PRODUCTS, ...MOBILE_PRODUCTS];
      }
    }

    // 2. Filtrar por requisitos mínimos técnicos (fibra, datos, televisión)
    const exactMatches: Recommendation[] = [];
    const relaxedMatches: Recommendation[] = [];

    const extraLines = Math.max(0, (needs.mobileLines || 1) - 1);

    for (const base of candidateBaseProducts) {
      const reasons: ObjectiveReason[] = [];
      const highlights: string[] = [];
      const relaxedReqs: string[] = [];

      let matchesRequirements = true;

      // Comprobación de velocidad de fibra
      if (needs.fiberSpeedRequired && base.fiber) {
        if (base.fiber.speedMbps >= needs.fiberSpeedRequired) {
          reasons.push({
            feature: "Velocidad de Fibra",
            description: `Ofrece ${formatFiberSpeed(base.fiber.speedMbps)}, cumpliendo el mínimo requerido de ${formatFiberSpeed(needs.fiberSpeedRequired)}.`,
            matchesNeed: true
          });
        } else {
          matchesRequirements = false;
          relaxedReqs.push(`Velocidad inferior (${formatFiberSpeed(base.fiber.speedMbps)} vs ${formatFiberSpeed(needs.fiberSpeedRequired)} deseada)`);
        }
      }

      // Comprobación de volumen de datos móviles
      if (needs.mobileDataRequired && base.mobile?.dataGB !== undefined) {
        if (base.mobile.dataGB >= needs.mobileDataRequired) {
          reasons.push({
            feature: "Datos Móviles",
            description: `Incluye ${base.mobile.dataGB} GB de datos 5G, cubriendo la necesidad de ${needs.mobileDataRequired} GB.`,
            matchesNeed: true
          });
        } else {
          matchesRequirements = false;
          relaxedReqs.push(`Menos gigas en línea principal (${base.mobile.dataGB} GB vs ${needs.mobileDataRequired} GB solicitados)`);
        }
      }

      // Comprobación de Netflix
      if (needs.netflix) {
        if (base.television?.netflix) {
          reasons.push({
            feature: "Suscripción a Netflix",
            description: "Incluye suscripción a Netflix Estándar integrada en la cuota.",
            matchesNeed: true
          });
          highlights.push("Netflix incluido");
        } else {
          matchesRequirements = false;
          relaxedReqs.push("No incluye Netflix");
        }
      }

      // Comprobación de Disney+
      if (needs.disneyPlus) {
        if (base.television?.disneyPlus) {
          reasons.push({
            feature: "Suscripción a Disney+",
            description: "Incluye suscripción a Disney+ Estándar integrada.",
            matchesNeed: true
          });
          highlights.push("Disney+ incluido");
        } else {
          matchesRequirements = false;
          relaxedReqs.push("No incluye Disney+");
        }
      }

      // Comprobación de Movistar Plus+
      if (needs.movistarPlus) {
        if (base.television?.movistarPlus) {
          reasons.push({
            feature: "Movistar Plus+",
            description: "Plataforma de televisión Movistar Plus+ incluida con cine, series y eventos deportivos.",
            matchesNeed: true
          });
          highlights.push("Movistar Plus+ incluido");
        } else {
          matchesRequirements = false;
          relaxedReqs.push("No incluye Movistar Plus+");
        }
      }

      // Calcular precio de la configuración (con líneas adicionales si aplica)
      const secondResidenceSpeed = needs.secondResidence ? 300 : undefined;
      const pricing = pricingService.calculatePrice(
        base,
        extraLines,
        40, // línea adicional estándar
        secondResidenceSpeed
      );

      // Comprobación de Presupuesto
      const fitsBudget = pricingService.isWithinBudget(pricing.totalMonthly, needs.budget);
      if (needs.budget) {
        if (fitsBudget) {
          reasons.push({
            feature: "Ajuste a Presupuesto",
            description: `Precio total de ${pricing.totalMonthly} €/mes dentro del límite de ${needs.budget} €/mes.`,
            matchesNeed: true
          });
        } else {
          matchesRequirements = false;
          relaxedReqs.push(`Supera el presupuesto fijado (${pricing.totalMonthly} €/mes vs ${needs.budget} €/mes)`);
        }
      }

      // Si es teletrabajo o gaming
      if (needs.teleworking && base.fiber) {
        reasons.push({
          feature: "Teletrabajo",
          description: `Conexión simétrica de ${base.fiber.speedMbps} Mbps óptima para videollamadas y subida de archivos pesados.`,
          matchesNeed: true
        });
      }

      if (needs.gaming && base.fiber && base.fiber.speedMbps >= 600) {
        reasons.push({
          feature: "Gaming",
          description: "Baja latencia y ancho de banda amplio para descargas de parches y juego online sin interrupciones.",
          matchesNeed: true
        });
      }

      const rec: Recommendation = {
        id: `rec-${base.id}`,
        primaryProduct: base,
        additionalProducts: pricing.additionalLines.map(a => a.product),
        pricing,
        objectiveReasons: reasons,
        highlights,
        exactMatch: matchesRequirements,
        relaxedRequirements: relaxedReqs.length > 0 ? relaxedReqs : undefined
      };

      if (matchesRequirements) {
        exactMatches.push(rec);
      } else {
        relaxedMatches.push(rec);
      }
    }

    // 3. Ordenar por precio ascendente de manera objetiva (sin rankings arbitrarios)
    exactMatches.sort((a, b) => a.pricing.totalMonthly - b.pricing.totalMonthly);
    relaxedMatches.sort((a, b) => a.pricing.totalMonthly - b.pricing.totalMonthly);

    let chosenRecommendations: Recommendation[] = [];
    let budgetStatus: RecommendationEngineResult['budgetStatus'] = "no_budget_specified";
    let message = "";

    if (needs.budget) {
      budgetStatus = exactMatches.length > 0 ? "within_budget" : "budget_exceeded";
    }

    if (exactMatches.length > 0) {
      chosenRecommendations = exactMatches;
      message = `He encontrado ${exactMatches.length} opción(es) que cumplen todos los requisitos indicados.`;
    } else if (needs.budget && relaxedMatches.length > 0) {
      chosenRecommendations = relaxedMatches.slice(0, 3);
      message = `Con un límite de ${needs.budget} € no encuentro una combinación que cumpla todos los requisitos indicados. Te muestro las alternativas más cercanas indicando qué condición varía.`;
    } else if (relaxedMatches.length > 0) {
      chosenRecommendations = relaxedMatches.slice(0, 3);
      message = `No hay una tarifa única que cumpla el 100% de los requisitos exactos de forma nativa. Te presento las opciones más próximas.`;
    } else {
      message = `No se han encontrado productos compatibles en el catálogo de referencia.`;
    }

    // 4. Generar tabla de comparación si hay 2 o más opciones
    let comparison: ComparisonResult | undefined;
    if (chosenRecommendations.length > 1) {
      comparison = this.compareProducts(chosenRecommendations);
    }

    return {
      userNeeds: needs,
      recommendations: chosenRecommendations,
      comparison,
      budgetStatus,
      message
    };
  }

  /**
   * Comparador objetivo de opciones sin términos comerciales agresivos ni ganadores artificiales
   */
  public compareProducts(recommendations: Recommendation[]): ComparisonResult {
    const headers = ["Opción", "Fibra", "Móvil", "TV", "Servicios", "Precio"];

    // Encontrar min precio y max datos
    let minPrice = Infinity;
    let maxData = -1;

    for (const rec of recommendations) {
      if (rec.pricing.totalMonthly < minPrice) minPrice = rec.pricing.totalMonthly;
      const totalGB = (rec.primaryProduct.mobile?.dataGB || 0) +
        rec.pricing.additionalLines.reduce((acc, l) => acc + ((l.product.mobile?.dataGB || 0) * l.quantity), 0);
      if (totalGB > maxData) maxData = totalGB;
    }

    const rows: ComparisonRow[] = recommendations.map(rec => {
      const p = rec.primaryProduct;
      const tv = formatTelevisionSummary(p);
      const totalGB = (p.mobile?.dataGB || 0) +
        rec.pricing.additionalLines.reduce((acc, l) => acc + ((l.product.mobile?.dataGB || 0) * l.quantity), 0);

      const diffs: string[] = [];
      if (rec.pricing.totalMonthly === minPrice) diffs.push("La opción de menor precio");
      if (totalGB === maxData && totalGB > 0) diffs.push("La opción con más datos móviles");
      if (p.television?.netflix) diffs.push("Incluye Netflix");
      if (p.television?.disneyPlus) diffs.push("Incluye Disney+");
      if (p.fiber?.speedMbps === 1000) diffs.push("Máxima velocidad de fibra (1 Gb)");

      return {
        optionName: p.name,
        fiberSpeed: formatFiberSpeed(p.fiber?.speedMbps),
        mobileData: rec.pricing.additionalLines.length > 0
          ? `${p.mobile?.dataGB || 0} GB principal + ${rec.pricing.additionalLines.map(l => `${l.quantity}x${l.product.mobile?.dataGB}GB`).join(', ')}`
          : formatMobileData(p.mobile?.dataGB),
        television: tv,
        services: p.conditions?.landlineIncluded ? "Fijo + Router + Sin permanencia" : "Sin permanencia",
        monthlyPrice: formatCurrency(rec.pricing.totalMonthly),
        keyDifferentiator: diffs.join(" | ") || "Opción equilibrada"
      };
    });

    const summaryDifferences: string[] = [];
    if (recommendations.some(r => r.primaryProduct.television?.netflix)) {
      summaryDifferences.push("Opciones con plataforma de streaming Netflix incluida frente a opciones solo con Movistar Plus+.");
    }
    if (recommendations.some(r => (r.primaryProduct.fiber?.speedMbps || 0) >= 1000)) {
      summaryDifferences.push("Diferencia de velocidad entre 600 Mbps y 1 Gbps para hogares de alta demanda.");
    }
    summaryDifferences.push("Diferencia de capacidad de datos móviles en la línea principal.");

    return {
      headers,
      rows,
      summaryDifferences
    };
  }
}

export const recommendationService = new RecommendationService();
