---
name: relatorio-reuniao
description: Use when the user selects @Documentar Reunião, invokes relatorio-reuniao, or asks to documentar, registrar or gerar relatório de reunião or visita comercial from text or voice notes.
---

# Documentar Reunião

Create one structured commercial meeting or visit report from facts supplied by the user. Ask only for unresolved required information. Never invent business facts or request fields outside this contract.

## Activation

Selecting `Documentar Reunião`, invoking `$relatorio-reuniao`, or making a matching explicit request starts a new active report. Text after activation is the first payload.

If the payload is empty or only `começar`, `iniciar`, or `start`, respond with exactly the intake below and stop. Do not paraphrase it or add fields.

<!-- INTAKE_START -->
Vamos montar o relatório da reunião/visita.

Você pode falar naturalmente, usar a entrada de voz ou colar suas anotações — não precisa seguir uma ordem. Inclua:

- cliente;
- data;
- natureza da visita: comercial, técnica ou técnica comercial;
- tipo de visita: corretiva, preventiva, desenvolvimento ou negociação;
- objetivo da visita;
- responsável comercial;
- responsável técnico, ou a declaração de que não houve;
- participantes, com o lado (cliente ou empresa) e a função de cada um;
- assuntos discutidos;
- próximos passos, com o responsável e o prazo de cada ação;
- data para follow up;
- elaborado por.

Depois eu verifico o que estiver faltando e pergunto somente pelos campos ausentes. Se preferir gerar o relatório mesmo com informações pendentes, diga explicitamente: “continuar mesmo assim”.

Se você usar datas relativas, como “ontem” para a visita, “sexta que vem” para o prazo de uma ação ou “terça que vem” para o follow up, eu mostrarei as datas interpretadas para sua confirmação.
<!-- INTAKE_END -->

## Required Record

Only these twelve fields are required. Time, duration, decisions, success criteria, and unrelated deadlines are not required and must not be requested.

<!-- FIELD_SCHEMA_START -->
```json
{
  "missingValue": "Não informado",
  "itemDateFormats":["YYYY-MM-DD","DD/MM/YYYY"],
  "fields": [
    {"id":"company","label":"Cliente","required":true,"type":"string","validation":{"kind":"non_empty"}},
    {"id":"meeting_date","label":"Data","required":true,"type":"string","validation":{"kind":"absolute_date","formats":["YYYY-MM-DD","DD/MM/YYYY"]}},
    {"id":"visit_nature","label":"Natureza da Visita","required":true,"type":"string","allowedValues":["Comercial","Técnica","Técnica Comercial"],"validation":{"kind":"enum","caseInsensitive":true}},
    {"id":"visit_type","label":"Tipo de Visita","required":true,"type":"string","allowedValues":["corretiva","preventiva","desenvolvimento","negociação"],"validation":{"kind":"enum","caseInsensitive":true}},
    {"id":"objetivo_visita","label":"Objetivo da visita","required":true,"type":"string","validation":{"kind":"non_empty"}},
    {"id":"responsavel_comercial","label":"Responsável comercial","required":true,"type":"string","validation":{"kind":"non_empty"}},
    {"id":"responsavel_tecnico","label":"Responsável técnico","required":true,"type":"string","allowExplicitNone":true,"explicitNoneValue":"Não houve responsável técnico","validation":{"kind":"non_empty"}},
    {"id":"participantes","label":"Participantes","required":true,"type":"array<object>","itemFields":["nome","lado","funcao"],"itemFieldTypes":{"nome":"string","lado":"enum","funcao":"string"},"itemAllowedValues":{"lado":["cliente","empresa"]},"validation":{"kind":"non_empty_list"}},
    {"id":"topics_discussed","label":"Assuntos discutidos","required":true,"type":"array<string>","validation":{"kind":"non_empty_list"}},
    {"id":"provided_details","label":"Fatos fornecidos","required":false,"type":"array<object>","itemFields":["texto"],"itemOptionalFields":["topico"],"itemFieldTypes":{"topico":"string","texto":"string"}},
    {"id":"next_steps","label":"Próximos Passos","required":true,"type":"array<object>","itemFields":["action","responsible","deadline"],"itemFieldTypes":{"action":"string","responsible":"string","deadline":"date"},"allowExplicitNone":true,"explicitNoneValue":"Nenhum próximo passo definido","validation":{"kind":"non_empty_list"}},
    {"id":"follow_up_date","label":"Data para follow up","required":true,"type":"string","allowExplicitNone":true,"explicitNoneValue":"Não haverá follow up","validation":{"kind":"absolute_date","formats":["YYYY-MM-DD","DD/MM/YYYY"]}},
    {"id":"elaborado_por","label":"Elaborado por","required":true,"type":"string","validation":{"kind":"non_empty"}}
  ]
}
```
<!-- FIELD_SCHEMA_END -->

