# ⚡ Willy SEO — Asesor y Auditor SEO para ChatGPT

Complemento oficial y servidor MCP de **Willy SEO** para ChatGPT. Permite auditar en tiempo real URLs vivas, evaluar borradores de contenido, calcular visibilidad en SERP de Google y generar marcado Schema.org listo para producción.

---

## 🚀 Características Principales

- **Auditoría On-Page Determinista:** Title tags con cálculo de ancho en píxeles, meta description, jerarquía H1-H6 y atributos alt en imágenes.
- **Chequeo Técnico & Indexabilidad:** Detección de bloqueos `noindex`, status HTTP, etiquetas canonical y viewport mobile-friendly.
- **Análisis Semántico & Search Intent:** Evaluación de longitud (prevención de Thin Content), presencia de keywords en zonas calientes y enlaces internos.
- **Generador de Schema.org JSON-LD:** Plantillas automáticas para `Article`, `FAQPage`, `LocalBusiness`, `Product` y `Organization`.
- **Previsualizador Google SERP:** Simulador en tiempo real de snippets en escritorio y dispositivos móviles.
- **Widget Interactivo Apps SDK:** Panel visual con modo oscuro, gauge de puntuación global (0-100) y tarjetas de *Quick Wins*.

---

## 🛠️ Instalación y Configuración

### 1. Instalar dependencias
```bash
cd /Users/willy/Downloads/willy-seo
npm install
```

### 2. Compilar el proyecto TypeScript
```bash
npm run build
```

### 3. Ejecutar suite de pruebas
```bash
npm test
```

---

## 🔌 Conexión con ChatGPT / Claude Desktop (MCP)

Para utilizar **Willy SEO** como herramienta en tu cliente compatible con Model Context Protocol (MCP), añade la siguiente configuración a tu archivo de configuración de MCP (ejemplo `claude_desktop_config.json` o configuración de OpenAI Apps):

```json
{
  "mcpServers": {
    "willy-seo": {
      "command": "node",
      "args": ["/Users/willy/Downloads/willy-seo/dist/src/server.js"]
    }
  }
}
```

---

## 🧰 Herramientas Expuestas (MCP Tools)

| Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| `audit_url` | `url` (string), `targetKeyword` (string, opcional) | Extrae y audita una página web en vivo. |
| `audit_content` | `htmlOrText` (string), `targetKeyword` (string) | Evalúa un borrador de texto antes de publicarlo. |
| `serp_preview` | `title` (string), `description` (string), `url` (string) | Calcula el ancho en px y previsualiza el snippet de Google. |
| `generate_schema`| `schemaType`, `url`, `title`, `description`, `faqs` | Genera código JSON-LD validado según Schema.org. |

---

## 📁 Estructura del Proyecto

```
willy-seo/
├── src/
│   ├── server.ts         # Servidor MCP y registro de Tools
│   ├── auditor.ts        # Motor de scoring y plan de acción
│   ├── extractor.ts      # Fetcher HTTP y parser Cheerio
│   ├── rules/            # Reglas On-Page, Técnicas, Schema y Semántica
│   └── types.ts          # Interfaces de datos
├── public/
│   └── widget.html       # Widget visual interactivo Apps SDK
├── prompts/
│   └── system-prompt.md  # Instrucciones maestras de ChatGPT
├── tests/
│   └── auditor.test.ts   # Pruebas unitarias
└── README.md
```

---

Desarrollado con pasión por el SEO técnico y la inteligencia artificial bajo la marca **Willy SEO**.
