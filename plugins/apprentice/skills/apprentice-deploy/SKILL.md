---
name: apprentice-deploy
description: >
  Use ONLY when a user explicitly asks to serve or deploy a model already
  fine-tuned with Apprentice: "serve this model", "deploy the adapter", "run
  it in my cluster", "vLLM", "Kubernetes manifests for it". Writes vLLM
  Deployment and Service manifests into the user's repo mirroring existing
  conventions, and covers serving MLX adapters on a Mac. Never volunteer
  deployment while capturing calls, optimizing a prompt, or training:
  delegate those to apprentice-capture and apprentice-train.
license: MIT
---

# Serve a fine-tuned model

Only when asked. A user uploading rows or running an optimize job has not asked to deploy
anything, and offering manifests there is noise at best. This skill exists as its own trigger
so deployment instructions stay out of sessions that are about data.

**Asking about deployment is not asking for files.** "How would I serve this?", "what does
vLLM need?", "is my cluster big enough?" are questions: answer them, write nothing. Write
manifests only when the user asks for the files, in words like "write the manifests", "add
the Deployment", "set this up in my repo". When it is genuinely ambiguous, say what you are
about to create and where, and let the user say go. The plugin declares Write, so this gate
is the only thing standing between a question and a commit.

The precondition, surfaced before anything else: the fine-tune has passed its eval, and for
the cluster path there is **at least one GPU node**.

## In the user's own Kubernetes cluster

Inference stays inside the user's network. Read `references/deploy-kubernetes.md` and the published
[Kubernetes guide](https://docs.runapprentice.com/how-to/deploy-kubernetes), then write the vLLM Deployment and Service into the
repo, mirroring the conventions already there (the user's registry, namespace, ingress
pattern, label scheme), and state the honest GPU sizing.

Never invent cluster names, namespaces, or registries. With no existing manifests visible, ask
for one rather than guessing.

## On a Mac

Mac-trained MLX adapters are served on the Mac with `mlx_lm.server`
([docs](https://docs.runapprentice.com/how-to/deploy-mlx)).

Do not claim an MLX adapter can be served by vLLM elsewhere. That conversion path has no
published, verified recipe, and saying otherwise sends a user down a road that dead-ends.

## What deployment does not do

Serving a model is not promotion. Activating a model in Apprentice records the promotion in
the console and leaves serving unchanged; routing live production traffic to the smaller model
is still in development. A user who deploys still decides what calls the endpoint.
