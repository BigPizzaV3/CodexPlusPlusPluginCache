---
name: ai-engineering
description: "Design, train, optimize, deploy, and evaluate production machine learning and LLM systems. Use when building ML models, training classifiers, fine-tuning LLMs with LoRA/PEFT, deploying low-latency inference endpoints, architecting vector RAG pipelines, or evaluating model bias and data leakage — even if they don't explicitly say \"AI engineering\". Do NOT use for standard backend CRUD development, basic SQL queries without ML, or simple UI styling."
---

# AI & Machine Learning Engineering

Design, train, optimize, deploy, and monitor production machine learning models and intelligent agent systems with rigorous validation, latency engineering, and ethical guardrails.

## Core Principle

> **Every ML solution must beat a naive baseline, guarantee train-test isolation, and meet strict production latency and fairness budgets.**

---

## Core Invariants

1. **Strict Train-Test Isolation**: Preprocessing scalers, encoders, and tokenizers must be fit strictly on training folds inside isolated pipelines to eliminate data leakage.
2. **Sub-100ms Inference Budget**: Synchronous user-facing endpoints must achieve $p99 < 80\text{ms}$ through quantization (ONNX/TensorRT/GGUF), engine optimization, or continuous batching.
3. **Mandatory Baseline Before Complexity**: Always benchmark against a naive baseline (majority class/mean) and simple linear model before advancing to deep networks or complex ensembles.
4. **Demographic Parity & Bias Auditing**: Every production candidate must pass four-fifths disparate impact testing across demographic slices ($\text{ratio} \ge 0.80$).
5. **Continuous Drift Observability**: Production models must emit data drift metrics (KS-test / Population Stability Index) and concept drift alerts to trigger automated retraining.

---

## Architecture & Map of Content (MOC)

```
Problem Framing & Data Assessment
              │
              ▼
┌───────────────────────────────────────┐
│ 1. Data Prep & Leakage-Free Pipeline  │ (Cross-Validation, Feature Isolation)
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 2. Model Training & Fine-Tuning       │ (Baselines, LoRA / QLoRA, Tree Ensembles)
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 3. Bias, Fairness & Ethics Audit      │ (Disparate Impact, SHAP Attributions)
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 4. Production Serving & Optimization  │ (ONNX/vLLM, Sub-100ms Latency, Canary)
└───────────────────────────────────────┘
```

---

## Step-by-Step Procedure (TWI)

### Step 1: Requirements & Data Hygiene Verification
- **Action**: Assess target metrics, evaluate class balance, and establish reproducible validation splits.
- **Key Point**: Check for temporal dependencies. If data has a time dimension, use chronological splitting; otherwise, use Stratified $k$-Fold cross-validation.
- **Why**: Random splits on time-series data cause severe lookahead leakage and false confidence.

### Step 2: Model Training & Architecture Selection
- **Action**: Fit naive baselines, progress to gradient-boosted trees or fine-tune neural architectures (LoRA/PEFT for LLMs).
- **Key Point**: For LLMs, apply LoRA to all attention and MLP projection layers with $\alpha = 2 \times r$ and 4-bit NF4 quantization.
- **Why**: Selective rank adaptation achieves foundation model performance at 25% of the VRAM cost.
- **Inline Checklist**:
  - [ ] Simple baseline established (Linear/Logistic Regression or Mean baseline)
  - [ ] Cross-validation variance across folds is within acceptable bounds (< 5%)
  - [ ] Overfitting diagnostics checked (Training loss vs Validation loss convergence)
  - [ ] Hyperparameters tuned systematically using Bayesian optimization

### Step 3: Bias, Explainability & Robustness Auditing
- **Action**: Evaluate fairness across subpopulations and calculate SHAP feature attributions.
- **Key Point**: Enforce the four-fifths rule ($\text{selection rate ratio} \ge 0.80$) and compute top local feature attributions for high-stakes decisions.
- **Why**: Undetected bias causes regulatory violations and uncalibrated real-world discrimination.

### Step 4: Low-Latency Serving & Canary Rollout
- **Action**: Export models to ONNX or vLLM, wrap in asynchronous API services, and initiate a 10% canary deployment.
- **Key Point**: Track $p99$ latency, Population Stability Index (PSI), and error rates across the canary group.
- **Why**: Canary testing isolates performance regressions before full traffic exposure.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Accuracy is 98%, so we don't need confusion matrices."* | **Mandatory PR-AUC, F1, and confusion matrix analysis.** | High accuracy on imbalanced data often hides a degenerate majority-class classifier. |
| *"Preprocessing before splitting is harmless."* | **Zero data leakage: pipeline-contained transformers only.** | Dataset-wide preprocessing leaks test distribution parameters into training folds. |
| *"Model meets accuracy goals, so skip bias checks."* | **Fairness audit is a mandatory release gate.** | Regulatory and ethical standards mandate demographic parity verification. |
| *"400ms latency is fast enough for cloud servers."* | **Sub-100ms p99 budget for interactive endpoints.** | High latency compounds across microservices and degrades user experience. |