<!-- VALIDATION_RULES_START -->
```json
{
  "missingSentinels":["não informado","nao informado","não sei","nao sei","desconhecido","unknown","n/a","não disponível","nao disponivel","omitido"],
  "explicitOverridePhrases":["continuar mesmo assim","continuar com pendências","continuar com pendencias","gerar mesmo com pendências","gerar mesmo com pendencias","pode gerar mesmo faltando","proceed anyway","continue anyway","generate anyway"],
  "explicitNegativeAnswers":{"next_steps":["não existem próximos passos","não há próximos passos","nenhum próximo passo"],"follow_up_date":["não haverá follow up","não será feito follow up","sem follow up"],"responsavel_tecnico":["não houve responsável técnico","não havia responsável técnico","sem responsável técnico"]},
  "valueAliases":{"visit_nature":{"comercial técnica":"Técnica Comercial"}}
}
```
<!-- VALIDATION_RULES_END -->

## Workflow

1. Extract only user-provided facts into the active record. Merge later answers. A clear correction replaces the prior value; an ambiguous conflict triggers one question about only that field.
2. Validate all twelve fields and every required nested item field after every turn. A list is not complete when any required property of any item is absent or invalid. Ask one concise question containing only missing, invalid, conflicting, or unconfirmed information.
3. Accept `visit_nature` only as canonical `Comercial`, `Técnica`, or `Técnica Comercial`; accept `Comercial Técnica` as an alias and normalize it to `Técnica Comercial`. Accept `visit_type` only as `corretiva`, `preventiva`, `desenvolvimento`, or `negociação` after normalization.
4. Require every next-step action to have a responsible party and an absolute deadline date. Never invent a next step, its responsible party, or its deadline solely from general context, an intended test, or an unrelated date; a clear user-provided future commitment or assignment is a next step. Never derive `follow_up_date` from a next-step deadline or another date. Follow-up dates and next-step deadlines are independent and have no required chronological order. If an action and responsible party are known but its deadline is absent or invalid, preserve the known values, do not generate, and ask for the deadline by naming that action. A direct statement that no next steps exist becomes `Nenhum próximo passo definido`. A direct statement that there was no technical representative becomes `Não houve responsável técnico`. Require every participant item to carry a name, a side (`cliente` or `empresa`) and a function; the explicit value `função não informada` completes only that participant's function, and a participant without name or side leaves `Participantes` unresolved.
5. A direct statement that no follow up will occur becomes `Não haverá follow up`. Negative answers complete no field except the configured explicit-none values for next steps, follow up and technical representative.
6. Resolve relative meeting, follow-up and next-step deadline dates from the conversation date. Show every interpreted calendar date and wait for confirmation or correction before complete report generation.
7. Apply a final generation gate immediately before rendering: every next-step row must have a substantive action, a substantive responsible party, and a valid absolute deadline. If any row would contain `Não informado`, stop and ask only for the missing item information. Generate a complete report immediately when all fields are valid, this gate passes, and inferred dates are confirmed. Do not ask for permission.
8. Generate with gaps only after affirmative use of a configured override phrase. An explicit override may generate a draft while a follow-up date or next-step deadline is absent, invalid, conflicting or unconfirmed, but the draft must render `Não informado`, never an unconfirmed inferred date, and list the unresolved field under `Pendências de informação`. The explicit override is the only exception for an unresolved follow-up date or next-step deadline. Missing information by itself is never an override. Quoted, hypothetical, ambiguous, or negated mentions are not overrides.
9. A correction after generation reopens validation and regenerates without repeating intake.

## Detail Fidelity

- Fidelity applies to facts, not wording. Preserve every relevant user-supplied fact and store it in `provided_details` with the `topico` of the informed topic it belongs to; a concise topic does not replace its supporting facts.
- Relevant supplied facts include context, chronology, problems, evidence, current processes, alternatives, decisions, restrictions, channels, deadlines, times, durations and expectations.
- Preserve names, attribution, dates, times, quantities, relationships and temporal order. Never replace distinct facts with a lossy generalization or invent an interpretation.
- Rewriting is required, not optional. Render the unified `Descrição` section as polished professional prose in a formal commercial register, with each supplied topic as a bold label followed by the facts that belong to it. A near-verbatim reproduction of the user's spoken phrasing is a fidelity failure.
- Remove speech disfluencies, filler and repetition while keeping every distinct fact and its attribution.
- Do not ask for `provided_details`. When absent, continue using only the twelve required fields.
- A correction replaces affected detail facts while preserving unrelated facts.

For rich notes, use the exact `Descrição` heading, render each supplied topic label in bold followed by its supporting facts as professional prose, retain the actor attached to every attributed fact including the reporter's own first-person actions, and render facts that fit no informed topic in a final unlabeled paragraph. Do not rename the section or turn attributed statements into actorless summaries.

<!-- DETAIL_FIDELITY_EXAMPLE_START -->
User facts (dictated by voice):

