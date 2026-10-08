# Decision Lifecycle

Use these six views when the user asks when a decision expires, which evidence
would unblock it, why it changed, where stakeholders disagree, how to limit a
commitment, or whether a result met its original target. Do not add all six to
every brief. Lead with changed conditions and the next human decision.

1. **Decision Expiry:** Record review deadline, validity conditions, units, source
   references, observation dates, and freshness limits. An unknown observation does
   not pass a condition. An expired decision needs review, not automatic reversal.
2. **Minimum Evidence to Decide:** Ask the accountable owner to declare required
   evidence gates and acceptable alternatives. Find the smallest additional set
   covering those gates. This proves coverage of declared gates only, not sufficiency
   for legal compliance or deployment approval.
3. **Decision Change Receipt:** Compare prior and current explicit models. Report
   changed evidence, affected variables/options, preference change, and unchanged
   assumptions. Preserve abstention and historical model snapshots.
4. **Disagreement Map:** Separate explicitly stated factual positions, goals, and
   risk preferences. Different wording is a difference to clarify, not proof of
   contradiction. Do not infer personal motives or label a person irrational.
5. **Reversible Commitment:** Propose bounded experiments with cost/unit/limit,
   duration, rollback, stop condition, learning question, owner, and human approval.
   Cheapest is not necessarily most informative; state the selection criterion.
6. **Decision Outcome Proof:** Compare a dated observation against a success criterion
   defined before commitment, with matching metric and units. Approval is not an
   outcome. A target met does not prove the decision caused the result.

In the source checkout, run `python engine/cli.py decision-lifecycle --input <context.json>`.
The structured contract and synthetic example are documented in
`docs/decision-lifecycle.md` and `engine/examples/decision_lifecycle.json` in the source
repository. These runtime files are not included in the skills-only package. Without
the runtime, use a qualitative table and do not claim an exact minimum-set calculation.
No background monitoring, connectors, execution, or automatic memory writes are enabled.
