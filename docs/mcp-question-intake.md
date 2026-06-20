# MCP Question Intake

This guide explains how to push certification exam practice questions into Brain Gym using the Model Context Protocol (MCP) — either manually from Claude Desktop or automatically via the `brain-gym-daily` Cowork skill.

## Overview

The Brain Gym MCP server exposes three tools that let any MCP-compatible AI client discover certifications and push questions directly into the question bank:

| Tool                  | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `list_certifications` | List all certifications with their IDs              |
| `list_domains`        | List domains for a specific certification           |
| `push_questions`      | Push one or more questions through the quality gate |

Questions go through the same quality gate as all other intake sources:

| `quality_score` | Result                                 |
| --------------- | -------------------------------------- |
| ≥ 0.85          | Auto-published immediately             |
| 0.60 – 0.84     | Sent to admin review queue (`PENDING`) |
| < 0.60          | Discarded                              |

---

## Setup

### 1. Generate an MCP API Key

Go to **Settings → MCP API Keys** on your Brain Gym instance and generate a new key. It will look like `mcp_xxxxxxxxxxxxxxxxxxxx`. Copy it immediately — it is only shown once.

### 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` and add the `mcpServers` block:

```json
{
  "mcpServers": {
    "brain-gym": {
      "command": "/path/to/node/bin/npx",
      "args": ["ts-node", "/path/to/brain-gym/backend/src/mcp-server.ts"],
      "env": {
        "BRAIN_GYM_API_URL": "https://brain-gym.biz",
        "BRAIN_GYM_API_KEY": "mcp_your_key_here"
      }
    }
  }
}
```

Replace `/path/to/node/bin/npx` with the output of `which npx` and update the path to the backend directory.

> **Why the full path?** Claude Desktop does not inherit your shell's `PATH`, so `npx` must be an absolute path.

Quit and reopen Claude Desktop. The `brain-gym` server should appear in the connected MCP servers list (🔌 icon).

### 3. Verify the connection

Ask Claude Desktop:

> "Call list_certifications"

If it returns a list of certifications with IDs, the MCP server is connected and authenticated.

---

## Manual usage

### Step 1 — Discover certifications

```
Call list_certifications
```

Returns each certification's `id`, `code`, and `name`.

### Step 2 — Discover domains

```
Call list_domains with certificationId: "<uuid from step 1>"
```

Returns each domain's `id` and `name` for that certification.

### Step 3 — Push questions

```
Call push_questions with:
  certificationId: "<uuid>"
  domainId: "<uuid>"         (optional)
  difficulty: "MEDIUM"       (EASY | MEDIUM | HARD)
  questionType: "SINGLE"     (SINGLE | MULTIPLE)
  questions: [...]
```

Each question object:

```json
{
  "question": "A solutions architect needs to...",
  "choices": [
    {
      "label": "a",
      "content": "Use Amazon S3 with lifecycle policies",
      "isCorrect": false
    },
    {
      "label": "b",
      "content": "Use Amazon EFS with provisioned throughput",
      "isCorrect": true
    },
    {
      "label": "c",
      "content": "Use Amazon EBS with Multi-Attach",
      "isCorrect": false
    },
    {
      "label": "d",
      "content": "Use AWS Storage Gateway in file mode",
      "isCorrect": false
    }
  ],
  "explanation": "Amazon EFS provides shared, elastic file storage accessible by multiple instances simultaneously. EBS Multi-Attach is limited to a single AZ and only supports specific instance types. S3 is object storage and not suitable for shared file system workloads. Storage Gateway adds unnecessary latency for this use case.",
  "source_passage": "Amazon EFS provides scalable, fully managed elastic NFS file storage for use with AWS Cloud services and on-premises resources.",
  "quality_score": 0.92
}
```

---

## The `brain-gym-daily` Cowork Skill

The `brain-gym-daily` skill automates the full workflow: it selects a certification (rotating to ensure even coverage), fetches its domains, generates 10 high-quality scenario-based questions, and pushes them in grouped API calls.

### Trigger phrases

Invoke the skill in Cowork with any of:

- `/brain-gym-daily`
- "generate brain gym questions"
- "push questions to brain gym"
- "create certification practice questions"

### What it generates

Each run produces exactly 10 questions with this distribution:

| Attribute     | Distribution                                       |
| ------------- | -------------------------------------------------- |
| Difficulty    | 3 EASY · 4 MEDIUM · 3 HARD                         |
| Question type | 7 SINGLE · 3 MULTIPLE                              |
| Domains       | Spread as evenly as possible across all domains    |
| Topics        | Each question tests a different concept or service |

### Certification rotation

The skill does not repeat the same certification on consecutive runs. It rotates through available certifications in order so every cert gets equal question coverage over time.

### Grouping for efficiency

Questions are grouped by `(difficulty, questionType, domainId)` and pushed in 4–6 API calls rather than one per question. Calls within each run are made in parallel where possible.

### Quality threshold

All questions target `quality_score ≥ 0.85` (auto-publish). Questions that score below 0.85 land in the admin review queue. Questions below 0.60 are discarded by the backend and flagged in the run summary.

### Run summary

After each run the skill reports:

- Certification selected and suggested next certification
- Questions pushed per domain
- Difficulty and type breakdown
- Number of API calls made
- Any questions flagged for the review queue

### Example prompt for targeted generation

To generate for a specific certification and difficulty mix:

```
Generate 10 AWS SAA-C03 questions focused on the Resilient Architectures domain,
all HARD difficulty, SINGLE answer. Push them when ready.
```

---

## Scheduling daily runs

To run the skill automatically every day, create a scheduled Cowork task:

1. Open Cowork → Scheduled Tasks
2. Set the schedule to daily (e.g., 08:00)
3. Set the prompt to: `Generate brain gym questions`

The `brain-gym-daily` skill will trigger automatically on each run.

---

## Environment variables

| Variable            | Required | Default                 | Description                                                       |
| ------------------- | -------- | ----------------------- | ----------------------------------------------------------------- |
| `BRAIN_GYM_API_KEY` | Yes      | —                       | MCP API key from Settings → MCP API Keys. Must start with `mcp_`. |
| `BRAIN_GYM_API_URL` | No       | `http://localhost:3000` | Base URL of the Brain Gym backend.                                |

---

## Troubleshooting

| Symptom                                | Cause                    | Fix                                                       |
| -------------------------------------- | ------------------------ | --------------------------------------------------------- |
| "Server disconnected" on startup       | `npx` not found          | Use the absolute path from `which npx` in the config      |
| `Cannot find module './mcp-server.ts'` | `cwd` not applied        | Use the absolute path to `mcp-server.ts` in `args`        |
| `401 Unauthorized`                     | Wrong or revoked API key | Generate a new key in Settings → MCP API Keys             |
| `list_certifications` returns empty    | Backend unreachable      | Check `BRAIN_GYM_API_URL` and that the backend is running |
| Questions discarded                    | `quality_score < 0.60`   | Review the explanation quality; target ≥ 0.85             |
