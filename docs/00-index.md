# CertGym Documentation Index

Technical and product documentation for the CertGym platform. For a project overview and quick-start, see the [root README](../README.md).

---

## Architecture & Design

| Document | Description |
|----------|-------------|
| [01 — Architecture Overview](./01-architecture.md) | C4 context/container diagrams, technology stack, sub-system breakdown |
| [02 — Data Model](./02-data_model.md) | Entity Relationship Diagrams, core database schemas |
| [03 — API Design](./03-api_design.md) | REST conventions, authentication, module overview, integration patterns |
| [04 — Frontend Architecture](./04-frontend.md) | React/Vite structure, routing, state management (Zustand + TanStack Query) |
| [05 — Deployment & Infrastructure](./05-deployment.md) | Docker containers, Nginx, environment variables |
| [06 — Security](./06-security.md) | JWT auth flow, RBAC, data protection, RLS |
| [Basic Design (single doc)](./basic-design.md) | Full system design consolidated in one document |
| [Vision & Product Strategy](./vision.md) | Product philosophy, target audience, feature roadmap |

---

## Features

| Document | Description |
|----------|-------------|
| [Exam Engine](./exam-engine.md) | State machine, timer modes, mark-for-review, domain scoring, submission flow |
| [Organization Management](./organization.md) | Multi-tenant orgs, roles, member onboarding |
| [Competency Framework](./features/competency-framework.md) | Competency/domain model, scoring algorithm, job role gap analysis, configuration steps |
| [Candidate Assessment](./features/candidate-assessment.md) | Assessment lifecycle, question selection modes, token flow, anti-cheat, bulk CSV invite, results |
| [Coach Tier Gating](./features/coach-tier-gating.md) | AI coach access control by subscription tier |
| [Burnout Detection](./features/burnout-detection.md) | Signal weighting, severity levels, user guidance, best practices |
| [Local LLM Question Generation](./local-llm-question-generation.md) | Configuring and using local LLM providers |
| [Enterprise Entrance Exam](./enterprise-entrance-exam-plan.md) | Org onboarding assessment feature design |
| [Smart Exam Builder SRS](./specs/smart-exam-builder-srs.md) | Smart Exam Builder specification |
| [Squads — API](./api/squads.md) | Squads REST API reference |
| [Squads — Components](./components/squads.md) | Squads frontend component documentation |

---

## Operations

| Document | Description |
|----------|-------------|
| [On-Call Runbook](./oncall.md) | Incident response, rotation, rollback procedures, log access |
| [AWS Deployment Overview](./deployment/aws-overview.md) | AWS architecture, IAM roles, ECS task definitions, CI/CD workflow |
| [AWS Terraform Setup](./deployment/aws-terraform.md) | Provision all AWS infrastructure with Terraform (recommended) |
| [AWS Console Setup](./deployment/aws-console-setup.md) | Step-by-step manual setup via AWS Console |

---

## Quality & Accessibility

| Document | Description |
|----------|-------------|
| [Accessibility Baseline](./a11y-baseline.md) | WCAG targets, axe-core scan results, remediation notes |
| [QA — Flaky Test Baseline](./qa/flaky-baseline.md) | Known flaky tests and stabilization status |
| [QA — Lighthouse](./qa/lighthouse.md) | Performance and accessibility Lighthouse audit results |
| [QA — Sprint 04 Acceptance Plan](./qa/sprint-04-acceptance-test-plan.md) | Acceptance test scenarios for sprint 04 features |

---

## Security

| Document | Description |
|----------|-------------|
| [Threat Model](./security/threat-model.md) | STRIDE analysis, identified threats, mitigations |
| [RLS Rollout](./security/rls-rollout.md) | Row-level security rollout plan and verification |
| [Privacy Events](./security/privacy-events.md) | Privacy-relevant event audit log schema |

---

## Decisions (ADRs)

Architecture Decision Records documenting significant technical choices.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./adr/001-bullmq-decision.md) | BullMQ for async job processing | Accepted |
| [ADR-002](./adr/002-question-srs-fields.md) | Question SRS field schema | Accepted |
| [ADR-003](./adr/003-pass-predictor-v0.md) | Pass predictor v0 model architecture | Accepted |
| [ADR-009](./adr/009-strict-typescript-rollout.md) | Strict TypeScript rollout policy | Accepted |
| [ADR-024](./adr/024-dds-auto-apply-policy.md) | DDS auto-apply proposal-to-approval workflow | Accepted |
| [ADR-025](./adr/025-reputation-model-tiers.md) | Reputation model and tier thresholds | Accepted |
| [ADR-026](./adr/026-dds-auto-apply-ga-canary-policy.md) | DDS auto-apply GA & canary promotion policy | Accepted |
| [ADR-027](./adr/027-reputation-anti-gaming-thresholds.md) | Reputation anti-gaming detection thresholds | Accepted |
| [ADR-028](./adr/028-competency-scoring.md) | Competency scoring algorithm (domain-aggregate approach) | Proposed |

Full ADR index: [adr/00-index.md](./adr/00-index.md)

---

## Team & Process

| Document | Description |
|----------|-------------|
| [Working Agreement](./working-agreement.md) | Team norms, definition of done, PR standards |
| [Help Center — Exam Prep with Study Plans](./help-center/exam-prep-with-study-plans.md) | User-facing guide: using study plans |
| [Help Center — DDS Auto-Apply Promotion](./help-center/dds-auto-apply-promotion.md) | User-facing guide: automatic answer improvement |
| [Help Center — Understanding Reputation Flags](./help-center/understanding-reputation-flags.md) | User-facing guide: reputation and flags |

---

## Releases

| Document | Description |
|----------|-------------|
| [v2.0.0-rc Release Notes](./releases/v2.0.0-rc.md) | Changes in v2.0.0-rc |
| [v2.0.0-rc Release Checklist](./releases/v2.0.0-rc-release-checklist.md) | Pre-release verification checklist |

---

_Last updated: June 2026_
