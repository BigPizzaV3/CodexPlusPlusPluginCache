export interface CoverageCheckResponse {
  canVerifyDirectly: false;
  message: string;
  officialCheckerUrl: string;
  processGuidance: string[];
}

export class CoverageService {
  /**
   * Responde de forma transparente a consultas sobre cobertura de fibra o red móvil.
   * Cumple la Regla 25: TeleCall no finge tener un comprobador interno ni inventa coberturas.
   */
  public getCoverageGuidance(addressOrCity?: string): CoverageCheckResponse {
    const target = addressOrCity ? ` para la zona o dirección "${addressOrCity}"` : "";

    return {
      canVerifyDirectly: false,
      message: `Para confirmar la cobertura exacta de fibra óptica${target}, es necesario consultar el comprobador oficial de O2. Como asistente de demostración técnica, TeleCall no dispone de acceso a bases de datos de despliegue en tiempo real ni inventa disponibilidad.`,
      officialCheckerUrl: "https://o2online.es/cobertura/",
      processGuidance: [
        "1. La red de fibra utiliza la infraestructura de telecomunicaciones de Telefónica con cobertura en la gran mayoría del territorio nacional.",
        "2. Para verificar la compatibilidad de tu edificio o domicilio, introduce tu dirección completa (calle, número, piso y código postal) en el comprobador oficial.",
        "3. La instalación y el router WiFi están incluidos sin permanencia una vez validada la cobertura técnica."
      ]
    };
  }
}

export const coverageService = new CoverageService();
