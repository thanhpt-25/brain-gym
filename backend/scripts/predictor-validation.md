# Predictor Validation Harness — US-408

## Goal

Measure whether the **Pass Predictor** (readiness score heuristic) correlates with user self-reported confidence on a 1–10 scale. Compute Pearson **r** on the 200-user beta cohort to inform the Sprint 5 retro decision: widen, rework, or deprecate.

---

## Cohort Extraction

**Who is in the beta?**

```sql
SELECT u.id, u.email,
  COALESCE(u.feature_flags->>'passPredictorBeta', 'false')::boolean as in_beta
FROM users u
WHERE (u.feature_flags->>'passPredictorBeta')::bool = true
ORDER BY u.created_at;
```

**Expected:** ~200 rows (seeded via `backend/scripts/seed-beta-cohort.ts`).

---

## Joined Dataset

**Pair readiness scores with survey responses:**

```sql
SELECT
  rs.user_id,
  rs.certification_id,
  rs.score as readiness_score,
  pls.score as survey_score,
  rs.created_at,
  pls.submitted_at
FROM readiness_scores rs
INNER JOIN pass_likelihood_surveys pls
  ON rs.user_id = pls.user_id
  AND rs.certification_id = pls.certification_id
WHERE (
  SELECT (feature_flags->>'passPredictorBeta')::bool
  FROM users
  WHERE id = rs.user_id
) = true
ORDER BY rs.user_id, rs.certification_id;
```

---

## Dataset Statistics

**Understand the distributions:**

```sql
SELECT
  COUNT(*) as n,
  MIN(rs.score) as readiness_min,
  MAX(rs.score) as readiness_max,
  ROUND(AVG(rs.score)::numeric, 2) as readiness_mean,
  ROUND(STDDEV_POP(rs.score)::numeric, 2) as readiness_stddev,
  MIN(pls.score) as survey_min,
  MAX(pls.score) as survey_max,
  ROUND(AVG(pls.score)::numeric, 2) as survey_mean,
  ROUND(STDDEV_POP(pls.score)::numeric, 2) as survey_stddev
FROM readiness_scores rs
INNER JOIN pass_likelihood_surveys pls
  ON rs.user_id = pls.user_id
  AND rs.certification_id = pls.certification_id
WHERE (
  SELECT (feature_flags->>'passPredictorBeta')::bool
  FROM users
  WHERE id = rs.user_id
) = true;
```

---

## Pearson Correlation — PostgreSQL Native

**Use the built-in `CORR()` function:**

```sql
SELECT
  CORR(rs.score, pls.score) as pearson_r,
  COUNT(*) as n
FROM readiness_scores rs
INNER JOIN pass_likelihood_surveys pls
  ON rs.user_id = pls.user_id
  AND rs.certification_id = pls.certification_id
WHERE (
  SELECT (feature_flags->>'passPredictorBeta')::bool
  FROM users
  WHERE id = rs.user_id
) = true;
```

**Returns:** Single row with `pearson_r` (NULL if n < 2) and `n` (sample size).

---

## Pearson Correlation — Python (pandas + scipy)

**For deeper analysis or when PostgreSQL is unavailable:**

```python
import psycopg2
import pandas as pd
from scipy import stats

# Connection
conn = psycopg2.connect(
    host="localhost", database="brain_gym",
    user="postgres", password="postgres"
)

# Fetch data
query = """
SELECT rs.score as readiness, pls.score as survey
FROM readiness_scores rs
INNER JOIN pass_likelihood_surveys pls
  ON rs.user_id = pls.user_id AND rs.certification_id = pls.certification_id
WHERE (SELECT (feature_flags->>'passPredictorBeta')::bool FROM users WHERE id = rs.user_id) = true;
"""
df = pd.read_sql(query, conn)
conn.close()

# Pearson r
if len(df) >= 2:
    r, p_value = stats.pearsonr(df['readiness'], df['survey'])
    print(f"Pearson r: {r:.4f}")
    print(f"p-value: {p_value:.4f}")
    print(f"n: {len(df)}")
else:
    print("Insufficient data (n < 2)")
```

---

## Scatter Plot Visualization

**Plot readiness vs. self-reported confidence:**

```python
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(8, 6))

# Scatter
ax.scatter(df['readiness'], df['survey'], alpha=0.5, s=40)

# Fit line (y = mx + b)
z = np.polyfit(df['readiness'], df['survey'], 1)
p = np.poly1d(z)
x_line = np.linspace(df['readiness'].min(), df['readiness'].max(), 100)
ax.plot(x_line, p(x_line), "r--", alpha=0.8, label=f"Fit (r={r:.2f})")

ax.set_xlabel("Readiness Score (heuristic)")
ax.set_ylabel("Survey Score (self-report, 1–10)")
ax.set_title("Pass Predictor Validation — Beta Cohort")
ax.legend()
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("predictor-validation.png", dpi=150)
plt.show()
```

---

## Interpretation Guide

**Correlation strength (Cohen 1988):**

| Range     | Strength           | Action                                                                                 |
| --------- | ------------------ | -------------------------------------------------------------------------------------- |
| 0.00–0.29 | Negligible         | ❌ **REWORK** — Model does not predict survey; revise heuristic                        |
| 0.30–0.49 | Weak               | ⚠️ **CAUTION** — Some signal but unreliable; test with larger cohort or refine model   |
| 0.50–0.69 | Moderate           | ✅ **SHIP** — Reasonable correlation; safe to deploy more broadly                      |
| 0.70–0.99 | Strong–Very Strong | 🚀 **OPTIMIZE** — High correlation; consider productizing predictions or tightening UI |
| 1.00      | Perfect            | (Unlikely; indicates data error)                                                       |

**Note:** This is a **post-hoc validation** harness, not a pre-launch gate. Sprint 5 retro decides next steps based on the r value and qualitative feedback.

---

## References

- Cohen, J. (1988). _Statistical Power Analysis for the Behavioral Sciences_ (2nd ed.).
- PostgreSQL `CORR()`: https://www.postgresql.org/docs/current/functions-aggregate.html
- `scipy.stats.pearsonr`: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html
