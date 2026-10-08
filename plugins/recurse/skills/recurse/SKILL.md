---
name: recurse
description: Build and run custom agents with Recurse for tasks that benefit from test-time compute and iterative refinement. Examples include design exploration, performance optimization, and generating artifacts that improve through verification and revision. Use this skill when designing an adaptive component that solves a specific problem. When necessary, clarify uncertain requirements on the goal and constraints.
---

# Recurse

Recurse hosts custom agents that work with Python tools. You shape the task, tools, and verifiers to define custom agents, they iterate on candidate results without you supervising their every step. You author the agents locally; `recurse run` executes them on a serverless runtime. Deploying a custom agent as an MCP makes it available for ongoing future use.

## When to choose Recurse

Recurse is especially useful when:
- The task is amenable to iterative approaches where feedback can guide successive refinement of a candidate result, or exploration of other candidates.
- There are many such approaches to try.

This involves a substantial search over a design space: try variants, tune performance, refine artifact quality. The aim is to discover progressively better approaches (e.g. tools, prompts, verifiers) to improve the objective while meeting constraints. The best achievable result need not be known.

For example:
- **Design a lighter mounting bracket.** Given a CAD model, material, and load cases, find a lighter manufacturable design that satisfies strength and stiffness limits. A general-purpose harness can make an edit and run a simulation, but a thorough exploration requires many competing attempts. A Recurse agent varies geometry, uses numerical stress and displacement checks, and preserves the lightest feasible candidate.
- **Generate diverse puzzle levels.** Produce levels matching a concept, mechanic mix, difficulty, and play time while avoiding similarity to a growing corpus. This is a multidimensional search requiring substantial trial and error; general-purpose harnesses tend to follow a generic workflow and drift from the search objectives. A Recurse agent explores variants using solvability verifiers and numerical measures of mechanic usage, solution length, difficulty, and corpus similarity.
- **Generate 3D objects at scale.** A general-purpose harness can create a one-off 3-D model of a bag or a shoe from a picture, but handcrafting the last object-specific details makes scaling impractical. Many objects share common construction and rendering operations, but details like straps, pockets, soles, and laces require special tools. Recurse agents iterate through tool combinations and compare renders. When missing capabilities block progress, you arm the agents with new tools, expanding what future incarnations can produce.

## The Recurse harness

A Recurse agent calls an LLM in a special, serverless harness whose FSM structure guides the LLM to iteratively solve problems via Python tools. You focus on defining the prompt, tools, and verifiers for your custom agent, create an `agent.yaml` manifest file to inventory them, and use the Recurse SDK to bundle them for execution in the harness. The harness executes the LLM's tool calls, retains their results, and presents measurements/errors to the LLM for reasoning and decision-making. This lets it explore alternatives and refine results across iterations.

The LLM may request several tool calls at the same time, and chain one tool's result into another. The harness automatically resolves such dependencies: calls wait for the values they require, while independent calls can run simultaneously for fast execution. Not all tool composition has to take place over a single iteration: the harness provides a way for the LLM to store tool return values in program memory as Python objects, collect results over multiple rounds, and compose them together when it has all the values it needs. In such cases, the LLM can simply refer to past return values without needing to reproduce them in its responses. To generate artifacts for retrieval after the run, simply provide a tool that writes a file under `recurse.context().workspace`.

When registering tools in the manifest file, you can use the following parameters to configure the harness in order to fine-tune or optimize your tools' interaction with Recurse.

| Concept | How it works |
| --- | --- |
| `storable` | Controls whether a tool allows the harness to save its return value in program memory. By default, a non-`None` return type enables it. Only disable this for tools that produce nothing but textual results for the LLM context, and/or no Python object that can compose with others. |
| `no_storage` | Parameter names to exclude from Python object passing, forcing the LLM to supply inline values. Use this for identifier or control-flag parameters where Python object storage/passing is unnecessary. Default: empty list. |
| `volatile` | Set to `true` when identical arguments can produce different results, such as sampling or querying a simulator with inherent randomness. The LLM may call such tools with identical arguments, or in recurring patterns, without alerting the harness of a stuck loop. Default: `false`. |
| `pure_args` | Parameter names the tool guarantees not to mutate in place. Recurse uses this to plan/optimize the execution of tool calls. Default (empty list) is conservative (no purity); use ``null`` as a shortcut to indicate "all parameters are pure". It is important to declare this correctly, otherwise tools may race and produce incorrect results. This is an optimization flag; when unsure, use the default value. |

