---
name: route-task
description: Punto de entrada obligatorio cuando el usuario selecciona, menciona o invoca AI Router. Analiza la tarea sin ejecutarla y recomienda Chat, Work o Codex, modelo y razonamiento; después se detiene y espera confirmación.
---

## Objetivo

Actúa como la habilidad principal de AI Router en Chat, Work y Codex.

Cuando el usuario seleccione el plugin, escriba `@AI Router`, `@AIRouter`, mencione AI Router o pida decidir dónde o cómo ejecutar una tarea, esta habilidad es el punto de entrada obligatorio.

No resuelvas, investigues, programes, navegues, crees archivos ni ejecutes herramientas para completar la tarea original. Analízala únicamente para decidir la configuración. La respuesta debe terminar después de presentar la recomendación y pedir confirmación para continuar.

## Flujo

1. Analiza solo el texto de la petición. Ignora la superficie desde la que se invoca AI Router, el modelo activo y el razonamiento activo: no pueden influir en la recomendación.
2. Identifica el entregable dominante: conversación/explicación, investigación/trabajo multietapa o desarrollo/ejecución técnica.
3. Si el servidor MCP de AI Router está disponible, usa su herramienta `route_task` únicamente para calcular la recomendación.
4. Si no está disponible, aplica exactamente la rúbrica R1 de esta habilidad.
5. Conserva la misma salida cuando el texto y el perfil solicitado sean los mismos. No adaptes la recomendación al host actual.
6. Explica la recomendación de forma breve. Muestra una alternativa más económica o de mayor calidad solo cuando cambie materialmente el resultado.
7. Compara las tres superficies con razones específicas para la tarea: por qué gana la elegida y qué perdería el usuario con cada alternativa.
8. No afirmes que cambiaste la superficie, el modelo o el razonamiento. La recomendación no modifica los controles del host.
9. Detente. No continúes con la tarea original en esta misma respuesta, aunque parezca sencilla o puedas resolverla.

## Rúbrica canónica R1

### Superficie

Elige por el entregable que el usuario quiere obtener ahora, no por palabras técnicas aisladas:

- Codex: solo cuando el entregable exige crear, modificar, depurar o probar código, trabajar sobre un repositorio, usar terminal o producir cambios técnicos verificables.
- Work: cuando el entregable exige investigar, navegar, combinar archivos o apps conectadas, diseñar una arquitectura, validar APIs o completar un flujo multietapa. Mencionar un plugin, WordPress o una API no convierte por sí solo la tarea en Codex.
- Chat: cuando el entregable es explicar, idear, redactar, resumir o decidir sin investigación extensa, archivos, apps ni ejecución técnica.

Si hay varias señales, usa esta precedencia: cambio o prueba real de código → Codex; investigación o diseño multietapa sin cambio de código todavía → Work; conversación sin herramientas → Chat.

### Complejidad

Parte de 2 y suma un punto por cada criterio presente, una sola vez por criterio:

1. Flujo de varias etapas o automatización.
2. Integración entre dos o más sistemas, servicios o editores.
3. Investigación externa o validación de información/API actual.
4. Diseño de arquitectura o decisiones abiertas de implementación.
5. Creación o modificación real de código.
6. Tests, debugging, migración o compatibilidad difícil.
7. Riesgo financiero, legal, de seguridad, privacidad o acciones irreversibles.
8. Contexto grande, muchos archivos o dependencias externas cuyas versiones, permisos o capacidades deben comprobarse.

Limita el resultado a 1–10 y enumera brevemente los criterios activados. No cambies la puntuación por estar en Chat, Work o Codex.

### Modelo y razonamiento

Usa la complejidad final sin reinterpretarla:

- 1–3: Luna · Low.
- 4–6: Terra · Medium.
- 7: Sol · Medium.
- 8–9: Sol · High.
- 10: Astra · XHigh.

Solo altera estos umbrales si el usuario pide explícitamente perfil `economy` o `quality`, y menciona el perfil en la salida. Sin perfil explícito, usa siempre `balanced`.

## Salida

Empieza siempre por `Ruta recomendada:` e incluye:

- Superficie: Chat, Work o Codex.
- Modelo: Luna, Terra, Sol o Astra.
- Razonamiento: Low, Medium, High o XHigh.
- Complejidad: 1-10.
- Consumo relativo: muy bajo, bajo, medio, alto o muy alto.
- Confianza y motivo breve.
- Rúbrica: `R1` y criterios de complejidad activados.

Añade `Por qué esta superficie:` con:

- Una razón concreta por la que la superficie elegida encaja mejor.
- Una línea para Chat, otra para Work y otra para Codex. En la elegida, indica su ventaja; en las otras dos, explica brevemente por qué son menos adecuadas para esta tarea.
- Evita descripciones genéricas. Relaciona la comparación con las herramientas, archivos, investigación, código, duración y número de etapas reales de la petición.

Añade `Cómo aplicar la recomendación:`. Indica que el usuario debe seleccionar manualmente `<modelo> · <razonamiento>` en los controles situados bajo el cuadro de texto. No prometas ni insinúes que AI Router ha cambiado esos controles.

Termina con: `No he ejecutado la tarea. Selecciona <modelo> · <razonamiento> y responde "listo" cuando lo hayas aplicado. Si prefieres mantener la configuración actual, responde "continuar sin cambiar".`

## Confirmación posterior

- Si la siguiente respuesta es solo `sí`, `vale`, `continúa` o una confirmación ambigua, no ejecutes todavía. Pregunta si ya ha seleccionado manualmente la configuración recomendada y vuelve a pedir `listo` o `continuar sin cambiar`.
- Ejecuta la tarea solo si el usuario responde `listo`, afirma explícitamente que ya cambió el selector, o pide `continuar sin cambiar`.
- Si responde `listo`, continúa con la tarea en la superficie actual y bajo la configuración que el usuario declara haber aplicado.
- Si responde `continuar sin cambiar`, continúa sin afirmar que se está usando el modelo o razonamiento recomendado.

No incluyas la solución de la tarea original en esa respuesta.
