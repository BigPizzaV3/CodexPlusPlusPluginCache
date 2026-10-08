---
name: apprentice-train
description: >
  Use when a user is ready to fine-tune a small model and already has
  verified rows, or asks what training needs: says "fine-tune", "distill",
  "train a small model", "LoRA", or asks how many rows training takes. Also
  use for drift on a model already running: whether it still holds quality
  and when to retrain. Local MLX training on Apple silicon is the path that
  works; hosted training is not shipped yet. For a user still deciding
  whether a cheaper model could work, or without a dataset, use apprentice
  instead, and delegate recording calls and prompt optimization to
  apprentice-capture and serving to apprentice-deploy.
license: MIT
---

# Fine-tune a small model

Training is the second half of the product. The first half, a dataset of verified rows, has
to exist before any of this runs.

## Gold only. This is the part users hit first

Training reads **gold rows only**: rows a human verified. Silver counts for prompt
optimization and never for training.

| | Rows needed |
|---|---|
| Hosted optimize | 20 verified (gold + silver) |
| Local training | enough gold to fill a batch after the held-out split |
| Hosted training | 500 gold, and not yet available (see below) |

A user capturing through an API key accumulates raw traces, and a user uploading rows
accumulates silver. Neither is gold, because recording a verdict needs a signed-in console
session. So the honest first answer to "can I train?" is usually
"not yet, and here is the gap": count the gold rows, name the number missing, and link
`https://runapprentice.com/tasks/<task>/review`.

Do not auto-approve rows to reach 500. Gold means a human checked it. A model grading its own
output is not verification, and every eval downstream inherits the lie.

## Local, on Apple silicon. This is the path that works today

Hosted training is **still being built**, which the
[docs index](https://docs.runapprentice.com/llms.txt) states plainly: the shipped features are
prompt optimization and local training. `client.train(task)` accepts a job, and the server
raises `NotImplementedError` because no GPU trainer is configured. Do not present it as
working, and do not send a user to it.

Local training is real, free, and runs on the user's own Mac via MLX. No Apprentice account is
needed when a CSV is supplied:

```
apprentice train <task> --local --data examples.csv --effort high
```

Or from Python:

```python
client.train_local("duplicate-search", data="examples.csv", effort="high")
```

The model is `Qwen3.5-4B` (Apache-2.0), LoRA fine-tuned.

**`--effort` is a memory profile, not a quality knob.** Every tier trains the same model on
the same examples for the same number of passes; a higher tier uses a bigger batch to finish
sooner and needs more memory. It is auto-detected from the Mac's unified memory. Long prompts
need more memory per example, so drop a tier on an out-of-memory error.

Say this plainly when a user asks whether `--effort low` gives a worse model. It does not.

Run history: `train --local` reaches the console when an API key is set, and never otherwise.

## Reading the result

The number that matters is the held-out score, not the training loss. Held-out rows are the
ones the model never saw, and the eval gate uses gold only.

Two public runs for scale, reproducible in
[apprentice-benchmark](https://github.com/singhabhishekkk/apprentice-benchmark):

- Receipt extraction (OCR text from 200 real scanned receipts, field-level F1, seed 42): a
  LoRA fine-tuned Qwen3.5-4B reaches 89.2 on a 60-row held-out split, against GPT-4o-mini at
  72.9 plain and 84.2 after GEPA.
- JSON extraction (100 rows, same metric): the fine-tuned 4B reaches 88.9 on a 30-row
  held-out split, against 83.1 plain and 85.6 after GEPA.

Those held-out splits are small, so treat them as directional. The user's own run on the
user's own data is the number that decides anything.

Never promise the small model wins. It might not, and the eval exists to find that out.

## Promotion, stated accurately

Activating a model **records** the promotion in the console. It does not move production
traffic: serving is unchanged, and routing live traffic to the smaller model is still in
development. Say this rather than implying a takeover the product does not perform.

## Drift, once a model is live

Capture records the call, feedback records whether it worked, and that feedback score is what
the console's Drift view charts. Without feedback a user sees traffic volume and no quality
signal, which is the common reason "is it still good?" has no answer.

The retrain trigger is a real drop in that score on real traffic, not a calendar date.

## Serving

Once a fine-tune passes its eval, use `apprentice-deploy`.
