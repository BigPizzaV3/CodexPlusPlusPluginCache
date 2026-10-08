import { ROAMING_ZONES } from '../catalog/roamingData';
import { RoamingQueryResult } from '../types/roaming';

export class RoamingService {
  /**
   * Consulta las condiciones de roaming para un país específico
   */
  public queryCountry(countryInput: string): RoamingQueryResult {
    const cleanCountry = countryInput.trim().toLowerCase();

    // Check Zone 1 (EU/EEA/UK)
    const isEU = ROAMING_ZONES.zone_1_eu.countries?.some(
      c => cleanCountry.includes(c) || c.includes(cleanCountry)
    ) || false;

    if (isEU) {
      const zoneData = ROAMING_ZONES.zone_1_eu;
      return {
        country: countryInput,
        zone: "zone_1_eu",
        zoneName: zoneData.name,
        isEU: true,
        pricing: {
          calls: zoneData.pricing.calls || "Incluidas en tu tarifa nacional sin sobrecoste.",
          sms: zoneData.pricing.sms || "Incluidos en tu tarifa nacional.",
          data: zoneData.pricing.data || "Utilizas los GB de tu tarifa (sujeto a política de uso razonable).",
          extraCosts: false
        },
        advice: "Puedes viajar y utilizar tu línea móvil exactamente con las mismas condiciones que en España, sin costes imprevistos.",
        disclaimer: "Aplica en estancias temporales en países de la UE, EEE y Reino Unido."
      };
    }

    // Default to Zone 2/3 International
    const zoneData = ROAMING_ZONES.zone_2_and_3_international;
    return {
      country: countryInput,
      zone: "zone_2_and_3_international",
      zoneName: zoneData.name,
      isEU: false,
      pricing: {
        calls: `Salientes: ${zoneData.pricing.callsOutgoing} | Entrantes: ${zoneData.pricing.callsIncoming}`,
        sms: zoneData.pricing.sms || "Aprox. 0,73 € por SMS",
        data: zoneData.pricing.data || "Aprox. 12,10 € / MB",
        extraCosts: true
      },
      advice: "Para viajar a este destino (fuera de la UE), te recomendamos desactivar la itinerancia de datos al llegar o contratar una eSIM local / bono internacional para evitar consumos elevados.",
      disclaimer: "Los precios en el extranjero están sujetos a tarificación especial fuera de la regulación europea."
    };
  }
}

export const roamingService = new RoamingService();
