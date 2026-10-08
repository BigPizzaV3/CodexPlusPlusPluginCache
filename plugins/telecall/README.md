# TeleCall — Asistente Conversacional y Motor de Recomendación de Telecomunicaciones

![TeleCall Banner](/assets/telecall_banner.jpg)

**TeleCall** es una aplicación de demostración tecnológica diseñada para ChatGPT y entornos web modernos, que ilustra cómo una compañía de telecomunicaciones puede evolucionar desde un buscador tradicional o chatbot FAQ hacia una **experiencia conversacional de descubrimiento, asesoramiento objetivo y recomendación de tarifas**.

---

## ⚠️ Mensaje de Transparencia e Identidad

> **Demo independiente:** TeleCall es una empresa ficticia creada exclusivamente como demostración tecnológica. **NO es O2, no representa a O2 ni es una aplicación oficial de O2.**
> 
> Los productos, tarifas, precios y condiciones incluidos utilizan como referencia información pública de O2 España. Estos datos tienen carácter demostrativo y orientativo, y **no constituyen una oferta contractual vinculante**.

---

## 🚀 Características Principales

1. **Comprensión Semántica de Necesidades:**
   - Detecta hogares con teletrabajo, gaming, streaming (Netflix, Disney+, Movistar Plus+), número de líneas familiares, segundas residencias y límites presupuestarios.
2. **Preguntas Mínimas e Inteligentes:**
   - Adapta el diálogo evitando cuestionarios extensos o invasivos.
3. **Motor de Recomendación Determinista y Objetivo:**
   - Sin rankings artificiales ni puntuaciones arbitrarias ("ganador", "la mejor tarifa").
   - Identifica opciones objetivas ("la de menor precio", "la de mayor velocidad", "la que incluye Netflix").
4. **Desglose Transparente de Costes:**
   - Cálculo exacto de tarifa base, líneas adicionales, segundas residencias y precios totales mensuales.
5. **Módulo Especializado de Roaming:**
   - Diferenciación rigurosa entre Zona 1 (UE/EEE/Reino Unido) y Zona 2/3 (Resto del mundo como Tailandia o EE.UU.), con consejos de ahorro y tarifas de referencia.
6. **Política Estricta Anti-Alucinación:**
   - No inventa cobertura técnica (deriva al comprobador oficial de O2).
   - No simula contrataciones en firme ni solicita datos bancarios.
   - No promete derechos deportivos o fútbol ilimitado no contenidos en la referencia.

---

## 🏛️ Arquitectura del Proyecto

```text
TeleCall/
├── data/
│   └── telecall-catalog.json       # Dataset JSON con productos, precios, TV, líneas extra y roaming
├── src/
│   ├── types/                      # Modelos TypeScript estrictos
│   │   ├── product.ts              # TeleCallProduct, SourceMetadata, Specs
│   │   ├── userNeeds.ts            # UserNeeds, UserIntent, IntentDetectionResult
│   │   ├── recommendation.ts       # Recommendation, ComparisonResult
│   │   ├── pricing.ts              # PriceBreakdown, PriceItem
│   │   ├── roaming.ts              # RoamingZoneInfo, RoamingQueryResult
│   │   └── analytics.ts            # AnalyticsEvent y logger no invasivo
│   ├── catalog/                    # Módulos tipados del catálogo
│   │   ├── catalog.ts              # Exportación unificada y metadatos
│   │   ├── fiber.ts                # Fibra 300Mb (23€), 600Mb (27€), 1Gb (31€)
│   │   ├── mobile.ts               # Móvil 50GB (7€), 100GB (10€), 150GB (15€), 300GB (20€)
│   │   ├── combined.ts             # Fibra + Móvil + Streaming / TV (38€ - 62€)
│   │   ├── additionalLines.ts      # Líneas adicionales (40GB, 150GB, 300GB)
│   │   ├── secondResidence.ts      # Fibra segunda residencia (300Mb, 600Mb, 1Gb)
│   │   ├── television.ts           # Desglose de canales y servicios TV
│   │   └── roamingData.ts          # Zonas y tarifas internacionales
│   ├── services/                   # Lógica de negocio y motores
│   │   ├── catalogService.ts       # Acceso y validación de integridad
│   │   ├── pricingService.ts       # Cálculo de precios, líneas extra y presupuesto
│   │   ├── recommendationService.ts# Motor de recomendación y comparador
│   │   ├── roamingService.ts       # Consultas por país y recomendaciones
│   │   ├── coverageService.ts      # Derivación transparente de cobertura
│   │   └── analyticsService.ts     # Registro de eventos analíticos
│   ├── agent/                      # Lógica del asistente conversacional
│   │   ├── instructions.ts         # Persona, restricciones de tono y directrices
│   │   ├── intent.ts               # Extractor y clasificador semántico
│   │   ├── conversation.ts         # Gestor de diálogo y preguntas mínimas
│   │   └── recommendation.ts       # Puente de recomendación
│   ├── utils/                      # Utilidades de validación y formateo
│   │   ├── validation.ts           # Validador de esquema de catálogo
│   │   └── formatting.ts           # Tablas markdown, divisas y gigas
│   └── ui/                         # Interfaz interactiva de demostración
│       ├── app.ts                  # Chat, tarjetas interactivas y catálogo modal
│       └── styles.css              # Diseño visual premium con glassmorphism
├── tests/                          # Suite completa de pruebas con Vitest
│   ├── catalog.test.ts             # Integridad de datos y validaciones
│   ├── pricing.test.ts             # Sumatorios de líneas y presupuesto
│   ├── recommendation.test.ts      # 15 casos de uso de la regla 38
│   ├── antiHallucination.test.ts   # Pruebas de seguridad anti-alucinación
│   └── intent.test.ts              # Pruebas de extracción semántica
├── public/assets/                  # Logotipos y banners generados
├── index.html                      # Layout de la demo web
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🛠️ Instalación y Ejecución

### 1. Requisitos
- Node.js 18+ o superior
- npm

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar suite de pruebas (33 tests)
```bash
npm test
```

### 4. Iniciar servidor de desarrollo local
```bash
npm run dev
```
Abre en tu navegador: `http://localhost:3000`

### 5. Compilar para producción
```bash
npm run build
```

---

## 📊 Catálogo de Referencia Incluido

| Categoría | Opciones | Precios de referencia |
| :--- | :--- | :--- |
| **Fibra sola** | 300 Mb, 600 Mb, 1 Gb | 23 €, 27 €, 31 €/mes |
| **Móvil solo** | 50 GB, 100 GB, 150 GB, 300 GB | 7 €, 10 €, 15 €, 20 €/mes |
| **Fibra + Móvil** | 600 Mb (35-60 GB) / 1 Gb (350-375 GB) | 38 € a 62 €/mes |
| **Streaming / TV** | Movistar Plus+, Netflix, Disney+ | Incluidos en packs combinados |
| **Líneas Adicionales** | 40 GB, 150 GB, 300 GB | 5 €, 10 €, 15 €/mes |
| **Segunda Residencia** | 300 Mb, 600 Mb, 1 Gb | 15 €, 20 €, 27 €/mes |

---

## 🛡️ Principios de Asesoramiento y Seguridad

- **Descubrimiento antes de recomendación:** Comprende las necesidades antes de filtrar.
- **Sin incentivos de sobreprecio:** No empuja las opciones más caras; si un usuario sólo necesita 50 GB, se le ofrece la tarifa más económica que cubra su necesidad.
- **Transparencia total:** Explica claramente de dónde procede la información y remite a las fuentes oficiales de O2 España para cualquier contratación definitiva.
