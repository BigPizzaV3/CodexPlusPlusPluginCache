---
name: powerbi-constraint-aware-planning
description: Use when constraining Power BI revenue planning by delivery, capacity, stock, supply, margin, cash, payment terms, sales resources, or operational feasibility rather than forecasting unconstrained demand only.
---

# Power BI Constraint-Aware Planning

Use this skill when autonomous planning must respect operational limits.

## Constraint classes

- delivery: planned date, requested date, delay, shipment risk
- inventory: stockout, substitute availability, item lifecycle
- capacity: production, picking, shipping, service bottlenecks
- commercial: margin, discount, price change, payment terms
- customer: block status, churn risk, buying cadence, credit risk
- sales: owner capacity, account priority, campaign timing

## Workflow

1. Start from an unconstrained forecast or target scenario.
2. Apply constraints as filters or down-weighting factors.
3. Produce both unconstrained and constrained values.
4. Explain every material reduction.
5. Mark missing constraints as `unknown`, not as zero risk.

## Required outputs

- `forecast_month`
- `customer`
- `product`
- `unconstrained_forecast`
- `constrained_forecast`
- `constraint_type`
- `constraint_severity`
- `revenue_blocked`
- `evidence`
- `recommended_resolution`

## Guardrails

- Never assume demand can convert when delivery or credit constraints contradict it.
- Keep constraint assumptions auditable and separate from statistical demand.
