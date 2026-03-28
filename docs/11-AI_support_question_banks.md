## Full System Architecture

### 1. Material Ingestion Layer
The user uploads their study materials — PDFs, whitepapers, official docs, URLs. The platform chunks the content into passages and stores them with source metadata (document name, page, section). This becomes the grounding corpus — every generated question traces back to a specific chunk here. No chunk, no question.

---

### 2. AI Connector Layer *(Bring Your Own AI)*
Before generation, the user has configured their AI connection in their profile. Two modes:

- **API Key mode** — user pastes their OpenAI / Claude / Gemini key. Your platform calls the API directly.
- **MCP mode** — user connects an MCP-compatible AI tool (Claude Desktop, or future NotebookLM). Your platform exposes an MCP server endpoint; the AI tool pushes generated questions into your intake API.

Both modes produce the same output: structured JSON questions.

---

### 3. Generation Pipeline
Source chunks are fed into a **Generator prompt** — selected from your cert-specific prompt template library (e.g. "AWS SAA style", "Azure AZ-104 style"). The generator is instructed to output strictly structured JSON:

```json
{
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "B",
  "explanation": "...",
  "source_passage": "...",
  "confidence_hint": "high / medium / low"
}
```

---

### 4. Two-Pass Quality Gate
The raw output from the generator goes through a **Critic LLM** — a second prompt that evaluates:

- Is the scenario realistic and exam-like?
- Are the distractors plausible (not obviously wrong)?
- Is the correct answer unambiguously supported by the source passage?
- Is the explanation accurate?

The critic returns a **confidence score**. Routing logic:

```
score ≥ 0.85  →  auto-publish to question bank
score 0.60–0.84  →  review queue (human or community)
score < 0.60  →  discarded or flagged for regeneration
```

This is where you minimize human review — the critic does the heavy lifting.

---

### 5. Review Queue
Questions that land in the review queue go to one of two places depending on your moderation model:

- **Admin review** — a lightweight approve / reject / edit UI. No rewriting from scratch, just tweaking.
- **Community Beta Pool** — trusted contributors vote up/down. Hits the threshold → auto-promotes to main bank. This scales without admin bottleneck.

Both can coexist: admins handle flagged edge cases, community handles volume.

---

### 6. Question Bank Intake
Approved questions land in the bank, tagged automatically with: certification type, domain/service area (e.g. "S3", "IAM"), difficulty estimate, source document, and contributor. This tagging enables search, filtering, and future analytics (e.g. "which domains have the fewest questions?").

---

## The Full Flow in One Line

> *Upload materials → chunk & index → generate (your AI key) → critic scores → auto-publish or review → tagged question bank*

---

## Where Each Idea Lives

| Idea | Component |
|---|---|
| Bring Your Own API Key | AI Connector Layer |
| MCP Connector | AI Connector Layer |
| Confidence-based auto-publish | Quality Gate |
| Cert-style prompt templates | Generation Pipeline |
| Two-pass AI critic | Quality Gate |
| Community-as-reviewer | Review Queue |

---