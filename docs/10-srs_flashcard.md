# Software Requirements Specification (SRS)

## Flashcard Feature — Brain Gym Training Platform

| Field             | Details                                                      |
| ----------------- | ------------------------------------------------------------ |
| **Version**       | 2.1                                                          |
| ----------------- | ------------------------------------------------------------ |
| **Status**        | **Completed (Phase 1-5 Implementation)**                      |
| **Date**          | 2026-03-21                                                   |
| **Platforms**     | Web Browser (Vite + React frontend, NestJS backend)          |
| **Primary Users** | Learners, Contributors, Reviewers                            |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [User Roles](#3-user-roles)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 Flashcard Derivation from Questions
   - 4.2 Custom Flashcard Creation
   - 4.3 In-Exam Word Capture
   - 4.4 Card Collections (Decks)
   - 4.5 Study Mode
   - 4.6 Progress Tracking
   - 4.7 AI-Assisted Features *(future)*
5. [Use Cases](#5-use-cases)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Constraints & Assumptions](#7-constraints--assumptions)
8. [Out of Scope](#8-out-of-scope)
9. [Glossary](#9-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for the **Flashcard** feature of the Brain Gym certification training platform. It describes how flashcards integrate with the existing question bank, spaced repetition engine, and exam simulation system.

### 1.2 Scope

The Flashcard feature enables users to:

1. **Study Questions as Flashcards** — automatically derive flashcards from existing MCQ questions (question → front, correct answer + explanation → back).
2. **Create Custom Flashcards** — manually create term/definition flashcards beyond the question bank, organized into personal **decks**.
3. **Capture Words During Exams** — highlight unfamiliar words/concepts encountered during an exam and convert them into flashcards for later review.
4. **Review via Spaced Repetition** — leverage the existing SM-2 `ReviewSchedule` system for both question-derived and custom flashcards.

### 1.3 Definitions

See [Section 9 — Glossary](#9-glossary).

---

## 2. Overall Description

### 2.1 Product Context

The Flashcard feature extends the existing Brain Gym platform. It integrates with:

- The **Question Bank** (to derive question-based flashcards)
- The **Exam Engine** (to capture in-exam annotations)
- The **Spaced Repetition Engine** (`ReviewSchedule` model with SM-2 algorithm, already implemented)
- The **User / Auth System** (JWT-based, already implemented)
- The **Certification & Domain System** (to organize flashcards by context)

### 2.2 Existing System Assets

| Asset | Status | Detail |
| ----- | ------ | ------ |
| `ReviewSchedule` model | ✅ Implemented | SM-2 fields: `interval`, `easeFactor`, `repetitions`, `nextReviewDate` |
| `TrainingService.submitReview()` | ✅ Implemented | SM-2 algorithm calculates next review |
| `TrainingService.getDueReviews()` | ✅ Implemented | Fetches questions due for SRS review |
| `Flashcards.tsx` (Frontend) | ✅ UI only | Derives flashcards from mock MCQ data (needs backend connection) |
| `flashcardUtils.ts` | ✅ Implemented | `questionsToFlashcards()` helper converting Questions → Flashcards |
| `TrainingHub.tsx` → Daily Review | ✅ Implemented | SRS-based daily review of questions |

### 2.3 Product Features Summary

| #    | Feature Area                     | Brief Description                                            | Priority |
| ---- | -------------------------------- | ------------------------------------------------------------ | -------- |
| F1   | Question-Based Flashcards        | Auto-generate flashcards from MCQ questions (existing behavior, needs backend API) | P1 |
| F2   | Custom Flashcard Creation        | Manually create term/definition flashcards                    | P1 |
| F3   | In-Exam Word Capture             | Highlight words during exams to save as flashcard candidates | P2 |
| F4   | Card Collections (Decks)         | Organize custom flashcards into named decks/collections       | P1 |
| F5   | Study Mode (Flashcard-specific)  | Classic flip mode with SRS self-rating for custom flashcards  | P1 |
| F6   | Progress Tracking                | Per-card mastery level and per-deck statistics                | P2 |
| F7   | AI-Assisted Features             | Auto-generate definitions, detect duplicates *(future)*      | P3 |

---

## 3. User Roles

> Mapped to existing Brain Gym `UserRole` enum: `LEARNER`, `CONTRIBUTOR`, `REVIEWER`, `ADMIN`

| Role              | Description                                | Key Flashcard Permissions                                    |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------ |
| **LEARNER**       | Takes exams and studies certifications      | Create personal flashcards & decks; study; capture in-exam words |
| **CONTRIBUTOR**   | Creates and shares question content         | All LEARNER permissions; can share decks publicly            |
| **REVIEWER**      | Reviews and approves content                | All CONTRIBUTOR permissions                                  |
| **ADMIN**         | Platform administrator                      | Manage all content; configure system-wide settings           |

---

## 4. Functional Requirements

---

### 4.1 Question-Based Flashcards (Enhancement of Existing)

#### Description

The existing `Flashcards.tsx` page derives flashcards from MCQ questions. This needs to be connected to the backend API instead of using mock data.

#### Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| QF-01 | The system shall fetch approved questions from `GET /questions` API and convert them to flashcards (front = question title, back = correct answer + explanation). |
| QF-02 | Users shall be able to filter question-based flashcards by **certification** and **domain**. |
| QF-03 | The existing `questionsToFlashcards()` utility shall be reused for the conversion. |
| QF-04 | Study progress on question-based flashcards shall update `ReviewSchedule` via `POST /training/review`. |

---

### 4.2 Custom Flashcard Creation

#### Description

Users can create standalone flashcards (not derived from questions) with a front/back format, organized into personal decks.

#### Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| FC-01 | The system shall allow a user to create a flashcard with a **front side** (term/question) and a **back side** (definition/answer). |
| FC-02 | Each side of a card shall support **plain text** (required). Rich media (images, LaTeX) is out of scope for v1. |
| FC-03 | Users shall be able to add an optional **hint** field (shown before revealing the back). |
| FC-04 | Users shall be able to add **tags** to cards for filtering and search. |
| FC-05 | Users shall be able to edit or delete any card they own at any time. |
| FC-06 | The system shall record the **creation date**, **last modified date**, and **source** (manual, in-exam capture) for each card. |
| FC-07 | Each custom flashcard shall belong to exactly **one deck** (one-to-many). |

---

### 4.3 In-Exam Word Capture

#### Description

During an active exam, users can highlight or mark words/phrases they are unfamiliar with. These are saved to a **capture queue** and can be converted into flashcards after the exam ends.

#### Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| IE-01 | During an active exam session (`ExamPage.tsx`), the system shall provide a **"Save for Later"** action accessible by selecting/highlighting any word or phrase in a question. |
| IE-02 | Captured words shall be stored in a **personal capture queue** associated with the user's account (new `CapturedWord` model). |
| IE-03 | Capturing a word shall **not interrupt or pause** the exam timer; the action must be completable within 2 seconds. |
| IE-04 | The system shall automatically record the **source context**: exam ID, question ID, and the surrounding sentence. |
| IE-05 | After an exam is submitted, the system shall display a **notification** on the results page if there are unprocessed captured words. |
| IE-06 | From the capture queue, the user shall be able to: (a) convert a word to a flashcard (choosing a target deck), (b) discard it, or (c) defer it. |
| IE-07 | The capture queue shall persist across sessions until the user explicitly clears or processes it. |

---

### 4.4 Card Collections (Decks)

#### Description

Custom flashcards are organized into named decks. Each user can have multiple decks. A deck is scoped to a single user (personal).

#### Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| CD-01 | The system shall allow users to create, rename, and delete named decks. |
| CD-02 | Each deck shall have: a **name** (required), optional **description**, and an optional **certificationId** association. |
| CD-03 | A custom flashcard belongs to **exactly one deck** (one-to-many relationship). |
| CD-04 | The system shall display per-deck statistics: total cards, cards due for review, mastery percentage. |
| CD-05 | Users shall be able to **bulk-import** flashcards via CSV format (columns: front, back, hint, tags). |
| CD-06 | Users shall be able to **export** a deck as CSV. |
| CD-07 | Deleting a deck shall prompt confirmation and delete all contained cards. |

---

### 4.5 Study Mode

#### Description

Users can study their flashcard decks through a **Classic Flip Mode** with spaced repetition self-rating.

#### Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| SM-01 | The system shall offer a **Classic Flip Mode**: display the front of a card, allow the user to reveal the back, then self-rate their recall (Again / Hard / Good / Easy → quality 0-5 for SM-2). |
| SM-02 | The system shall integrate with the existing `ReviewSchedule` / SM-2 system to schedule custom flashcards for review. |
| SM-03 | Users shall be able to configure a study session: choose a specific deck, optionally limit the number of cards, filter by tag. |
| SM-04 | The system shall display a **session summary** at the end (cards reviewed, recall rate, time spent). |
| SM-05 | The system shall support a **"Starred Cards"** feature allowing users to mark cards for focused review. |
| SM-06 | The Daily Review mode in `TrainingHub.tsx` shall include both question-based and custom flashcard reviews. |

---

### 4.6 Progress Tracking

#### Description

The system tracks learning progress per card and per deck.

#### Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| PT-01 | Each custom flashcard shall have a **mastery level** (New / Learning / Review / Mastered) derived from the SRS `ReviewSchedule` data. |
| PT-02 | The system shall show per-deck statistics: total cards, mastery breakdown, next due date. |
| PT-03 | The existing **study streak** counter shall account for flashcard study sessions in addition to question reviews. |
| PT-04 | The Dashboard shall show aggregated flashcard study metrics alongside exam analytics. |

---

### 4.7 AI-Assisted Features *(Future / Optional)*

#### Description

AI-powered enhancements to reduce friction in card creation.

#### Requirements

| ID    | Requirement                                                  | Priority |
| ----- | ------------------------------------------------------------ | -------- |
| AI-01 | The system shall offer to **auto-generate a definition** for a word captured during an exam (via dictionary API or LLM). | Medium |
| AI-02 | The system shall detect **duplicate or near-duplicate cards** and prompt the user to merge them. | Low |
| AI-03 | Users shall be able to **bulk-generate flashcards** by pasting text; the AI extracts key terms and definitions. | Low |

---

## 5. Use Cases

---

### UC-01: Study Questions as Flashcards

| Field              | Detail                                                       |
| ------------------ | ------------------------------------------------------------ |
| **Actor**          | LEARNER                                                      |
| **Precondition**   | User is logged in; approved questions exist for at least one certification |
| **Trigger**        | User navigates to `/flashcards`                               |
| **Main Flow**      | 1. System fetches approved questions from API. 2. User selects a certification to filter (or views all). 3. System displays question-based flashcards (front = question, back = answer). 4. User flips through cards, marks known/unknown. |
| **Postcondition**  | SRS schedule updated for reviewed cards.                     |

---

### UC-02: Create a Custom Flashcard Deck

| Field             | Detail                                                       |
| ----------------- | ------------------------------------------------------------ |
| **Actor**         | LEARNER                                                      |
| **Precondition**  | User is logged in                                            |
| **Trigger**       | User navigates to Flashcards > "New Deck"                    |
| **Main Flow**     | 1. User provides a deck name and optional description. 2. User optionally links a certification. 3. System creates the empty deck. 4. User begins adding custom flashcards (front/back). |
| **Postcondition** | A new deck exists with cards.                                |

---

### UC-03: Capture a Word During an Exam

| Field              | Detail                                                       |
| ------------------ | ------------------------------------------------------------ |
| **Actor**          | LEARNER                                                      |
| **Precondition**   | User is in an active exam session (`ExamPage.tsx`)            |
| **Trigger**        | User encounters an unfamiliar word or phrase                 |
| **Main Flow**      | 1. User selects/highlights the word in the exam interface. 2. System displays a "Save for Later" tooltip/action button. 3. User taps/clicks "Save for Later". 4. System adds the word and context (exam ID, question ID, surrounding sentence) to the capture queue via API. 5. System shows a brief confirmation toast. |
| **Postcondition**  | Word is in the capture queue; exam continues uninterrupted.  |

---

### UC-04: Study a Custom Deck (Spaced Repetition)

| Field              | Detail                                                       |
| ------------------ | ------------------------------------------------------------ |
| **Actor**          | LEARNER                                                      |
| **Precondition**   | User has at least one deck with cards                        |
| **Trigger**        | User opens a deck and selects "Study Now"                    |
| **Main Flow**      | 1. System filters cards due for review based on SRS schedule. 2. User is shown the front of the first due card. 3. User recalls the answer, reveals the back. 4. User self-rates recall (Again / Hard / Good / Easy). 5. System updates the card's next review date via SM-2. 6. Steps 2–5 repeat until session is complete. 7. System displays session summary. |
| **Postcondition**  | Card mastery levels and next review dates are updated.       |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| NF-01 | The in-exam word capture action shall complete (UI feedback) within **500ms**. |
| NF-02 | Flashcard study screens shall load within **1 second** on standard connections. |

### 6.2 Usability

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| NF-03 | The "Save for Later" button in the exam view shall be visually distinct but **not obstruct** exam content. |
| NF-04 | All primary flashcard actions (create, study, manage decks) shall be reachable within **3 clicks** from the home screen. |
| NF-05 | The UI shall follow the existing Brain Gym design system (glass-card, font-mono, glow-cyan, dark theme). |

### 6.3 Reliability

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| NF-06 | All flashcard data shall be **auto-saved** with no risk of loss on accidental navigation away. |
| NF-07 | The flashcard feature shall operate independently of exam engine availability. |

### 6.4 Security & Privacy

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| NF-08 | Flashcard data shall be stored **per user account** and inaccessible to other users. |
| NF-09 | All flashcard endpoints shall be protected by `JwtAuthGuard`. |

---

## 7. Constraints & Assumptions

- The flashcard feature will reuse the existing **JWT authentication and user system**; no new auth mechanism is required.
- AI-assisted features (Section 4.7) are **optional** and depend on integration with a third-party LLM or dictionary API.
- Spaced repetition scheduling will reuse the **existing SM-2 implementation** in `TrainingService`.
- Custom flashcards use a **new `FlashcardReviewSchedule` model** parallel to the existing `ReviewSchedule` (which is tied to Questions).
- In-exam word capture is only available for **text-based exam questions**.
- The frontend uses **TailwindCSS + shadcn/ui** components; flashcard UI will follow the same pattern.
- This is a **web-only** feature; offline/mobile-native support is out of scope.

---

## 8. Out of Scope

The following items are explicitly **not** included in this SRS:

- Audio pronunciation of flashcard terms
- Video or image content on card faces (v1 is text-only)
- Multi-user collaborative deck editing
- Sharing/publishing decks to other users (may be added in a future version)
- Nested decks / sub-collections
- Integration with third-party flashcard platforms (e.g., Anki, Quizlet)
- Offline study mode
- Mobile native apps (iOS, Android)

---

## 9. Glossary

| Term                        | Definition                                                   |
| --------------------------- | ------------------------------------------------------------ |
| **Flashcard**               | A card with a front (question/term) and back (answer/definition). Can be question-derived or custom. |
| **Deck / Collection**       | A named group of custom flashcards organized by topic.       |
| **Capture Queue**           | A temporary holding area for words saved by a user during an exam. |
| **Mastery Level**           | A per-card rating reflecting recall performance: New / Learning / Review / Mastered. |
| **Spaced Repetition (SRS)** | A study technique that schedules card reviews at increasing intervals based on recall difficulty. |
| **SM-2**                    | The spaced repetition algorithm already implemented in `TrainingService.calculateSM2()`. |
| **ReviewSchedule**          | The existing Prisma model for SRS scheduling (tied to questions). |
| **FlashcardReviewSchedule** | A new model for SRS scheduling of custom flashcards.         |
| **Study Streak**            | A count of consecutive days with at least one study session (already tracked locally). |