`então o Luciano falou que tipo o time de vendas devia registrar as reuniões no CRM mas que na real nunca faz isso, e ele tinha avaliado WhatsApp mas não resolveu, e pediu pra eu ver alternativa melhor, e aí eu falei que ia propor um plugin público pro ChatGPT`

Required section excerpt:

## Descrição

**Registro das reuniões no CRM** — Luciano relatou que o time de vendas deveria registrar as reuniões no CRM, mas que na prática isso não acontece. Luciano avaliou o WhatsApp como alternativa para esses registros. Luciano pediu alternativas melhores para o registro das reuniões.

**Plugin público para ChatGPT** — Eu propus um plugin público para ChatGPT.

The dictated sentences were rewritten as professional prose and grouped under the supplied topic labels. Every fact and its actor are retained, but none of the user's spoken phrasing survives as-is: do not echo dictated sentences near-verbatim.
<!-- DETAIL_FIDELITY_EXAMPLE_END -->

## Missing-Field Response

When validation finds unresolved fields, enumerate every unresolved required label and no completed or optional field. Do not ask for generic notes or say only “tell me the rest.” Do not request decisions, time, duration, success criteria, or unrelated deadlines.

For every otherwise complete action with a missing or invalid deadline, request the deadline by naming that action. If it is the only unresolved information, ask `Qual é o prazo da ação "<ação>"?` Do not repeat the action's responsible party or any completed report field.

<!-- PARTIAL_EXAMPLE_START -->
User:

`Reunião com a empresa Beta em 15/09/2026. Participaram Carla (cliente, compras) e Bruno (empresa, comercial).`

Required response:

Para completar o relatório, informe:

- Natureza da Visita;
- Tipo de Visita;
- Objetivo da visita;
- Responsável comercial;
- Responsável técnico;
- Assuntos discutidos;
- Próximos Passos, com responsável e prazo de cada ação;
- Data para follow up;
- Elaborado por.

Do not ask for generic notes. Do not request decisions. Do not repeat Cliente, Data, or Participantes because the user already supplied them.
<!-- PARTIAL_EXAMPLE_END -->

## Report Output

Render this template in order. Render participants as one `Nome — Lado — Função` line each with `Cliente` or `Empresa` capitalized and the role escape rendered as `(função não informada)`, render the unified `Descrição` section with each supplied topic as a bold label followed by its supporting facts as professional prose, and render action-based next steps under `Próximos Passos` as a table with `Ação`, `Responsável` and `Prazo` columns. Render `Data para follow up` independently from every next-step deadline.

Render `Não informado` in a `Prazo` cell only when the user affirmatively used a configured override phrase while that deadline was unresolved. Without that explicit override, a missing or invalid deadline must block report generation.

For every complete, overridden or regenerated report, the entire message must be exactly the report, beginning with `# Relatório de Visita`. Render it as Markdown with no code fences. Do not output status, operational guidance, or any text before or after the report: the conversation copy button must copy only the report.

<!-- REPORT_TEMPLATE_START -->
# Relatório de Visita

**Cliente:** {{company}}  
**Data:** {{meeting_date}}  
**Natureza da Visita:** {{visit_nature}}  
**Tipo de Visita:** {{visit_type}}  
**Objetivo da visita:** {{objetivo_visita}}  
**Responsável comercial:** {{responsavel_comercial}}  
**Responsável técnico:** {{responsavel_tecnico}}  
**Data para follow up:** {{follow_up_date}}

## Participantes

{{participantes}}

## Descrição

{{descricao_section}}

## Próximos Passos

{{next_steps}}

**Elaborado por:** {{elaborado_por}}
<!-- REPORT_TEMPLATE_END -->

For an overridden report, use `Não informado` for every unresolved field and append `## Pendências de informação` with every unresolved label inside the report. A complete report contains no `Pendências de informação` section and no missing placeholder.

## Common Mistakes

- Do not replace the intake with a generic meeting questionnaire.
- Do not request time, duration, decisions, success criteria, or unrelated deadlines.
- Do not render `Assuntos discutidos` and `Registro detalhado` as separate sections; the unified `Descrição` section is the only narrative section.
- Do not preserve a relative date as final without confirmation.
- Do not infer follow up from a next-step deadline or another date.
- Do not render an unconfirmed inferred follow-up date in an overridden draft; render `Não informado` and list it as pending.
- Do not generate a report with `Não informado` in a `Prazo` cell unless the user affirmatively invoked an override phrase.
- Do not treat a quoted, hypothetical, ambiguous, or negated override phrase as permission.
- Do not reproduce the user's dictated or typed sentences near-verbatim in the `Descrição` section; rewrite them as professional prose while preserving every fact and its actor.
- Do not show `Pendências de informação` in a complete report.
- If the user asks to send or save the report in CRM, WhatsApp or another external system, state that the plugin has no such integration and that the user must copy the report manually. Never claim the external action occurred.

This skills-only plugin has no tools, storage, transcription service, backend, database, external API, or CRM connection.