## Start with a proposal

The user may not provide full clarity on:
- The input/output contract, artifact formats (if any), or sample inputs/outputs.
- A clear objective/goal to optimize for.
- Verification methods to use
- Any hard constraints
- Time and/or spending allowances

Before any cloud work, come up with a concrete proposal that offers clarity on these. In this process, ask about ambiguities that materially affect usefulness; state narrow assumptions for routine details. Translate general intent into constraints, checks and verifiers. Try to use arbitrary weights or acceptance thresholds as sparingly as possible. When unavoidable, present them as proposals with their trade-offs.

When proposing a plan, explain your framing of the problem, how you plan to solve it, and why it fits. If you recommend Recurse, explain what the custom agent will own; describing a generic loop alone leaves that unclear.

## Agent design and learning from evidence

Keep tools intentional: actions apply the agent's choices or proposals; independent verifiers return measurements, validation results, and corrective diagnostics; and a termination tool decides whether the task is complete and, if so, saves the final result and an authoritative receipt. Do not leak target answers or weaken acceptance criteria. See [tool guidance](#authoring-tools).

Start with a baseline approach. Since Recurse allows you to run multiple agents in parallel, always consider which distinct approaches you can explore in parallel. Use concurrent exploration whenever the approaches are independent and your allowance supports it; use sequential attempts when later choices depend on earlier results. Discuss your parallelism strategy in the plan.

When running agents in parallel, make sure to provide the necessary isolation when/if necessary. Evaluate, inspect or score results of candidate agents with the same criteria, make sure not to compare apples with oranges in cases where you co-evolve evaluation criteria with the agents. Choose concurrency to fit the work and resources, not an arbitrary worker count.

When necessary, revisit whether the constraints, the verification tools or your evaluation mechanism still capture the user's intent as you inspect results or encounter new kinds of inputs. For example, when building an object reconstruction agent that creates 3-D models from 2-D images, a check that captures a backpack's shape may overlook a shoe's laces. Use those mismatches to strengthen or generalize the concrete interpretation of the same intent, retaining earlier requirements. Version verifiers, checks and evaluation criteria as you revise them; re-evaluate baseline and contenders consistently; keep old scores as history rather than ranking scores from different evaluators together. Agree materially new requirements with the user before changing what counts as acceptable.

Form theses (multiple at a time, if you can) on how you improve the agent. Within your parallelism budget, try to validate these theses and see if they result in actual improvement. Prefer small changes to prompt, tools, or verifiers to large re-architectures unless you have data suggesting the latter is necessary. Compare success, quality, trials, time, and cost on the same cases, criteria, and budgets; repeat variable results. Repairing or improving one case is not proof of generalization, you must have a clear reasoning as to how/why each thesis helps. Conversely, do not invalidate a thesis only because of metric/measurable regressions. Invalidating a thesis requires resolving the conflict between your initial reasons for formulating the thesis, and the empirical results. Doing this carefully may help you repair a faulty implementation of an otherwise useful thesis, or else extract the necessary learnings to formulate better theses.

Separate feasibility from quality. All checks must pass before a candidate can win on its objective. A high score cannot compensate for an unmet requirement. Preserve the best feasible candidate when later attempts regress. If your agents consistently fail to produce feasible results, scrutinize tools and verifiers.

### Prompting

Create a `prompts.md` file to house your custom agent's instructions for the specific problem it will solve, and set `agent.prompt: prompts.md` in `agent.yaml`. Use the final proposal, the actual tools, and verifiers as a starting point and/or a reference. Explain the following clearly:
- What outcome to improve, how to measure it, and what makes one feasible result better than another.
- Which requirements are hard constraints, what degrees of freedom the agent can explore, and which domain facts constitute implicit constraints.
- What the verifiers measure, how those measurements relate to the overall goal and constraints, and what they do not establish. Include domain knowledge necessary to interpret failures and trade-offs.
- What defines completion or convergence for the agent; i.e. when does the agent stop iterative refinement and report results.
- What evidence and artifacts the agent must return; and any conditions, allowances or restrictions that the agent must comply with.

