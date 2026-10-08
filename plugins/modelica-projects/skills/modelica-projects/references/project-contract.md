# Modelica project contract

Use this minimum shape for a reusable project named `ExampleSystem`:

```text
ExampleSystem/
├── package.mo
├── package.order
├── GettingStarted.mo
├── Conventions.mo
├── Components/
│   ├── package.mo
│   ├── package.order
│   └── Plant.mo
└── Examples/
    ├── package.mo
    ├── package.order
    └── NominalOperation.mo
ExampleSystemTests/
├── package.mo
├── package.order
└── PlantTest.mo
```

## Filesystem mapping

- The top-level `ExampleSystem/package.mo` declares `package ExampleSystem` and has no `within` clause or uses `within;`.
- `ExampleSystem/Components/package.mo` begins `within ExampleSystem;` and declares `package Components`.
- `ExampleSystem/Components/Plant.mo` begins `within ExampleSystem.Components;` and declares `model Plant`.
- Each `package.order` lists direct child classes and subpackages once, in intended display/load order.
- Use UTF-8 without a byte-order mark.

## Required project content

- State the physical boundary and sign conventions.
- Use Modelica Standard Library connectors and SI types where possible.
- Document every class, parameter, variable, connector, and assumption.
- Include at least one runnable example with meaningful experiment settings.
- Add tests for components and at least one system-level acceptance or conservation check.
- Keep source resources under `Resources/` and reference them through `modelica:/Package/...` URIs.
- Declare library dependencies with a `uses` annotation on the top-level package.

## Verification matrix

Report each lane independently:

| Lane | Evidence |
| --- | --- |
| Static structure | `static_check_modelica.py` passed |
| Flatten/translate | A named Modelica compiler successfully flattened the named classes |
| Native build | A named Modelica tool generated and compiled the simulation executable |
| Simulation | A named tool completed the representative example with stated solver/settings |
| Numerical checks | Assertions, conservation, analytic limits, or regression expectations passed |
| Visual presentation | Standard icons, diagrams, or plots inspected in the named tool |
| Physical validity | Assumptions and results reviewed against domain evidence |

Never collapse these into a single “validated” claim.
