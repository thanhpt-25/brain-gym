import { test, expect, type Page } from "@playwright/test";

/**
 * Exam Interactive Mode (docs/specs/exam-interactive-mode-srs.md).
 *
 * Fully mocked: the API is stubbed with page.route and the auth store is
 * seeded in localStorage, so this runs without a backend or credentials.
 */

const CERT = {
  id: "cert-1",
  code: "AWS-SAA",
  name: "Solutions Architect",
  provider: { id: "p1", name: "AWS", slug: "aws" },
  domains: [],
};

const QUESTIONS = [
  {
    id: "q1",
    title: "Which service stores objects?",
    questionType: "SINGLE",
    difficulty: "EASY",
    tags: [],
    sortOrder: 0,
    choices: [
      { id: "c1", label: "a", content: "Amazon EC2" },
      { id: "c2", label: "b", content: "Amazon S3" },
    ],
  },
  {
    id: "q2",
    title: "Pick the managed relational database",
    questionType: "SINGLE",
    difficulty: "EASY",
    tags: [],
    sortOrder: 1,
    choices: [
      { id: "d1", label: "a", content: "Amazon RDS" },
      { id: "d2", label: "b", content: "AWS Lambda" },
    ],
  },
];

const CHECKS: Record<string, object> = {
  q1: {
    questionId: "q1",
    isCorrect: false,
    selectedChoiceIds: ["c1"],
    correctChoiceIds: ["c2"],
    explanation: "**Amazon S3** is object storage; EC2 provides compute.",
    checkedAt: "2026-09-25T00:00:10.000Z",
  },
  q2: {
    questionId: "q2",
    isCorrect: true,
    selectedChoiceIds: ["d1"],
    correctChoiceIds: ["d1"],
    explanation: "RDS is the managed relational database service.",
    checkedAt: "2026-09-25T00:00:20.000Z",
  },
};

async function mockApi(page: Page, calls: { start?: unknown[] }) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          user: {
            id: "user-1",
            email: "learner@e2e.local",
            displayName: "Learner",
            role: "LEARNER",
          },
          accessToken: "e2e-token",
          refreshToken: "e2e-refresh",
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  });

  // Anything not stubbed below gets an empty, harmless response.
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await page.route("**/api/v1/certifications/cert-1", (route) =>
    route.fulfill({ status: 200, json: CERT }),
  );
  await page.route("**/api/v1/questions?**", (route) =>
    route.fulfill({ status: 200, json: { data: [], meta: { total: 2 } } }),
  );
  await page.route("**/api/v1/exams", (route) =>
    route.fulfill({ status: 201, json: { id: "exam-1" } }),
  );
  await page.route("**/api/v1/exams/exam-1/start", (route) => {
    const body = route.request().postDataJSON() ?? {};
    calls.start?.push(body);
    return route.fulfill({
      status: 201,
      json: {
        attemptId: "att-1",
        examId: "exam-1",
        title: "AWS-SAA Practice Exam",
        certification: CERT,
        timeLimit: 180,
        timerMode: "STRICT",
        feedbackMode: body.feedbackMode ?? "END_OF_EXAM",
        totalQuestions: QUESTIONS.length,
        questions: QUESTIONS,
      },
    });
  });
  await page.route("**/api/v1/attempts/att-1/check", (route) => {
    const { questionId } = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: CHECKS[questionId] });
  });
  await page.route("**/api/v1/attempts/att-1/submit", (route) =>
    route.fulfill({
      status: 201,
      json: {
        attemptId: "att-1",
        examId: "exam-1",
        examTitle: "AWS-SAA Practice Exam",
        certification: CERT,
        status: "SUBMITTED",
        feedbackMode: "INTERACTIVE",
        score: 50,
        totalCorrect: 1,
        totalQuestions: 2,
        percentage: 50,
        domainScores: {},
        timeSpent: 60,
        startedAt: "2026-09-25T00:00:00.000Z",
        submittedAt: "2026-09-25T00:01:00.000Z",
        questionResults: [],
      },
    }),
  );
}

test.describe("Exam interactive mode", () => {
  test("check each answer, read the explanation, then finish", async ({
    page,
  }) => {
    const calls = { start: [] as unknown[] };
    await mockApi(page, calls);

    await page.goto("/exam/cert-1");
    await page.getByRole("radio", { name: /interactive/i }).click();
    await page.getByRole("button", { name: /start exam/i }).click();

    await expect(page.getByText("Which service stores objects?")).toBeVisible();
    expect(calls.start).toEqual([{ feedbackMode: "INTERACTIVE" }]);

    // Q1 — wrong answer.
    const check = page.getByRole("button", { name: /check answer/i });
    await expect(check).toBeDisabled();
    await page.getByRole("button", { name: /Amazon EC2/ }).click();
    await check.click();

    const feedback = page.getByTestId("answer-feedback");
    await expect(feedback.getByText("Incorrect")).toBeVisible();
    await expect(feedback.getByText("Amazon S3", { exact: true })).toBeVisible();
    await expect(
      feedback.getByText("is object storage; EC2 provides compute."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Amazon S3/ })).toBeDisabled();

    // Q2 — right answer, then finish.
    await page.getByRole("button", { name: /next question/i }).click();
    await expect(
      page.getByText("Pick the managed relational database"),
    ).toBeVisible();
    await page.getByRole("button", { name: /Amazon RDS/ }).click();
    await page.getByRole("button", { name: /check answer/i }).click();
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(page.getByTestId("interactive-score")).toHaveAccessibleName(
      "1 correct, 1 incorrect",
    );

    await page.getByRole("button", { name: /finish exam/i }).click();
    await expect(page.getByText("50%")).toBeVisible();
    await expect(page.getByText("Interactive", { exact: true })).toBeVisible();
  });

  test("Exam mode is unchanged: no Check button", async ({ page }) => {
    const calls = { start: [] as unknown[] };
    await mockApi(page, calls);

    await page.goto("/exam/cert-1");
    await page.getByRole("button", { name: /start exam/i }).click();

    await expect(page.getByText("Which service stores objects?")).toBeVisible();
    expect(calls.start).toEqual([{ feedbackMode: "END_OF_EXAM" }]);
    await expect(
      page.getByRole("button", { name: /check answer/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^next/i })).toBeVisible();
  });
});
