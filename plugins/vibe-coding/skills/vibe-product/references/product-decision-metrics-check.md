# Product Decision & Metrics Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one selected product decision, requirement, journey step, or metric/event contract through bounded evidence. This check proves alignment; it does not redesign the product or perform a broad audit.

## Required specialization

Provide the product decision or requirement, target actor/state, expected behavior, metric/event or acceptance criterion, safe environment, and validation route. If the required decision is missing or contradictory, return `blocked`.

## Check scenarios

Exercise or inspect only the selected contract:

- happy path and relevant empty/error/no-access/no-plan/over-quota/destructive states;
- UI/API/backend consistency for the same actor and scope;
- analytics event name/properties/timing/dedup/identity when metrics are part of the requirement;
- copy/docs claims against observable behavior;
- test or preview evidence for the owner-layer behavior.
