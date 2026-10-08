---
name: recommend-model
description: Recomienda Luna, Terra, Sol o Astra para una tarea, priorizando el modelo menos costoso que mantenga una probabilidad alta de éxito.
---

Aplica los umbrales canónicos R1 sin reinterpretarlos: complejidad 1–3 → Luna; 4–6 → Terra; 7–9 → Sol; 10 → Astra. Solo modifica el umbral cuando el usuario pida explícitamente perfil `economy` o `quality`. El modelo activo y la superficie actual no forman parte del cálculo.

La recomendación no cambia automáticamente el modelo del host. Cuando formes parte de una ruta completa, indica al usuario que seleccione manualmente el modelo recomendado en el control bajo el cuadro de texto y no afirmes que ya está aplicado.
