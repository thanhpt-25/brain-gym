# Competency Framework

The competency framework lets an organization define measurable skills, map them to exam domains, link them to job roles with required proficiency levels, and view inferred skill levels for individual members or the whole org.

---

## Key Concepts

### Competency (`competencies` table)

Represents a named skill or knowledge area owned by an org.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID) | Primary key |
| `orgId` | `String` | Owning organization |
| `name` | `String` | Unique within the org |
| `description` | `String?` | Optional free-text |
| `scaleMin` | `Int` (default 1) | Minimum level value |
| `scaleMax` | `Int` (default 5) | Maximum level value |
| `isActive` | `Boolean` (default true) | Toggle without deleting |

Constraint: `(orgId, name)` must be unique. `scaleMin` must be strictly less than `scaleMax`.

### CompetencyDomain (`competency_domains` table)

Maps a competency to one or more exam domain names. The domain names must match keys in `ExamAttempt.domainScores` or `CandidateInvite.domainScores` (matched case-insensitively at scoring time).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID) | Primary key |
| `competencyId` | `String` | Parent competency |
| `domainName` | `String` (max 200) | Exam domain/category name to match |
| `source` | `CompetencyDomainSource` | `ORG_QUESTION_CATEGORY` or `PUBLIC_DOMAIN` |

Constraint: `(competencyId, source, domainName)` must be unique.

### JobRole (`job_roles` table)

A named position within an org, optionally grouped by department.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID) | Primary key |
| `orgId` | `String` | Owning organization |
| `title` | `String` | Role name |
| `department` | `String?` | Optional grouping |
| `description` | `String?` | Optional free-text |
| `isActive` | `Boolean` (default true) | Toggle without deleting |

### JobRoleCompetency (`job_role_competencies` table)

Associates a job role with a competency requirement.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID) | Primary key |
| `jobRoleId` | `String` | Parent job role |
| `competencyId` | `String` | Target competency |
| `requiredLevel` | `Int` | Must be within `[scaleMin, scaleMax]` of the competency |

Constraint: `(jobRoleId, competencyId)` must be unique.

---

## Scoring Algorithm

Level inference uses a pure function: `inferCompetencyLevel()` in `backend/src/competency/scoring/infer-competency-level.ts`. It has no I/O or database calls. See [ADR 028](../adr/028-competency-scoring.md) for the full rationale.

**Input:** a `Record<string, { correct: number; total: number }>` of domain scores (from stored `domainScores` JSON), a list of domain names mapped to the competency, and scale/threshold options.

**Steps:**

1. Normalize all domain name keys and mapped domains to lowercase-trimmed strings.
2. Sum `correct` and `total` only for domains that both appear in the mapped list and have data in the stored scores.
3. If `sumTotal === 0` (no matching domain data), return `level = scaleMin`, `percentage = 0`, `confidence = LOW`.
4. Compute `percentage = (sumCorrect / sumTotal) * 100`, rounded to one decimal place.
5. Walk the threshold table (sorted descending by `minPercentage`), pick the first entry where `percentage >= minPercentage`. Clamp result to `[scaleMin, scaleMax]`.
6. Assign confidence based on sample size: `HIGH` if `sumTotal >= 20`, `MEDIUM` if `>= 8`, otherwise `LOW`.

**Default thresholds (1–5 scale):**

| Level | Label | Minimum % |
|-------|-------|-----------|
| 5 | Expert | 90 |
| 4 | Proficient | 75 |
| 3 | Competent | 60 |
| 2 | Developing | 40 |
| 1 | Novice | 0 |

---

## Analytics Endpoints

All endpoints live under `GET /api/v1/organizations/:orgId/...` and require a JWT with an active org membership.

### Competency Profile — `GET /org-analytics/:orgId/competency-profile`

Query parameters:
- `memberId` (optional) — restrict to a single member; if omitted, aggregates across all active members.
- `jobRoleId` (optional) — include `requiredLevel` and `gap` for each competency.

Response per competency:

```json
{
  "competencyId": "...",
  "competencyName": "...",
  "inferredLevel": 3,
  "confidence": "MEDIUM",
  "sampleSize": 12,
  "requiredLevel": 4,
  "gap": -1,
  "scaleMin": 1,
  "scaleMax": 5
}
```

`gap = inferredLevel - requiredLevel`. A negative gap means the member or team is below the required level.

### Competency Heatmap — `GET /org-analytics/:orgId/competency-heatmap`

Returns a matrix of `{ userId, competencyId, level, confidence }` cells for up to 200 active members × all active competencies. Useful for a grid visualization where each cell is colored by inferred level.

---

## Configuration Steps

1. **Create competencies.** `POST /organizations/:orgId/competencies` with `{ name, description?, scaleMin?, scaleMax? }`. Requires OWNER, ADMIN, or MANAGER role.

2. **Map exam domains to each competency.** `POST /organizations/:orgId/competencies/:id/domains` with `{ domainName, source? }`. The `domainName` value must match the category strings used in your question bank. Use `source: ORG_QUESTION_CATEGORY` (default) for org question categories.

3. **Create job roles.** `POST /organizations/:orgId/job-roles` with `{ title, department?, description? }`. Requires OWNER, ADMIN, MANAGER, or RECRUITER role.

4. **Set required competency levels for each job role.** `PUT /organizations/:orgId/job-roles/:roleId/competencies` with a `requirements` array:
   ```json
   {
     "requirements": [
       { "competencyId": "<uuid>", "requiredLevel": 3 }
     ]
   }
   ```
   This operation replaces the full requirement set atomically. Each `requiredLevel` must be within the competency's `[scaleMin, scaleMax]` range.

5. **View competency profiles.** Call the analytics endpoints described above. Profiles are computed on-demand from stored `domainScores`; no separate scoring job is needed.

---

## API Reference

See [03 — API Design](../03-api_design.md) for REST conventions and authentication details.

Route prefixes:
- Competencies: `GET|POST|PATCH|DELETE /organizations/:orgId/competencies[/:id]`
- Domain mappings: `GET|POST|DELETE /organizations/:orgId/competencies/:id/domains[/:domainId]`
- Question links: `GET|POST|DELETE /organizations/:orgId/competencies/:id/questions[/:questionId]`
- Job roles: `GET|POST|PATCH|DELETE /organizations/:orgId/job-roles[/:roleId]`
- Job role requirements: `GET|PUT /organizations/:orgId/job-roles/:roleId/competencies`
- Analytics: `GET /org-analytics/:orgId/competency-profile`, `GET /org-analytics/:orgId/competency-heatmap`
