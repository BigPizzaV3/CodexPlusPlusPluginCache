import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Extractor } from './extractor.js';
import { Auditor } from './auditor.js';
import { estimateTitlePixelWidth } from './rules/onpage.js';
import { generateSchemaTemplate } from './rules/schema.js';

const server = new Server(
  {
    name: 'willy-seo',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Listar herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'audit_url',
        description:
          'Audita completamente una página web en vivo para SEO On-Page, técnico, semántica y datos estructurados bajo la metodología Willy SEO.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL completa de la página a auditar (ej: https://ejemplo.com/pagina)',
            },
            targetKeyword: {
              type: 'string',
              description: 'Palabra clave o intención de búsqueda objetivo (opcional)',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'audit_content',
        description:
          'Audita un borrador de contenido o código HTML antes de publicarlo, evaluando estructura de encabezados, longitud, metadatos y adecuación a la palabra clave.',
        inputSchema: {
          type: 'object',
          properties: {
            htmlOrText: {
              type: 'string',
              description: 'El contenido HTML o texto del borrador a evaluar',
            },
            url: {
              type: 'string',
              description: 'URL prevista de publicación (opcional, ej: https://ejemplo.com/blog/mi-post)',
            },
            targetKeyword: {
              type: 'string',
              description: 'Palabra clave objetivo para optimizar',
            },
          },
          required: ['htmlOrText'],
        },
      },
      {
        name: 'serp_preview',
        description:
          'Calcula el ancho en píxeles y simula cómo se verá el snippet en los resultados de búsqueda de Google para móvil y escritorio.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Texto del Title Tag',
            },
            description: {
              type: 'string',
              description: 'Texto de la Meta Description',
            },
            url: {
              type: 'string',
              description: 'URL a mostrar en el snippet',
            },
          },
          required: ['title', 'description', 'url'],
        },
      },
      {
        name: 'generate_schema',
        description:
          'Genera marcado estructurado Schema.org JSON-LD validado y listo para copiar/pegar.',
        inputSchema: {
          type: 'object',
          properties: {
            schemaType: {
              type: 'string',
              enum: ['Article', 'FAQPage', 'Organization', 'Product', 'LocalBusiness'],
              description: 'Tipo de schema a generar',
            },
            url: {
              type: 'string',
              description: 'URL de la página asociada',
            },
            title: {
              type: 'string',
              description: 'Título o nombre del elemento',
            },
            description: {
              type: 'string',
              description: 'Descripción breve',
            },
            faqs: {
              type: 'array',
              description: 'Lista de preguntas y respuestas (para tipo FAQPage)',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                },
                required: ['question', 'answer'],
              },
            },
          },
          required: ['schemaType', 'url'],
        },
      },
    ],
  };
});

// 2. Ejecutar herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'audit_url': {
        const url = String(args?.url);
        const targetKeyword = args?.targetKeyword ? String(args.targetKeyword) : undefined;

        const extractedData = await Extractor.extractFromUrl(url);
        const report = Auditor.runAudit(extractedData, targetKeyword);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }

      case 'audit_content': {
        const htmlOrText = String(args?.htmlOrText);
        const url = args?.url ? String(args.url) : 'https://ejemplo.com/draft';
        const targetKeyword = args?.targetKeyword ? String(args.targetKeyword) : undefined;

        // Si es texto plano sin tags HTML, envolverlo en párrafos básicos
        const isHtml = /<[a-z][\s\S]*>/i.test(htmlOrText);
        const formattedHtml = isHtml ? htmlOrText : `<html><body><p>${htmlOrText.replace(/\n\n/g, '</p><p>')}</p></body></html>`;

        const extractedData = Extractor.parseHtml(formattedHtml, url, 200, 50, {});
        const report = Auditor.runAudit(extractedData, targetKeyword);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }

      case 'serp_preview': {
        const title = String(args?.title || '');
        const description = String(args?.description || '');
        const url = String(args?.url || '');

        const pxWidth = estimateTitlePixelWidth(title);
        const desktopTruncated = pxWidth > 580;
        const mobileTruncated = pxWidth > 520;

        const result = {
          desktop: {
            title: desktopTruncated ? title.substring(0, 58) + '...' : title,
            pixelWidth: pxWidth,
            isTruncated: desktopTruncated,
            url,
            description: description.length > 158 ? description.substring(0, 155) + '...' : description,
          },
          mobile: {
            title: mobileTruncated ? title.substring(0, 50) + '...' : title,
            pixelWidth: pxWidth,
            isTruncated: mobileTruncated,
            url,
            description: description.length > 120 ? description.substring(0, 118) + '...' : description,
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_schema': {
        const schemaType = (args?.schemaType as any) || 'Article';
        const url = String(args?.url || 'https://ejemplo.com');
        const title = args?.title ? String(args.title) : undefined;
        const description = args?.description ? String(args.description) : undefined;
        const faqs = (args?.faqs as any) || undefined;

        const jsonLd = generateSchemaTemplate(schemaType, {
          url,
          title,
          description,
          faqs,
        });

        return {
          content: [
            {
              type: 'text',
              text: jsonLd,
            },
          ],
        };
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error ejecutando ${name}: ${error?.message || String(error)}`,
        },
      ],
    };
  }
});

// 3. Iniciar servidor sobre transporte stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Willy SEO MCP Server iniciado y listo para recibir peticiones de ChatGPT.');
}

main().catch((err) => {
  console.error('Fatal error en Willy SEO Server:', err);
  process.exit(1);
});