For the mounting-bracket example, you would explain that the agent is searching for lower mass while meeting strength, stiffness, and manufacturing requirements under the given material and load constraints. You would describe how the available checks and verifiers establish those requirements. You would instruct the agent to explore geometric changes and competing design patterns (maybe along with certain tactics for doing so); but not prescribe a sequence of CAD edits.

Encourage the agent to develop hypotheses, explore alternatives, accept/reject hypotheses with the methodology in your instructions above, and use results to decide which avenues merit further work. Give it enough domain context to make those decisions independently. Do not turn the prompt into an ordinary workflow without iterative refinement unless the problem is very simple. Do not dictate one tool call per turn, or supply a sequence of candidate answers.

Tool signatures and parameter instructions belong in tool docstrings (see [tool guidance](#authoring-tools)); the prompt explains how the tools support this problem's objective.

In certain classes of problems, you may want to use "control" inputs and vary them during agent design. Use the `{{ input.NAME }}` substitution mechanism to interpolate control inputs into `inputs.task`. Use this facility to experiment with control knobs, vary the instructions in `prompts.md` to make "architectural" changes.

Improve the prompt from the runs you observe. If agents consistently misinterpret a measurement, ignore a constraint, or explore an unproductive part of the search space, identify the missing or misleading instruction. Revise the prompt and compare with the baseline on the same cases, verifiers, and allowances. A longer prompt or a successful single run does not establish improvement on its own.

### Authoring tools

Define tools as top-level Python functions in your application's tool file, usually `tools.py`. Each function's name becomes its tool name. Prefix helpers with `_`.

The harness uses each function's Google-style docstring to describe the tool to the LLM. The summary, body, and `Returns:` section become the tool description; `Args:` entries become parameter
descriptions, and type annotations supply the schema. Write these as instructions the LLM will use to choose and call the tool: explain its purpose, constraints, effects, inputs and its return value.

You must fully annotate parameters and returns. When using generic types (e.g. `list`), supply the type parameter(s) whenever possible; the harness reflects this information in the JSON schema of the tool to better guide the LLM. Do not use bare generics unless there really are no constraints on the type parameter(s), or they are really unknown.

Include an `Args:` entry for every parameter and a `Returns:` description for non-`None` results, including units or valid ranges. Omit `Returns:` for `-> None`. Use safe defaults and raise errors that report not only what was wrong, but also what the agent can correct. Keep tools to the point and safe to retry where possible. Never use mutable global variables to share "hidden state" across tools. The harness cannot see such dependencies, and this may result in incorrect execution schedules.

For example, the following two tools demonstrate construction, an independent measurement, and a state object. The measurement is illustrative; but the style is suggestive. Use the actual domain validators for your application.
```python
from dataclasses import dataclass

type Point = tuple[float, float]
"""A 2-D point."""


def _cross(o: Point, a: Point, b: Point) -> float:
    """Compute the z-component of the cross product of ``(a - o)`` and ``(b - o)``.

    A positive result indicates a left turn, a negative result a right turn, and zero indicates collinearity.

    Args:
        o: Reference point to calculate the cross product against.
        a: The first term of the cross product.
        b: The second term of the cross product.

    Returns:
        The z-component of the cross product.
    """
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _on_segment(p: Point, a: Point, b: Point) -> bool:
    """Whether ``p`` lies on the closed segment between ``a`` and ``b``.

    Args:
        p: The query point.
        a: The first endpoint of the segment.
        b: The last endpoint of the segment.
    """
    return (
        _cross(a, b, p) == 0
        and min(a[0], b[0]) <= p[0] <= max(a[0], b[0])
        and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])
    )


@dataclass(frozen=True)
class Polygon:
    """A simple, non-self-intersecting polygon with at least three vertices."""

    points: tuple[Point, ...]
    """Points on the periphery of the polygon."""

    def __post_init__(self) -> None:
        pts = self.points
        n = len(pts)
        if n < 3:
            raise ValueError("Cannot define a polygon with fewer than three points")

        edges = [(pts[i], pts[(i + 1) % n]) for i in range(n)]

        # 1. No vertex may lie on an edge it isn't an endpoint of.
        for k, p in enumerate(pts):
            for i, (a, b) in enumerate(edges):
                if i not in (k, (k - 1) % n) and _on_segment(p, a, b):
                    raise ValueError(f"Vertex {k} lies on edge {i}")

        # 2. No two edges may properly cross.
        for i in range(n):
            for j in range(i + 1, n):
                (p1, p2), (q1, q2) = edges[i], edges[j]
                if (
                    _cross(q1, q2, p1) * _cross(q1, q2, p2) < 0
                    and _cross(p1, p2, q1) * _cross(p1, p2, q2) < 0
                ):
                    raise ValueError(f"Edges {i} and {j} cross")


def build_polygon(points: list[Point]) -> Polygon:
    """Construct a non-self-intersecting polygon from the points on its periphery.

    Args:
        points: Points on the periphery of the polygon. Each point connects with the next via an edge. The last point in the list connects with the first point. The points must define a non-self-intersecting polygon.

    Returns:
        The ``Polygon`` the given list of points represents.

    Raises:
        ValueError: If fewer than three points are given, or if the points define a self-intersecting polygon.
    """
    return Polygon(tuple(points))


def measure_area(polygon: Polygon) -> float:
    """Measure the given polygon's area.

    Args:
        polygon: The polygon whose area to measure.

    Returns:
        Area of the given polygon.
    """
    vertices = polygon.points
    n = len(vertices)
    area = 0.0

    # Shoelace formula: sum the cross products of consecutive vertices.
    for i in range(n):
        x_i, y_i = vertices[i]
        x_j, y_j = vertices[(i + 1) % n]
        area += x_i * y_j - x_j * y_i

    return abs(area) / 2.0
```

In `agent.yaml`, set `tools.source` to the application-relative path of the tool file. Register every public function implementing a tool in that file by its exact name in `tools.register`:
```yaml
tools:
  source: tools.py
  register:
    build_polygon: ~
    measure_area: ~
```

`~` uses the defaults. Set per-tool `volatile` or `storable` individually when necessary; use `tools.defaults` for settings common to all tools. The `tools.built_in` flag (default: `true`) enables/disables built-in tools like note-taking, TODO management and planning, and others.

#### Designing tools that compose

Return values that other tools can accept directly. In the example, `build_polygon` returns a `Polygon` and `measure_area` accepts a `Polygon`, enabling the agent to chain them without reconstructing the candidate. The agent chooses whether and when to use that chain.

Carry results and evolving state through parameters with intentional types and return values. Returning only a prose report or transmitting results through mutable globals hides the relationship between tools. Properly describe the return value (and its uses, if not obvious) in the docstring, so the agent can recognize useful combinations.

#### Actions, validators, and results

Action tools apply the agent's choices: construct candidates, edit them, or take a certain step to interact with some external system. They may enforce syntax and domain invariants to facilitate failing fast. Validator tools use independent verifiers (e.g., tests, scorers, simulators, solvers, queries) to gauge feasibility or outcome quality. They return observable measurements and concise diagnostics that can influence the next action. Independence of validators from action tools is very important; the former encodes *what* a good outcome is, the latter encodes *how* to make progress towards it. Validators must not tautologically rubber-stamp results.

Give the agent one explicit completion tool that decides whether the task is complete, and if it is, returns the best candidate along with an authoritative receipt. Register it alongside the action and validator tools. Use artifacts for durable evidence and larger files; do not make an artifact the only explanation of the result. The agent's final JSON must match `outputs` in `agent.yaml`, and agree with the receipt.

Inside tools, `recurse.context().inputs` is a read-only mapping of caller inputs (excluding the `inputs.task`, which becomes part of the prompt). Write artifact files under `recurse.context().workspace`.

### Never do these

- Narrow the agent into an ordinary workflow that decides every action in advance unless the problem is very simple and solvable through such an approach.
- Limit the agent to executing one tool at a time regardless of actual dependencies. The harness handles tool execution schedules automatically.
- Use mutable global variables to transmit tool results or evolving run state. Doing this may result in tool races.
- Accept a candidate's quality with no independent validation.
- Weaken constraints or acceptance criteria to manufacture success.
- Compare candidates with incompatible evaluators or allowances.
- Overwrite/lose the best feasible candidate while exploring worse attempts.
- Claim an artifact, successful result, or global optimum without supporting evidence.

## When to finalize an agent design

Use a real acceptance target if the user provides one. Otherwise, judge diminishing returns by tracking gains, remaining approaches, and the cost of another attempt. Explain/justify that judgment using the history of runs; an arbitrary number of low-gain attempts alone does not establish diminishing returns. Do not invent arbitrary score thresholds or claim global optimality unless you have strong evidence for it. Track aggregate usage across runs and retain hard limits. Do not start work that cannot fit the remaining allowance.

Before normal completion, save the best agent design and return its measurable facts. State whether you are stopping due to acceptance, diminishing returns, a resource limit, or a blocker. A runtime timeout is not evidence of diminishing returns. After an abrupt failure, report only the evidence you have; do not assume that an artifact exists if you cannot locate it. Diagnostic artifacts are not final results.

## Package the agent

```text
my-agent
├── agent.yaml      # Identity, runtime, prompt path, input/output schemas, tools
├── prompts.md      # Instructions for the custom agent
├── tools.py        # Python tools with type annotations and their supporting classes
├── pyproject.toml  # Dependencies and explicit package build backend
└── uv.lock         # Exact dependency lockfile generated by uv
```

Use Python 3.14 or newer. Install the CLI with `pip install recurse-sdk`. The application needs `agent.yaml`, `pyproject.toml` with an explicit build backend, `uv.lock`, and its prompt and tools. Configure the backend to include the exact lockfile and all runtime files in the source distribution; exclude `.env`, caches, and virtual environments. Add `recurse-sdk` to the application dependencies if tools import `recurse`.

Select a model in `agent.model`, such as `gpt-6-astra`, or omit it for the service default, currently `gpt-5.6-luna`. Preparation records that selection with the version; unsupported models fail. There is no model CLI flag; deploy a new version to change the model. Compare quality and cost before choosing a more expensive model.

## Run or reuse

Use `run` for a one-off execution or while shaping/designing new agents. Deploy as MCP after evidence shows the agent is reusable.

```sh
recurse login
recurse run ./my-agent --inputs inputs.json
recurse deploy ./my-agent --as mcp
```

Runs have a 15-minute execution limit. Use `recurse status <run-id>` to inspect the run or `recurse cancel <run-id>` to request cancellation. Download available artifacts within 24 hours using `recurse artifacts <run-id> --output results`.

Connect an MCP host via `recurse mcp serve <deployment-id>`. For Codex, set `startup_timeout_sec = 180` and `tool_timeout_sec = 1140` in the server configuration so a long run is not cut short by the host. See the [deployment guide](https://recurse.run/docs/deploy).

## Troubleshooting

If you're experiencing a persistent issue with Recurse, try these steps:
- Upgrade `recurse-sdk`.
- Refresh the skill.
- Check the relevant section in the [documentation](https://recurse.run/docs/).

## Using the Recurse CLI

### Install and authenticate

```sh
pip install recurse-sdk
recurse login
```

Login opens the browser and stores the device credential in the operating system keychain. `recurse logout` revokes this device's login. Keep credentials out of the application and MCP configuration. Use `recurse --help` or `recurse <command> --help` to inspect the installed version.

### Run an application

```sh
recurse run ./my-agent --inputs inputs.json
```

`inputs.json` must contain one JSON object matching the application's input schema. Omitting `--inputs` supplies `{}`. The CLI applies schema defaults and validates values. To read from stdin and set resource ceilings, use:

```sh
recurse run ./my-agent --inputs - --cpu 2 --memory-mib 2048 < inputs.json
```

Both `run` and `deploy` default to 1 CPU and 1024 MiB. `--cpu` accepts 0.125–16 in 0.125 increments; `--memory-mib` accepts 512–16384 in 128 MiB increments. These are billable ceilings; select them to fit requirements of the problem and your allowance.

The CLI packages, uploads, and prepares the application, prints `run: <run-id>`, and waits for its terminal state. It then prints `status`, the result or error when present, and the artifact count. Runs have a 15-minute execution limit. A run ID identifies one execution; running the command again starts another execution.

| Direct-run exit code | Meaning |
| --- | --- |
| `0` | Run is successful; inspect the receipt to evaluate the results. |
| `1` | Confirmed agent failure. |
| `2` | CLI-layer error. |
| `3` | Confirmed remote cancellation. |
| `4` | Confirmed infrastructure failure. |
| `5` | Confirmed agent timeout. |
| `130` | CLI interrupted by Ctrl-C; inspect the reported remote state. |

Codes `1`, `3`, `4`, and `5` are confirmed terminal run states. Code `2` covers every failure produced by the CLI rather than the run: invalid command syntax or option values, local input and packaging errors, authentication failures, request and transport failures, malformed service responses, and `observation_timeout` where remote state is unconfirmed. On `2`, inspect stderr and any printed run state before deciding whether to retry.

| Public error | Next step |
| --- | --- |
| `insufficient_balance` | Check `recurse billing balance`; obtain user approval before adding funds. |
| `secret_unavailable` | Check `recurse secret list` and the required binding. |
| `invalid_inputs` | Correct `--inputs` against the input schema in `agent.yaml`. |
| `invalid_agent` | Check the declaration and packaged tools. |
| `invalid_output` | Check the returned result against the declared output schema. |
| `artifact_failed` | Check artifact paths and retain the run ID. |
| `execution_failed`, `infrastructure_failed`, `unknown_error` | Retain the run ID and available evidence; do not invent a cause. |

`authentication_failed` directs you to `recurse login`. `request_failed` and `observation_timeout` do not establish that remote execution stopped. If state is unknown, execution and charges may continue: inspect the existing run before rerunning. Keep the admission reference if no run ID was obtained.

### Inspect, cancel, and retrieve

Ctrl-C during an admitted `recurse run` requests cancellation and exits `130`, even if the run finishes first. Pending or unconfirmed cancellation means execution and charges may continue; inspect the reported state. A second Ctrl-C stops waiting. Use the printed run ID:

```sh
recurse status <run-id>
recurse cancel <run-id>
recurse artifacts <run-id> --output results
```

On POSIX terminals, Ctrl-Z suspends the local CLI; `fg` or `bg` resumes it without cancelling remote work.

`status` reports the current state and available result/error and artifact count. Inspect again
after requesting cancellation to see the terminal state. Download available artifacts within
24 hours after completion. Use a new destination if files already exist: artifact retrieval refuses
to overwrite them. Missing or expired artifacts cannot be reconstructed from a storage key.
After failure, inspect preserved evidence before deciding whether a new run is useful.

### Runtime secrets

For a tool that needs a simulator credential:

```sh
recurse secret set simulator
recurse secret list
recurse run ./my-agent --inputs inputs.json --secret SIM_TOKEN=simulator
```

`secret set` uses hidden prompts and can create or rotate a secret. `--from-stdin` reads its exact
UTF-8 value from stdin when supplied by a trusted secret source. `--secret ENV=NAME` binds an account
secret to an environment variable inside tools; repeat it for additional bindings on `run` or
`deploy`. The value itself must not appear in the manifest, command arguments, or application archive.
Rotation affects future runs; active runs retain their selected secret version.

`recurse secret delete simulator` asks for confirmation, destroys the secret, and disables affected
deployments. Use it only when removal is intended.

### Deploy and connect through MCP

Use `run` while shaping an agent. Deploy after evidence shows it is reusable:

```sh
recurse deploy ./my-agent --as mcp --cpu 2 --memory-mib 2048
recurse mcp serve <deployment-id>
```

Add `--secret SIM_TOKEN=simulator` to `deploy` if the application needs that binding. Deployment
prepares an immutable application version and prints `deployment`, `endpoint`, and resource defaults.
Use the deployment ID—not a run ID—with `mcp serve`. Configure the MCP host to launch command
`recurse` with arguments `["mcp", "serve", "<deployment-id>"]`; the process serves the connection
through local standard input/output using the existing login.

For Codex, set `startup_timeout_sec = 180` and `tool_timeout_sec = 1140` in that server's
configuration. Give other hosts comparable headroom around the execution limit. See the
[deployment guide](https://recurse.run/docs/deploy) for host setup.

Editing local files does not update an existing deployment. Run `deploy` again after prompt, tool,
dependency, or model changes and connect the host to the new deployment ID.

### Balance and credits

`recurse billing balance` shows total and available balance. `recurse billing redeem CODE` redeems
a credit code. `recurse billing top-up 5` opens checkout for $5; supported amounts are $5–$500.
Add `--no-open` to print the checkout URL instead. Adding funds is a separate purchase decision,
not an automatic response to an insufficient-balance error.

See [documentation](https://recurse.run/docs) and [tool guidance](#authoring-tools).
