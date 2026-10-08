import { UserNeeds } from '../types/userNeeds';
import { intentClassifier } from './intent';
import { recommendationService } from '../services/recommendationService';
import { roamingService } from '../services/roamingService';
import { coverageService } from '../services/coverageService';
import { catalogService } from '../services/catalogService';
import { RecommendationEngineResult } from '../types/recommendation';
import { formatComparisonMarkdownTable, formatPriceBreakdownText } from '../utils/formatting';
import { analyticsService } from '../services/analyticsService';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  recommendationResult?: RecommendationEngineResult;
  roamingResult?: any;
  coverageResult?: any;
  quickActions?: string[];
  timestamp: string;
}

export class ConversationManager {
  private currentNeeds: UserNeeds = {};
  private history: ChatMessage[] = [];

  public handleUserMessage(query: string): ChatMessage {
    analyticsService.logEvent('search', { query });

    // 1. Clasificar intenciones y extraer necesidades
    const { intents, extractedNeeds } = intentClassifier.parseQuery(query);
    analyticsService.logEvent('intent_detected', {
      query,
      intents,
      filters: extractedNeeds
    });

    // Merge needs into state
    this.currentNeeds = { ...this.currentNeeds, ...extractedNeeds };

    let responseText = "";
    let recResult: RecommendationEngineResult | undefined;
    let roamingRes: any | undefined;
    let coverageRes: any | undefined;
    let quickActions: string[] = [];

    // CASO 1: Consulta de Roaming
    if (intents.includes('roaming') || this.currentNeeds.country) {
      const country = this.currentNeeds.country || "el extranjero";
      roamingRes = roamingService.queryCountry(country);

      if (roamingRes.isEU) {
        responseText = `Para viajar a **${roamingRes.country}** (${roamingRes.zoneName}):\n\n` +
          `• **Llamadas:** ${roamingRes.pricing.calls}\n` +
          `• **Datos:** ${roamingRes.pricing.data}\n` +
          `• **SMS:** ${roamingRes.pricing.sms}\n\n` +
          `${roamingRes.advice}\n\n` +
          `*Nota:* ${roamingRes.disclaimer}`;
      } else {
        responseText = `Para viajar a **${roamingRes.country}** (${roamingRes.zoneName}):\n\n` +
          `• **Llamadas salientes:** ${roamingRes.pricing.calls}\n` +
          `• **Datos:** ${roamingRes.pricing.data}\n` +
          `• **SMS:** ${roamingRes.pricing.sms}\n\n` +
          `⚠️ **Recomendación:** ${roamingRes.advice}\n\n` +
          `*Nota de transparencia:* ${roamingRes.disclaimer}`;
      }

      quickActions = ["Ver tarifas de fibra", "Ver tarifas móviles", "Ver combinados"];
    }

    // CASO 2: Consulta de Cobertura
    else if (intents.includes('coverage')) {
      coverageRes = coverageService.getCoverageGuidance(query.replace(/.*cobertura (en|para)?/i, '').trim());
      responseText = `${coverageRes.message}\n\n` +
        `**Proceso habitual:**\n` +
        coverageRes.processGuidance.map((g: string) => `• ${g}`).join('\n') +
        `\n\nPuedes verificar tu dirección en el enlace oficial de referencia: [Comprobar Cobertura O2](${coverageRes.officialCheckerUrl}).`;

      quickActions = ["Ver tarifas de fibra", "¿Qué velocidad necesito para teletrabajo?"];
    }

    // CASO 3: Pregunta directa de precio simple (Ej: "¿Cuánto cuesta la fibra de 1 Gb?")
    else if (query.toLowerCase().includes('cuánto cuesta la fibra de 1 gb') || query.toLowerCase().includes('precio de la fibra de 1 gb') || query.toLowerCase().includes('cuanto cuesta la fibra de 1 gb')) {
      const p = catalogService.getProductById('fiber-1000');
      responseText = `Como referencia, la fibra de 1 Gb está en ${p?.price?.monthly} €/mes. Incluye fibra simétrica de 1 Gbps y línea fija con llamadas nacionales ilimitadas y router incluido. El precio debe verificarse en la información comercial actual antes de contratar.`;
      quickActions = ["Ver combinados con 1 Gb", "Comparar con 600 Mb", "Añadir líneas móviles"];
    }

    // CASO 4: Contratación
    else if (query.toLowerCase().includes('contratar') || query.toLowerCase().includes('quiero esta tarifa') || query.toLowerCase().includes('darme de alta')) {
      responseText = `TeleCall es una aplicación de demostración técnica independiente. No realizamos contrataciones reales ni solicitamos datos personales o bancarios.\n\n` +
        `Para contratar cualquiera de las tarifas mostradas con las condiciones comerciales oficiales vigentes, puedes dirigirte al portal oficial de referencia:\n` +
        `🔗 [Portal Oficial O2 España](https://o2online.es/)\n\n` +
        `¿Deseas simular alguna otra configuración de líneas o servicios?`;
      analyticsService.logEvent('contract_click', { query });
      quickActions = ["Nueva consulta", "Ver catálogo completo", "Modificar líneas"];
    }

    // CASO 5: Diálogo guiado / Preguntas mínimas
    // Si solo pide "fibra" sin especificar si quiere móvil
    else if (query.toLowerCase().trim() === 'quiero internet' || query.toLowerCase().trim() === 'quiero fibra' || query.toLowerCase().trim() === 'internet para casa') {
      responseText = "¿La quieres solo con fibra o también necesitas incluir líneas móviles?";
      quickActions = ["Solo fibra", "Fibra y móvil", "Fibra con televisión"];
    }

    // Si responde "fibra y móvil" sin número de líneas
    else if (query.toLowerCase().trim() === 'fibra y móvil' || query.toLowerCase().trim() === 'fibra y movil') {
      responseText = "¿Cuántas líneas móviles necesitas en total?";
      quickActions = ["1 línea", "2 líneas", "3 líneas", "4 líneas"];
    }

    // Si responde solo "dos" o número de líneas tras preguntar líneas
    else if (/^(una|dos|tres|cuatro|1|2|3|4)(\s+líneas|\s+lineas|\s+móviles|\s+moviles)?$/i.test(query.trim()) && !this.currentNeeds.mobileDataRequired) {
      const num = intentClassifier['parseNumberWord'](query.trim()) || 1;
      this.currentNeeds.mobileLines = num;
      responseText = "¿Aproximadamente cuántos datos consume cada una al mes o buscas servicios de televisión como Netflix o Movistar Plus+?";
      quickActions = ["Uso estándar (35-60 GB)", "Muchos gigas (100+ GB)", "Con Netflix incluido", "Con Disney+ y Netflix"];
    }

    // CASO 6: Motor de Recomendación y Comparador
    else {
      recResult = recommendationService.recommendProducts(this.currentNeeds);
      analyticsService.logEvent('recommendation', {
        filters: this.currentNeeds,
        recommendedIds: recResult.recommendations.map(r => r.primaryProduct.id)
      });

      const recs = recResult.recommendations;

      if (recs.length === 0) {
        responseText = recResult.message;
      } else {
        const intro = recResult.message;
        const detailsList: string[] = [];

        recs.forEach((rec, idx) => {
          const p = rec.primaryProduct;
          const reasons = rec.objectiveReasons.map(r => `  - ${r.feature}: ${r.description}`).join('\n');
          const breakdown = formatPriceBreakdownText(rec.pricing);

          detailsList.push(
            `### Opción ${idx + 1}: ${p.name} — ${rec.pricing.totalMonthly} €/mes\n` +
            `${p.description || ''}\n\n` +
            `**Desglose de coste:**\n${breakdown}\n\n` +
            (reasons ? `**Razones objetivas:**\n${reasons}\n` : '') +
            (rec.relaxedRequirements ? `⚠️ *Aviso de ajuste:* ${rec.relaxedRequirements.join(', ')}\n` : '')
          );
        });

        let comparisonText = "";
        if (recResult.comparison) {
          comparisonText = `\n\n### Comparativa de Opciones\n\n` +
            formatComparisonMarkdownTable(recResult.comparison) +
            `\n\n**Diferencias clave:**\n` +
            recResult.comparison.summaryDifferences.map(d => `• ${d}`).join('\n');
        }

        responseText = `${intro}\n\n${detailsList.join('\n---\n')}${comparisonText}\n\n` +
          `*Los precios mostrados son de referencia basados en información pública de O2 España. Consulta las condiciones oficiales antes de contratar.*`;

        quickActions = ["¿Cómo comprobar cobertura?", "Añadir más líneas", "Ajustar presupuesto", "Simular contratación"];
      }
    }

    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      recommendationResult: recResult,
      roamingResult: roamingRes,
      coverageResult: coverageRes,
      quickActions,
      timestamp: new Date().toISOString()
    };

    this.history.push(
      { id: `msg_u_${Date.now()}`, sender: 'user', text: query, timestamp: new Date().toISOString() },
      assistantMsg
    );

    return assistantMsg;
  }

  public getNeeds(): UserNeeds {
    return { ...this.currentNeeds };
  }

  public reset(): void {
    this.currentNeeds = {};
    this.history = [];
  }
}

export const conversationManager = new ConversationManager();
