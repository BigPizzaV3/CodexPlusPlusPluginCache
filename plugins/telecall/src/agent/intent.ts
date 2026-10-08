import { UserIntent, UserNeeds, IntentDetectionResult } from '../types/userNeeds';

export class IntentClassifier {
  /**
   * Analiza una consulta en lenguaje natural y extrae las intenciones y necesidades estructuradas
   */
  public parseQuery(query: string): IntentDetectionResult {
    const text = query.toLowerCase();
    const intents: Set<UserIntent> = new Set();
    const needs: UserNeeds = {};

    // 1. Detección de Fibra
    if (
      text.includes('fibra') ||
      text.includes('internet') ||
      text.includes('wifi') ||
      text.includes('adsl') ||
      text.includes('router') ||
      text.includes('en casa') ||
      text.includes('para casa')
    ) {
      needs.fiberRequired = true;
      intents.add('fiber');
    }

    // Velocidades de fibra
    if (text.includes('1 gb') || text.includes('1gb') || text.includes('1000 mb') || text.includes('1000mb') || text.includes('1 giga')) {
      needs.fiberRequired = true;
      needs.fiberSpeedRequired = 1000;
    } else if (text.includes('600 mb') || text.includes('600mb') || text.includes('600 megas')) {
      needs.fiberRequired = true;
      needs.fiberSpeedRequired = 600;
    } else if (text.includes('300 mb') || text.includes('300mb') || text.includes('300 megas')) {
      needs.fiberRequired = true;
      needs.fiberSpeedRequired = 300;
    }

    // 2. Detección de Móvil
    if (
      text.includes('móvil') ||
      text.includes('movil') ||
      text.includes('linea') ||
      text.includes('línea') ||
      text.includes('gigas') ||
      text.includes('gb') ||
      text.includes('llamadas')
    ) {
      intents.add('mobile');
      if (needs.mobileLines === undefined) {
        needs.mobileLines = 1;
      }
    }

    // Conteo de líneas y personas
    const familyMatch = text.match(/(somos|familia de)\s+(\w+|\d+)/);
    if (familyMatch) {
      const numWord = familyMatch[2];
      const parsedNum = this.parseNumberWord(numWord);
      if (parsedNum) {
        needs.people = parsedNum;
      }
    }

    const linesMatch = text.match(/(\w+|\d+)\s+(líneas|lineas|móviles|moviles)/);
    if (linesMatch) {
      const numWord = linesMatch[1];
      const parsedNum = this.parseNumberWord(numWord);
      if (parsedNum) {
        needs.mobileLines = parsedNum;
        if (parsedNum > 1) {
          intents.add('additional_line');
        }
      }
    }

    if (text.includes('tres líneas') || text.includes('3 líneas') || text.includes('tres moviles') || text.includes('3 moviles')) {
      needs.mobileLines = 3;
      intents.add('additional_line');
    } else if (text.includes('dos líneas') || text.includes('2 líneas') || text.includes('dos moviles') || text.includes('2 moviles')) {
      needs.mobileLines = 2;
      intents.add('additional_line');
    } else if (text.includes('cuatro líneas') || text.includes('4 líneas')) {
      needs.mobileLines = 4;
      intents.add('additional_line');
    }

    // Gigas requeridos
    if (text.includes('muchos gigas') || text.includes('más de 100 gb') || text.includes('100 gb') || text.includes('150 gb') || text.includes('300 gb')) {
      needs.mobileDataRequired = 100;
    } else if (text.includes('apenas uso datos') || text.includes('pocos gigas') || text.includes('barato')) {
      needs.mobileDataRequired = 50;
    }

    // 3. Convergencia Fibra + Móvil
    if (needs.fiberRequired && (needs.mobileLines || 0) > 0) {
      intents.add('fiber_mobile');
    }

    // 4. Streaming y Televisión
    if (text.includes('netflix')) {
      needs.netflix = true;
      needs.streaming = true;
      intents.add('tv');
    }

    if (text.includes('disney')) {
      needs.disneyPlus = true;
      needs.streaming = true;
      intents.add('tv');
    }

    if (text.includes('movistar plus') || text.includes('movistar+') || text.includes('televisión') || text.includes('television') || text.includes('tv')) {
      needs.movistarPlus = true;
      intents.add('tv');
    }

    if (text.includes('futbol') || text.includes('fútbol') || text.includes('liga') || text.includes('champions')) {
      needs.football = true;
      needs.sports = true;
      needs.movistarPlus = true;
      intents.add('tv');
    }

    // 5. Segunda Residencia
    if (
      text.includes('segunda residencia') ||
      text.includes('casa del pueblo') ||
      text.includes('casa en el pueblo') ||
      text.includes('casa de la playa') ||
      text.includes('casa de vacaciones') ||
      text.includes('casa de campo')
    ) {
      needs.secondResidence = true;
      intents.add('second_residence');
    }

    // 6. Roaming
    const roamingKeywords = ['roaming', 'viaje', 'viajo', 'viajar', 'fuera de españa', 'extranjero', 'tailandia', 'thailand', 'italia', 'francia', 'eeuu', 'estados unidos', 'uk', 'londres', 'alemania', 'japon', 'suiza', 'marruecos', 'andorra'];
    for (const kw of roamingKeywords) {
      if (text.includes(kw)) {
        intents.add('roaming');
        if (kw === 'tailandia' || kw === 'thailand') needs.country = 'Tailandia';
        else if (kw === 'italia') needs.country = 'Italia';
        else if (kw === 'francia') needs.country = 'Francia';
        else if (kw === 'eeuu' || kw === 'estados unidos') needs.country = 'Estados Unidos';
        else if (kw === 'uk' || kw === 'londres') needs.country = 'Reino Unido';
        else if (kw === 'suiza') needs.country = 'Suiza';
        else if (kw === 'japon') needs.country = 'Japón';
        else if (kw === 'marruecos') needs.country = 'Marruecos';
        else if (kw === 'andorra') needs.country = 'Andorra';
        break;
      }
    }

    // 7. Presupuesto
    const budgetMatch = text.match(/(no quiero pagar más de|máximo|presupuesto de|hasta|menos de|no más de)\s+(\d+)\s*(€|euros)?/);
    if (budgetMatch) {
      needs.budget = parseInt(budgetMatch[2], 10);
      intents.add('pricing');
    }

    if (text.includes('barata') || text.includes('económica') || text.includes('precio') || text.includes('cuesta') || text.includes('cuanto vale')) {
      intents.add('pricing');
    }

    // 8. Casos de uso específicos (teletrabajo, gaming, etc.)
    if (text.includes('teletrabajo') || text.includes('teletrabajar') || text.includes('trabajar desde casa')) {
      needs.teleworking = true;
      needs.fiberRequired = true;
      if (!needs.fiberSpeedRequired) needs.fiberSpeedRequired = 600;
    }

    if (text.includes('jugar') || text.includes('gaming') || text.includes('playstation') || text.includes('xbox') || text.includes('twitch')) {
      needs.gaming = true;
      needs.fiberRequired = true;
      if (!needs.fiberSpeedRequired) needs.fiberSpeedRequired = 600;
    }

    // 9. Cobertura
    if (text.includes('cobertura') || text.includes('llega la fibra') || text.includes('comprobar dirección') || text.includes('instalación en')) {
      intents.add('coverage');
    }

    // 10. Cliente actual
    if (text.includes('ya soy cliente') || text.includes('tengo o2') || text.includes('tengo contrato') || text.includes('añadir una línea') || text.includes('ya tengo')) {
      needs.existingCustomer = true;
      intents.add('existing_customer');
    }

    // 11. Comparación
    if (text.includes('compara') || text.includes('comparar') || text.includes('diferencia') || text.includes('diferencias') || text.includes('qué opciones hay')) {
      intents.add('comparison');
    }

    if (intents.size === 0) {
      intents.add('general_information');
    }

    return {
      intents: Array.from(intents),
      extractedNeeds: needs,
      confidence: 0.95,
      rawQuery: query
    };
  }

  private parseNumberWord(word: string): number | null {
    const clean = word.toLowerCase().trim();
    if (!isNaN(parseInt(clean, 10))) return parseInt(clean, 10);
    const map: Record<string, number> = {
      'un': 1, 'una': 1, 'uno': 1,
      'dos': 2,
      'tres': 3,
      'cuatro': 4,
      'cinco': 5,
      'seis': 6
    };
    return map[clean] || null;
  }
}

export const intentClassifier = new IntentClassifier();
