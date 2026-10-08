# Finding standard

A finding is actionable when all are present:

1. Changed location that creates the behavior.
2. Concrete input, interleaving, failure, or rollout state.
3. Observable correctness, security, compatibility, availability, or operational impact.
4. Causal path from the code to that impact.
5. Smallest correction when the design evidence supports one.

Do not report a concern already prevented by a constraint in the same path. Distinguish unverified risk from demonstrated defect.
