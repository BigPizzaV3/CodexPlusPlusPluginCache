import { TeleCallProduct } from '../types/product';

export const FIBER_PRODUCTS: TeleCallProduct[] = [
  {
    id: "fiber-300",
    name: "Fibra 300 Mb",
    type: "fiber",
    active: true,
    description: "Fibra simétrica de 300 Mbps con línea fija incluida. Ideal para navegación habitual, teletrabajo estándar y streaming HD.",
    price: {
      monthly: 23,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 300,
      symmetric: true
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true
    },
    source: {
      sourceName: "O2 España - Catálogo público",
      sourceUrl: "https://o2online.es/fibra/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "fiber-600",
    name: "Fibra 600 Mb",
    type: "fiber",
    active: true,
    description: "Fibra simétrica de 600 Mbps con línea fija incluida. Gran velocidad para varios dispositivos simultáneos, streaming 4K y descargas rápidas.",
    price: {
      monthly: 27,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 600,
      symmetric: true
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true
    },
    source: {
      sourceName: "O2 España - Catálogo público",
      sourceUrl: "https://o2online.es/fibra/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "fiber-1000",
    name: "Fibra 1 Gb",
    type: "fiber",
    active: true,
    description: "Fibra simétrica de 1 Gbps (1.000 Mbps) con línea fija incluida. Máximo rendimiento para gaming competitivo, teletrabajo intensivo y hogares hiperconectados.",
    price: {
      monthly: 31,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 1000,
      symmetric: true
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true
    },
    source: {
      sourceName: "O2 España - Catálogo público",
      sourceUrl: "https://o2online.es/fibra/",
      retrievedAt: "2026-09-19"
    }
  }
];
