import { RoamingZoneInfo, RoamingZoneType } from '../types/roaming';

export const ROAMING_ZONES: Record<RoamingZoneType, RoamingZoneInfo> = {
  zone_1_eu: {
    name: "Zona 1 (Unión Europea, EEE y Reino Unido)",
    description: "Incluye los 27 países de la UE, Islandia, Liechtenstein, Noruega y acuerdos vigentes para Reino Unido.",
    countries: [
      "alemania", "austria", "bélgica", "belgica", "bulgaria", "chipre", "croacia", "dinamarca",
      "eslovaquia", "eslovenia", "estonia", "finlandia", "francia", "grecia", "hungría", "hungria",
      "irlanda", "islandia", "italia", "letonia", "liechtenstein", "lituania", "luxemburgo",
      "malta", "noruega", "países bajos", "paises bajos", "holanda", "polonia", "portugal",
      "reino unido", "uk", "gran bretaña", "inglaterra", "escocia", "gales", "irlanda del norte",
      "república checa", "republica checa", "rumanía", "rumania", "suecia", "españa"
    ],
    pricing: {
      calls: "Llamadas nacionales y a Zona 1 incluidas según tu tarifa (sin sobrecoste de itinerancia).",
      sms: "SMS incluidos según tu tarifa nacional.",
      data: "Utilizas los gigas de tu tarifa nacional (sujeto a la Política de Uso Razonable de la UE).",
      extraCosts: false
    },
    notes: "Aplica en viajes temporales. No confundir con llamadas internacionales emitidas desde España hacia el extranjero.",
    recommendation: "Puedes viajar y utilizar tu móvil con normalidad como si estuvieras en España."
  },
  zone_2_and_3_international: {
    name: "Zona 2 y 3 (Resto del Mundo)",
    description: "Países no comunitarios como Tailandia, Estados Unidos, Suiza, Andorra, Japón, etc.",
    popularCountries: [
      "tailandia", "thailand", "estados unidos", "eeuu", "usa", "suiza", "andorra", "marruecos",
      "méxico", "mexico", "japón", "japon", "turquía", "turquia", "argentina", "colombia",
      "china", "brasil", "australia", "canadá", "canada", "egipto", "emiratos árabes", "dubai",
      "perú", "peru", "chile", "cuba", "republica dominicana", "india", "indonesia", "bali"
    ],
    pricing: {
      callsOutgoing: "Tarifa estándar aprox. 1,82 €/min + 0,57 € de establecimiento de llamada.",
      callsIncoming: "Aprox. 1,45 €/min + 0,57 € de establecimiento.",
      sms: "Aprox. 0,73 € por SMS enviado (recepción gratuita).",
      data: "Aprox. 12,10 € por MB consumido fuera de bonos específicos.",
      extraCosts: true
    },
    notes: "Los precios en Zona 2 y 3 no están regulados por la UE y conllevan tarificación adicional por consumo.",
    recommendation: "Se aconseja desactivar la itinerancia de datos al aterrizar o adquirir una eSIM local / bono de datos internacional para evitar costes elevados."
  }
};
