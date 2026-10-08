---
name: powerbi-fabric-nextgen-usps
description: "Use when a Power BI or Fabric team needs FinOps, Copilot answer regression, Direct Lake readiness, data-product SLOs, capacity change proof, or executive decision traces."
---

# Power BI And Fabric Next-Generation USPs

Run the local pack first:

```powershell
.\plugins\powerbi-desktop\scripts\Invoke-PowerBINextGenUspPack.ps1 -Path .\your-model -OutputDirectory .\powerbi-nextgen-usp-pack
```

It produces six machine-readable artifacts: Fabric FinOps Copilot, Copilot Answer Regression Lab, Direct Lake/OneLake Readiness, Data Product SLO Manager, Capacity Change Verifier, and Executive Decision Trace.

- Treat FinOps, Direct Lake, and decision outputs as decision support unless live/snapshot evidence is attached.
- The Copilot lab creates test cases; it does not claim a Copilot answer was validated until an approved answer capture is supplied.
- Capacity savings require before/after Capacity Metrics or CU evidence.
- Never access Fabric with a token or change service state unless the user explicitly requests it.
