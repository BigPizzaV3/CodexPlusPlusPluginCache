import { TeleCallProduct } from '../types/product';

export const SECOND_RESIDENCE_PRODUCTS: TeleCallProduct[] = [
  {
    id: "second-residence-300",
    name: "Segunda Residencia Fibra 300 Mb",
    type: "second_residence",
    active: true,
    description: "Fibra óptica para tu segunda vivienda (300 Mbps simétricos). Precio especial exclusivo para clientes con contrato principal de Fibra y Móvil.",
    price: {
      monthly: 15,
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
      requiresExistingCustomer: true
    },
    source: {
      sourceName: "O2 España - Segunda Residencia",
      sourceUrl: "https://o2online.es/segunda-residencia/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "second-residence-600",
    name: "Segunda Residencia Fibra 600 Mb",
    type: "second_residence",
    active: true,
    description: "Fibra óptica de 600 Mbps para tu segunda vivienda. Precio especial para clientes existentes.",
    price: {
      monthly: 20,
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
      requiresExistingCustomer: true
    },
    source: {
      sourceName: "O2 España - Segunda Residencia",
      sourceUrl: "https://o2online.es/segunda-residencia/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "second-residence-1000",
    name: "Segunda Residencia Fibra 1 Gb",
    type: "second_residence",
    active: true,
    description: "Fibra de 1 Gbps para tu segunda residencia. Máxima velocidad para teletrabajar o disfrutar de vacaciones.",
    price: {
      monthly: 27,
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
      requiresExistingCustomer: true
    },
    source: {
      sourceName: "O2 España - Segunda Residencia",
      sourceUrl: "https://o2online.es/segunda-residencia/",
      retrievedAt: "2026-09-19"
    }
  }
];
