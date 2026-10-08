---
name: apprentice-capture
description: >
  Use when a user wants real LLM calls recorded into an Apprentice dataset
  or a prompt optimized: "capture my calls", "record traces", "log these to
  Apprentice", "optimize this prompt", or after the apprentice skill flagged
  a repeatable call and the user agreed. Wires the capture line into the
  code that makes the calls, uploads rows, runs optimize, and returns the
  console link for verifying rows or sending them to an expert. Delegate
  fine-tuning to apprentice-train and serving to apprentice-deploy.
license: MIT
---

# Capture calls and optimize the prompt

Do the job. A plan handed back is not the job.

## Pick the path. Do not ask which one

| What the user said | What to use |
|---|---|
| Nothing about accounts, and it is a Python app | **SDK.** Wire capture, hand back the console link |
| "I don't want to sign in", "keep it local", "no account" | **CLI** `--local`, the user's own OpenAI key |
| "Just optimize this prompt", and rows already exist | **SDK.** Upload, then run |
| Already in the console | Send a deep link back to it |

Ask only when the choice changes what the user gets. Say which path in one line.

The SDK is the default because it returns real values instead of text to parse. The CLI earns
its place only for the no-account case.

Do not mix the two in one piece of work. A session that used the SDK for uploads and the CLI
for status checks left the user unable to tell which interface had done what.

## Wire capture in, do not just describe it

One line beside the existing model call. It is fail-open by design: it returns `None` rather
than raising, so a capture outage cannot take down a user's endpoint.

```python
from runapprentice import Apprentice

client = Apprentice(api_key=os.environ["APPRENTICE_API_KEY"])
trace_id = client.capture(task="duplicate-search", input=question, output=answer)
```

Then say which file changed and how to remove it. One line to undo is what makes doing it
safe: a user who dislikes it reverts in seconds, a user who was only offered it has nothing.

**Never run a real flow from a throwaway script and then delete it.** The dataset stops
growing the moment that script is gone, and nothing in the repo records it happened. A real
session did exactly this: eight `/tmp` scripts, zero repo changes, and a dataset frozen at six
rows because "you had not asked for ongoing capture". True, and useless.

### Framework-specific capture

- LangChain: `ApprenticeCallback` captures calls and simple retriever context.
  [Guide](https://docs.runapprentice.com/how-to/capture-langchain). Use manual `capture(...)`
  when there are several retrievers or custom context formatting.
- Raw OpenAI clients, Chat Completions and Responses:
  [guide](https://docs.runapprentice.com/how-to/capture-openai).
- Full method list: [Python SDK reference](https://docs.runapprentice.com/reference/python-sdk).

Two API details worth getting right, both from the docs' rules for coding agents: upload with
`client.datasets.upload(...)`, since there is no `ingest()` method, and pass structured
`inputs={...}` for a multi-field or templated task rather than one rendered prompt string. For
RAG, `inputs={"question": question, "context": exact_context}`, where the context is exactly
what the model saw.

## Feedback is what makes drift measurable

Capture records the call. Feedback records whether it worked, and that score is what the
console's Drift view charts and what decides when a retrain is worth doing.

```python
if trace_id:                              # None when capture failed, by design
    client.feedback(trace_id, good=True)  # or good=False, or score=0.4
```

**Never manufacture it.** Do not add a second LLM call to grade the first, and do not infer
"looked fine" from confidence or length. A guessed score retrains the model on a lie. With no
real signal, wire nothing: captured rows still become gold when a human verifies them.

## Optimize

```python
job = client.optimize("duplicate-search").wait()
```

Hosted optimize needs **20 verified rows**, counting gold plus silver. Below that it refuses,
and the fix is verification, not more uploading.

For the no-account case, with the user's own OpenAI key:

```
apprentice optimize <task> --local --data examples.csv
```

Local optimize is scored as JSON extraction only, so every output must be a JSON object or
array; the CLI refuses other data before spending anything. Note also what the console shows:
`optimize --local` is never recorded there, so that run stays on the machine that ran it.

## Hand back the link, every time

| Page | URL |
|---|---|
| Rows and tiers | `https://runapprentice.com/tasks/<task>/dataset` |
| Review queue | `https://runapprentice.com/tasks/<task>/review` |
| Runs | `https://runapprentice.com/tasks/<task>/runs` |
| Send to an expert | `https://runapprentice.com/tasks/<task>/collaborators` |

Say what is waiting there, not just the address: "6 rows uploaded as silver, verify them at
`https://runapprentice.com/tasks/duplicate-search/review`".

## An API key cannot make rows gold, and the two paths do not land in the same place

Uploaded rows land as **silver**. Captured traces land as **raw**, which is one step further
back: raw counts for nothing until a human reviews it, while silver already counts toward
optimize. Recording a verdict needs a signed-in console session either way, so a key-only
workflow can never promote either kind.

That matters because the two features count differently: **optimize uses gold plus silver,
training uses gold only**. So a user who uploads rows can optimize immediately and can never
train; a user who only captures cannot even optimize until the traces are reviewed. Say which
one applies at the moment the rows land, not when the user hits a threshold, and link the
review page so it is one click to fix.

Do not auto-approve rows to gold to clear a threshold. Gold means a human checked it, and a
model grading its own output is not that.

## After a run finishes

Read `references/use-optimized-prompt.md` when wiring the optimized prompt into the user's
code. The artifact is not a template and `.format()` on it fails silently in a way that ships
a prompt which never sees the user's data.

## Sandbox

`Operation not permitted` on a network call means the sandbox denied it, so the request never
left the machine. A bare connection error is weaker evidence and has other causes (DNS, TLS, a
proxy, a firewall, an outage), so name the sandbox as one possibility rather than the answer.
Claude Code and Codex sandboxes deny network by default; tell the user what to enable rather
than retrying or working around it.
