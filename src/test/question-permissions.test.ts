import { describe, it, expect } from "vitest";
import { canEditQuestion } from "@/lib/question-permissions";

describe("canEditQuestion", () => {
  const question = { author: { id: "owner" } };

  it("lets the author edit, whatever their role", () => {
    expect(canEditQuestion({ id: "owner", role: "LEARNER" }, question)).toBe(true);
  });

  it("falls back to createdBy when author is not included", () => {
    expect(canEditQuestion({ id: "owner", role: "LEARNER" }, { createdBy: "owner" })).toBe(true);
  });

  it.each(["ADMIN", "REVIEWER", "CONTRIBUTOR"])("lets %s edit any question", (role) => {
    expect(canEditQuestion({ id: "someone", role }, question)).toBe(true);
  });

  it("blocks a learner from editing someone else's question", () => {
    expect(canEditQuestion({ id: "someone", role: "LEARNER" }, question)).toBe(false);
  });

  it("blocks anonymous users and missing questions", () => {
    expect(canEditQuestion(null, question)).toBe(false);
    expect(canEditQuestion({ id: "owner", role: "ADMIN" }, null)).toBe(false);
  });
});
