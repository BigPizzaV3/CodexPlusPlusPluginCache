import { TeleCallProduct } from '../types/product';

export const MOBILE_PRODUCTS: TeleCallProduct[] = [
  {
    id: "mobile-50",
    name: "Móvil 50 GB",
    type: "mobile",
    active: true,
    description: "Línea móvil principal con 50 GB de datos acumulables/alta velocidad 5G y llamadas nacionales ilimitadas.",
    price: {
      monthly: 7,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 50,
      unlimitedCalls: true,
      unlimitedSms: true,
      network: "5G"
    },
    conditions: {
      permanence: false
    },
    source: {
      sourceName: "O2 España - Tarifas móvil",
      sourceUrl: "https://o2online.es/tarifas-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "mobile-100",
    name: "Móvil 100 GB",
    type: "mobile",
    active: true,
    description: "Línea móvil con 100 GB de datos 5G y llamadas nacionales ilimitadas. Perfecta para uso intensivo de redes sociales y streaming.",
    price: {
      monthly: 10,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 100,
      unlimitedCalls: true,
      unlimitedSms: true,
      network: "5G"
    },
    conditions: {
      permanence: false
    },
    source: {
      sourceName: "O2 España - Tarifas móvil",
      sourceUrl: "https://o2online.es/tarifas-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "mobile-150",
    name: "Móvil 150 GB",
    type: "mobile",
    active: true,
    description: "Línea móvil con 150 GB de datos 5G y llamadas nacionales ilimitadas. Amplia holgura para usuarios exigentes.",
    price: {
      monthly: 15,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 150,
      unlimitedCalls: true,
      unlimitedSms: true,
      network: "5G"
    },
    conditions: {
      permanence: false
    },
    source: {
      sourceName: "O2 España - Tarifas móvil",
      sourceUrl: "https://o2online.es/tarifas-movil/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "mobile-300",
    name: "Móvil 300 GB",
    type: "mobile",
    active: true,
    description: "Línea móvil con 300 GB de datos 5G y llamadas nacionales ilimitadas. La opción de mayor capacidad para compartir internet y uso sin límites.",
    price: {
      monthly: 20,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 300,
      unlimitedCalls: true,
      unlimitedSms: true,
      network: "5G"
    },
    conditions: {
      permanence: false
    },
    source: {
      sourceName: "O2 España - Tarifas móvil",
      sourceUrl: "https://o2online.es/tarifas-movil/",
      retrievedAt: "2026-09-19"
    }
  }
];
