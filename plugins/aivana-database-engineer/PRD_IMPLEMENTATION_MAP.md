# PRD Implementation Map

This map links PRD capabilities to the plugin implementation.

| PRD Area | Implementation |
| --- | --- |
| Database inventory | `list_databases`, `list_tables`, `describe_table`, `describe_relationships` |
| Query diagnostics | `explain_query`, `query_stats`, `plan_deep_diagnostics`, `plan_diff_intelligence` |
| Performance advisory | `sql_problem_detector`, `wait_event_root_cause`, `cache_efficiency_advisor`, `capacity_headroom_forecast` |
| Lock and deadlock analysis | `lock_analysis`, `deadlock_simulator`, `incident_analysis` |
| Index analysis | `index_usage`, `index_roi_simulator`, `index_portfolio_optimizer`, `index_retirement_planner` |
| Migration planning | `propose_migration`, `rollback_migration`, `ai_migration_risk_radar`, `migration_twin_simulator` |
| Rollback evidence | `rollback_rehearsal_engine`, `replay_execution`, `change_ticket_exporter` |
| Policy governance | `classify_risk`, `enforce_policy`, `validate_compliance`, `audit_query` |
| Production readiness | `production_readiness_check`, `release_readiness_report`, `production_rollout_orchestrator` |
| Observability | `telemetry_connector_ingest`, `prometheus_connector_ingest`, `grafana_annotation_export`, `observability_signal_router` |
| Knowledge and memory | `retrieve_context`, `semantic_memory_index`, `advisor_memory_recommender` |
| Advisor orchestration | `consultant_brain`, `sql_performance_advisor`, `autonomous_dba_copilot` |
| Closed-loop autonomous operator | `objective_to_ops_plan`, `autonomous_experiment_planner`, `counterfactual_risk_engine`, `decision_evidence_compiler`, `confidence_budget_manager`, `autonomy_boundary_enforcer`, `operator_goal_monitor`, `dry_run_action_critic`, `next_best_safe_action`, `autonomous_ops_briefing` |
| AI cognitive control plane | `ai_strategy_synthesizer`, `cognitive_schema_mapper`, `llm_prompt_risk_auditor`, `ai_decision_simulator`, `autonomous_learning_backlog`, `knowledge_gap_detector`, `ai_trust_scorecard`, `semantic_incident_predictor`, `cross_agent_consensus_builder`, `ai_roi_narrative_generator` |
| DevOps integration | `cross_tool_devops_analyzer`, `vendor_neutral_devops_brain`, `performance_pr_reviewer` |
| Compliance and data safety | `detect_pii`, `rls_masking_router`, `compliance_query_assistant`, `ai_data_contract_guardian` |

## Runtime Components

| Component | Purpose |
| --- | --- |
| `runtime/orchestrator.js` | Dispatches deterministic tool workflows. |
| `runtime/tool-manifest.json` | Declares the runtime tool catalog. |
| `runtime/policyEngine.js` | Applies risk thresholds, approval rules, and production controls. |
| `runtime/riskEngine.js` | Classifies SQL and operational risk. |
| `runtime/sqlSafety.js` | Blocks unsafe SQL patterns in normal execution paths. |
| `runtime/db/baseAdapter.js` | Shared database adapter contract. |
| `runtime/db/postgresAdapter.js` | PostgreSQL connectivity. |
| `runtime/db/sqlServerAdapter.js` | SQL Server connectivity. |
| `runtime/auditLogger.js` | Audit record generation. |
| `runtime/memoryLayer.js` | Local memory and replay integration. |

## Marketplace Packaging

| Requirement | Location |
| --- | --- |
| Plugin manifest | `.codex-plugin/plugin.json` |
| Skills | `skills/*/SKILL.md` |
| Marketplace index | `../../.agents/plugins/marketplace.json` |
| License | `LICENSE` |
| Security policy | `SECURITY.md` |
| Privacy policy | `PRIVACY.md` |
| Support policy | `SUPPORT.md` |
| Contribution guide | `CONTRIBUTING.md` |

## Verification Commands

```bash
npm install
npm test
npm run readiness
npm run readiness:strict
```
