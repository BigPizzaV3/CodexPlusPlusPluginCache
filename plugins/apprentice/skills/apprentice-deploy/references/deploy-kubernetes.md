# Deploy the fine-tuned model in the user's Kubernetes cluster

You are writing manifests into THEIR repo. Mirror their existing conventions: their
registry, their namespace, their ingress pattern, their label scheme. Never invent cluster
names, namespaces, or registries. If you cannot see their existing manifests, ask for one
example Deployment to mirror before writing anything.

## Precondition

At least one GPU node in the cluster. If there is none, say so plainly: requesting that
node group is the only step that is not YAML, and nothing below works without it.

## What to write

A standard vLLM Deployment + ClusterIP Service, following the
[official vLLM Kubernetes guide](https://docs.vllm.ai/en/latest/deployment/k8s.html):

- Image: `vllm/vllm-openai` (their mirror of it if they have one).
- Command: `vllm serve <model-or-adapter-path>` with the knobs below.
- Service: `ClusterIP` on port 8000. The app then points at it with
  `OPENAI_BASE_URL=http://<service-name>:8000/v1` and no code changes.
- GPU resources in BOTH requests and limits: `nvidia.com/gpu: "1"`.
- Readiness and liveness probes with a generous initial delay (60s or more). Model load is
  slow; an eager probe crash-loops a healthy pod.
- A PersistentVolumeClaim mounted at `/root/.cache/huggingface` so weights are not
  re-downloaded on every restart.
- Shared memory: an `emptyDir` volume with `medium: Memory` (vLLM needs it).

## Honest sizing (Qwen3.5-4B)

| GPU | Verdict |
|---|---|
| 24 GB (L4, A10, RTX 4090) | Comfortable: bf16 weights are ~9 GB, the rest is KV cache. |
| 16 GB | Works with AWQ 4-bit and a reduced `--max-model-len`. |
| CPU only | No. Never suggest it. |

## The two flags that matter

- `--gpu-memory-utilization`: fraction of the GPU vLLM claims (default 0.9). Lower it only
  if the pod shares the GPU.
- `--max-model-len`: cap context to what the task needs; shorter context frees memory for
  more concurrent requests.

## Rollback

One env var: point `OPENAI_BASE_URL` back at the previous provider. Say this every time;
it is the reason the user can try this without fear.
