---
name: ml-best-practices
description: "Statistical machine learning best practices, exploratory data analysis, feature engineering, and rigorous model evaluation. Use when analyzing tabular datasets, engineering features, training classifiers or regressors, forecasting time series, or computing 95% bootstrap confidence intervals — even if they don't explicitly say \"ml best practices\". Do NOT use for standard database queries without ML, basic spreadsheet formatting, or general application backend logic."
---

# Machine Learning Best Practices

Apply rigorous machine learning engineering standards across exploratory analysis, feature engineering, model training, and statistical performance validation.

## Core Principle

> **Every model finding must be grounded in leakage-free splits, dual-model baselines, and statistical confidence intervals.**

---

## Core Invariants

1. **Strict Train-Test Isolation**: Always partition datasets into training, validation, and test splits **before** fitting any scalers, encoders, or transformers.
2. **Mandatory Missing Value Strategy**: Explicitly quantify missing value frequencies and document domain rationale for keeping, dropping, or imputing them.
3. **Dual-Model Benchmark**: Never rely on a single model architecture in isolation. Train at least two distinct candidate families against a naive baseline.
4. **Statistical Significance Over Raw Averages**: Report 95% bootstrap confidence intervals for key evaluation metrics (F1, AUC, RMSE) to verify statistical separation.
5. **Story-First Notebook Structure**: Every code execution cell must be paired with an analytical markdown cell explaining the observed patterns, trade-offs, and conclusions.

---

## Architecture & Map of Content (MOC)

```
Raw Dataset & Objective
          │
          ▼
┌────────────────────────────────────────┐
│ 1. Data Hygiene & Anomaly Screening    │ (Missingness, Cardinality, Invariants)
└──────────────────┬─────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐       ┌──────────────┐
│  Clustering  │       │  Forecasting │ (Silhouette Optimization, Stationarity)
└──────────────┘       └──────────────┘
       │                       │
       └───────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐       ┌──────────────┐
│Classification│       │  Regression  │ (Pipeline Encoders, Regularization)
└──────────────┘       └──────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ 2. Statistical Model Comparison        │ (95% Bootstrap CIs, Slice Analysis)
└────────────────────────────────────────┘
```

---

## Step-by-Step Procedure (TWI)

### Step 1: Exploratory Analysis & Anomaly Detection
- **Action**: Inspect schema, compute summary statistics, and visualize target distributions with scatter plots and histograms.
- **Key Point**: Check for target column anomalies, extreme outliers, and non-sensical values before modeling.
- **Why**: Training models on corrupt or undetected anomalous targets invalidates the experimental setup.

### Step 2: Supervised Modeling (Classification / Regression)
- **Action**: Apply transformers inside scikit-learn pipelines fit exclusively on training data; evaluate regularization to control overfitting.
- **Key Point**: For high-cardinality nominal features, restrict cardinality or use target encoding with out-of-fold regularization.
- **Why**: Fitting transformers on the combined dataset causes subtle target and variance leakage.
- **Inline Checklist**:
  - [ ] Data split chronologically (if temporal) or via StratifiedKFold (if classification)
  - [ ] Encoders and scalers wrapped inside Pipeline, fitted only on X_train
  - [ ] Confusion matrices, ROC curves, or residual diagnostic plots generated
  - [ ] Missing values handled with documented justification

### Step 3: Unsupervised Clustering & Time-Series Forecasting
- **Action**: For clustering, standardize features and optimize the Silhouette Score; for forecasting, test stationarity and seasonality.
- **Key Point**: For time series, verify that no future information leaks into historical lag features.
- **Why**: Silhouette optimization prevents arbitrary cluster count selection; stationarity testing determines appropriate model family.

### Step 4: Model Comparison & 95% Bootstrap Confidence Intervals
- **Action**: Benchmark multiple model candidates on identical cross-validation folds and calculate bootstrap confidence intervals.
- **Key Point**: Conduct slice-based error analysis across critical subpopulations and compile an operational trade-off table.
- **Why**: Point estimates of accuracy often conceal performance drops on key customer cohorts.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Standard scaling before splitting is harmless."* | **Fit scalers strictly on training folds.** | Scalers compute dataset-wide statistics that cause subtle distribution leakage. |
| *"Accuracy is 94%, so the classifier is ready."* | **Always inspect PR-AUC, F1, and confusion matrix.** | On imbalanced classes, 94% accuracy may be worse than a naive majority-class guess. |
| *"We don't need a baseline because XGBoost is superior."* | **Always establish naive and linear baselines first.** | Naive baselines justify model complexity and reveal genuine signal gains. |
| *"Shuffling temporal data is fine if well-mixed."* | **Split temporal data chronologically.** | Shuffling time series causes future lookahead leakage into historical folds. |
