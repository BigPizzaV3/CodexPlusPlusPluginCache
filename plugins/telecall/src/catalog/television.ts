export interface TVPackageInfo {
  id: string;
  name: string;
  includedInPlans: string[];
  streamingServices: string[];
  channelsHighlights: string[];
  footballIncluded: boolean;
  notes: string;
}

export const TV_PACKAGES: TVPackageInfo[] = [
  {
    id: "tv-mplus",
    name: "Movistar Plus+",
    includedInPlans: [
      "combined-600-35-mplus",
      "combined-600-60-mplus",
      "combined-600-60-netflix",
      "combined-600-60-disney-netflix",
      "combined-1000-350-mplus",
      "combined-1000-375-disney",
      "combined-1000-375-netflix",
      "combined-1000-375-all-tv"
    ],
    streamingServices: ["Movistar Plus+ App"],
    channelsHighlights: [
      "Canal Original Movistar Plus+ (estrenos de cine, series exclusivas)",
      "Un partido de LaLiga EA Sports por jornada",
      "Un partido de UEFA Champions League por jornada",
      "Tenis (Wimbledon, Masters 1000)",
      "Baloncesto (Euroliga, Liga Endesa)",
      "Más de 80 canales temáticos en directo y bajo demanda"
    ],
    footballIncluded: false, // Partial (1 match per round, NOT full league package)
    notes: "Incluye 1 partido por jornada de LaLiga y 1 de Champions. No incluye todos los partidos de fútbol de cada jornada."
  },
  {
    id: "tv-netflix",
    name: "Netflix Estándar",
    includedInPlans: [
      "combined-600-60-netflix",
      "combined-600-60-disney-netflix",
      "combined-1000-375-netflix",
      "combined-1000-375-all-tv"
    ],
    streamingServices: ["Netflix"],
    channelsHighlights: [
      "Catálogo completo de películas, series y documentales de Netflix",
      "Calidad Full HD (1080p)",
      "Reproducción simultánea en hasta 2 dispositivos del hogar",
      "Descargas para ver sin conexión"
    ],
    footballIncluded: false,
    notes: "Plan Estándar integrado en la factura única de TeleCall."
  },
  {
    id: "tv-disney",
    name: "Disney+ Estándar",
    includedInPlans: [
      "combined-600-60-disney-netflix",
      "combined-1000-375-disney",
      "combined-1000-375-all-tv"
    ],
    streamingServices: ["Disney+"],
    channelsHighlights: [
      "Contenido de Disney, Pixar, Marvel, Star Wars, National Geographic y Star",
      "Calidad Full HD (1080p)",
      "Hasta 2 reproducciones simultáneas",
      "Descargas ilimitadas en hasta 10 dispositivos"
    ],
    footballIncluded: false,
    notes: "Suscripción integrada en la tarifa sin coste adicional por separado."
  }
];
