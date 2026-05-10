# Sprint 04 Acceptance Test Plan (Partial)

**Status:** Draft / Active
**Scope:** Features implemented so far in Sprint 04 (As of 2026-05-10)

## Overview
This acceptance test plan covers the completed stories for Sprint 04 so far. Currently, **US-408: Predictor accuracy harness + 200-user beta opt-in** is the only fully implemented and ready-to-test feature.

The goal of this test plan is to verify that the beta opt-in feature flag correctly controls survey visibility, that users can submit their pass-likelihood survey, and that data integrity (including database constraints) is maintained.

---

## Prerequisites
1. **Test Accounts:**
   - Account A: A standard user without the beta feature flag (`User.featureFlags.passPredictorBeta = false` or `undefined`).
   - Account B: A premium/beta user with the beta feature flag (`User.featureFlags.passPredictorBeta = true`).
2. **Environment:** 
   - Local Docker stack or staging environment with Sprint 04 code deployed.
   - Access to PostgreSQL database to verify constraints and rows.

---

## Test Cases for US-408

### TC01: Beta Opt-In Feature Flag Enforcement (Frontend)
**Objective:** Verify that the survey banner is only visible to users in the beta cohort.
- **Step 1:** Log in as **Account A** (Non-beta user).
- **Step 2:** Navigate to the Mastery Dashboard (`/dashboard/mastery`).
- **Expected Result:** The Pass Likelihood Survey banner should **not** be displayed.
- **Step 3:** Log in as **Account B** (Beta user).
- **Step 4:** Navigate to the Mastery Dashboard.
- **Expected Result:** The Pass Likelihood Survey banner should be prominently displayed, prompting the user with the question: "How likely are you to pass on first try?".

### TC02: Survey Interaction and Successful Submission
**Objective:** Verify that a beta user can successfully submit their pass likelihood score.
- **Step 1:** Log in as **Account B**.
- **Step 2:** On the Mastery Dashboard, locate the Pass Likelihood Survey banner.
- **Step 3:** Select a score (e.g., `8` on the 1-10 scale) and click "Submit".
- **Expected Result:** 
  - The UI should display a success confirmation message.
  - The banner should be dismissed or marked as completed.
  - The database table `pass_likelihood_surveys` should contain a new row with `userId` of Account B, the target `certId`, and a `score` of 8.

### TC03: One-Response-Per-User Constraint
**Objective:** Verify that the system prevents duplicate submissions for the same certification.
- **Step 1:** Using **Account B**, attempt to submit the survey again via the UI (if still accessible) or by directly hitting the `POST /api/v1/surveys/pass-likelihood` endpoint using Postman/cURL with the same `certId`.
- **Expected Result:** 
  - The backend should reject the duplicate submission (e.g., returning a `400 Bad Request` or `409 Conflict`).
  - No new rows should be added to the `pass_likelihood_surveys` table for that `userId`/`certId` combination, enforcing the unique database constraint.

### TC04: Invalid Data Rejection
**Objective:** Verify that invalid survey scores are rejected by the backend validation.
- **Step 1:** As **Account B**, intercept the survey submission request or use an API client to send a `POST` request to the survey endpoint.
- **Step 2:** Submit a score of `0` (below minimum) and a score of `11` (above maximum).
- **Expected Result:** The backend should return a `400 Bad Request` validation error. No data should be saved to the database.

### TC05: Privacy & Audit Logging Verification
**Objective:** Ensure that data saved respects the documented privacy bounds.
- **Step 1:** Check the `pass_likelihood_surveys` table directly in the database.
- **Expected Result:** Data should only include required fields (`userId`, `certId`, `score`, and timestamps). It should match the schema constraints and follow guidelines listed in `docs/security/privacy-events.md`.

### TC06: Predictor Validation Harness (Backend Script)
**Objective:** Verify that the data science notebook/script executes correctly.
- **Step 1:** Ensure there is some mock data in `readiness_scores` and `pass_likelihood_surveys`.
- **Step 2:** Run the `backend/scripts/predictor-validation.md` notebook (or its executable equivalent).
- **Expected Result:** The script should successfully pull records and calculate the Pearson **r** correlation without throwing errors.

---

## Next Steps
As more stories (e.g., US-401 Readiness Score job, US-405 Time Pressure Mode, US-406 RLS) are merged and marked as implemented, this test plan will be expanded with their respective Acceptance Test Cases.
