import { TeleCallProduct } from '../types/product';

export const ADDITIONAL_LINE_PRODUCTS: TeleCallProduct[] = [
  {
    id: "additional-line-40",
    name: "Línea Adicional 40 GB",
    type: "additional_line",
    active: true,
    description: "Línea móvil adicional con 40 GB 5G y llamadas ilimitadas para añadir a tu paquete de Fibra y Móvil.",
    price: {
      monthly: 5,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 40,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    conditions: {
      permanence: false,
      requiresParentPlan: "fiber_mobile"
    },
    source: {
      sourceName: "O2 España - Líneas adicionales",
      sourceUrl: "https://o2online.es/lineas-adicionales/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "additional-line-150",
    name: "Línea Adicional 150 GB",
    type: "additional_line",
    active: true,
    description: "Línea móvil adicional con 150 GB 5G y llamadas ilimitadas para miembros de la familia o dispositivos extra.",
    price: {
      monthly: 10,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 150,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    conditions: {
      permanence: false,
      requiresParentPlan: "fiber_mobile"
    },
    source: {
      sourceName: "O2 España - Líneas adicionales",
      sourceUrl: "https://o2online.es/lineas-adicionales/",
      retrievedAt: "2026-09-19"
    }
  },
  {
    id: "additional-line-300",
    name: "Línea Adicional 300 GB",
    type: "additional_line",
    active: true,
    description: "Línea móvil adicional con 300 GB 5G y llamadas ilimitadas con la máxima capacidad de datos.",
    price: {
      monthly: 15,
      currency: "EUR",
      promotional: false
    },
    mobile: {
      dataGB: 300,
      unlimitedCalls: true,
      unlimitedSms: true
    },
    conditions: {
      permanence: false,
      requiresParentPlan: "fiber_mobile"
    },
    source: {
      sourceName: "O2 España - Líneas adicionales",
      sourceUrl: "https://o2online.es/lineas-adicionales/",
      retrievedAt: "2026-09-19"
    }
  }
];
