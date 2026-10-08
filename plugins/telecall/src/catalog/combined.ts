import { TeleCallProduct } from '../types/product';

export const COMBINED_PRODUCTS: TeleCallProduct[] = [
  {
    id: "combined-600-35-mplus",
    name: "Fibra 600 Mb + Móvil 35 GB + Movistar Plus+",
    type: "fiber_mobile",
    active: true,
    description: "Pack convergente: Fibra 600 Mb simétrica, 1 línea móvil de 35 GB con llamadas ilimitadas y plataforma Movistar Plus+ incluida.",
    price: {
      monthly: 38,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 600,
      symmetric: true
    },
    mobile: {
      dataGB: 35,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: false,
      disneyPlus: false,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra y Móvil",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-600-60-mplus",
    name: "Fibra 600 Mb + Móvil 60 GB + Movistar Plus+",
    type: "fiber_mobile",
    active: true,
    description: "Pack convergente: Fibra 600 Mb simétrica, 1 línea móvil de 60 GB con llamadas ilimitadas y suscripción a Movistar Plus+ incluida.",
    price: {
      monthly: 45,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 600,
      symmetric: true
    },
    mobile: {
      dataGB: 60,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: false,
      disneyPlus: false,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra y Móvil",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-600-60-netflix",
    name: "Fibra 600 Mb + Móvil 60 GB + Movistar Plus+ + Netflix",
    type: "fiber_mobile",
    active: true,
    description: "Pack convergente de entretenimiento: Fibra 600 Mb, Móvil 60 GB, Movistar Plus+ y suscripción a Netflix Estándar incluida.",
    price: {
      monthly: 47,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 600,
      symmetric: true
    },
    mobile: {
      dataGB: 60,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: true,
      disneyPlus: false,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra, Móvil y TV",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-600-60-disney-netflix",
    name: "Fibra 600 Mb + Móvil 60 GB + Movistar Plus+ + Disney+ + Netflix",
    type: "fiber_mobile",
    active: true,
    description: "Pack integral de streaming: Fibra 600 Mb, Móvil 60 GB, Movistar Plus+, Disney+ y Netflix.",
    price: {
      monthly: 52,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 600,
      symmetric: true
    },
    mobile: {
      dataGB: 60,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: true,
      disneyPlus: true,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra, Móvil y TV",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-1000-350-mplus",
    name: "Fibra 1 Gb + Móvil 350 GB + Movistar Plus+",
    type: "fiber_mobile",
    active: true,
    description: "Pack de alto rendimiento: Fibra 1 Gbps simétrica, Móvil con 350 GB y Movistar Plus+.",
    price: {
      monthly: 50,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 1000,
      symmetric: true
    },
    mobile: {
      dataGB: 350,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: false,
      disneyPlus: false,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra y Móvil",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-1000-375-disney",
    name: "Fibra 1 Gb + Móvil 375 GB + Movistar Plus+ + Disney+",
    type: "fiber_mobile",
    active: true,
    description: "Pack premium: Fibra 1 Gbps simétrica, Móvil 375 GB, Movistar Plus+ y Disney+.",
    price: {
      monthly: 56,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 1000,
      symmetric: true
    },
    mobile: {
      dataGB: 375,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: false,
      disneyPlus: true,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra, Móvil y TV",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-1000-375-netflix",
    name: "Fibra 1 Gb + Móvil 375 GB + Movistar Plus+ + Netflix",
    type: "fiber_mobile",
    active: true,
    description: "Pack premium: Fibra 1 Gbps simétrica, Móvil 375 GB, Movistar Plus+ y Netflix.",
    price: {
      monthly: 58,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 1000,
      symmetric: true
    },
    mobile: {
      dataGB: 375,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: true,
      disneyPlus: false,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra, Móvil y TV",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "combined-1000-375-all-tv",
    name: "Fibra 1 Gb + Móvil 375 GB + Movistar Plus+ + Netflix + Disney+",
    type: "fiber_mobile",
    active: true,
    description: "Máxima conectividad y entretenimiento completo: Fibra 1 Gbps, 375 GB móviles, Movistar Plus+, Netflix y Disney+.",
    price: {
      monthly: 62,
      currency: "EUR",
      promotional: false
    },
    fiber: {
      speedMbps: 1000,
      symmetric: true
    },
    mobile: {
      dataGB: 375,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    television: {
      movistarPlus: true,
      netflix: true,
      disneyPlus: true,
      sports: true,
      football: false
    },
    conditions: {
      permanence: false,
      installationIncluded: true,
      routerIncluded: true,
      landlineIncluded: true,
      allowsAdditionalLines: true
    },
    source: {
      sourceName: "O2 España - Tarifas Fibra, Móvil y TV",
      sourceUrl: "https://o2online.es/fibra-y-movil/",
      retrievedAt: "2026-09-19"
    }
  }
];
