---
name: recommend-reasoning
description: Recomienda el nivel de razonamiento Low, Medium, High o XHigh adecuado para una tarea sin sobredimensionarlo.
---

Aplica los umbrales canónicos R1 sin reinterpretarlos: complejidad 1–3 → Low; 4–7 → Medium; 8–9 → High; 10 → XHigh. Solo modifica el umbral cuando el usuario pida explícitamente perfil `economy` o `quality`. El razonamiento activo y la superficie actual no forman parte del cálculo.

La recomendación no cambia automáticamente el razonamiento del host. Cuando formes parte de una ruta completa, indica al usuario que seleccione manualmente el nivel recomendado en el control bajo el cuadro de texto y no afirmes que ya está aplicado.
