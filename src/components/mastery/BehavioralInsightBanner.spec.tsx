import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BehavioralInsightBanner } from "./BehavioralInsightBanner";
import type { BehavioralInsight } from "../../services/insights";

describe("BehavioralInsightBanner", () => {
  const mockInsight: BehavioralInsight = {
    id: "insight-1",
    userId: "user-1",
    certificationId: "cert-1",
    kind: "slow_on_long_stems",
    severity: "medium",
    details: {},
    generatedFor: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("rendering insight kinds", () => {
    it("renders slow_on_long_stems insight with correct title and description", () => {
      const insight: BehavioralInsight = {
        ...mockInsight,
        kind: "slow_on_long_stems",
      };

      render(<BehavioralInsightBanner insight={insight} />);

      expect(
        screen.getByText("Reading Speed Pattern Detected"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "You tend to take longer on questions with longer text. Practice skimming key details.",
        ),
      ).toBeInTheDocument();
    });

    it("renders accuracy_decline_after_30min insight with correct title and description", () => {
      const insight: BehavioralInsight = {
        ...mockInsight,
        kind: "accuracy_decline_after_30min",
      };

      render(<BehavioralInsightBanner insight={insight} />);

      expect(screen.getByText("Fatigue Pattern Detected")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Your accuracy drops after 30 minutes of studying. Take breaks more frequently.",
        ),
      ).toBeInTheDocument();
    });

    it("renders domain_streak_break insight with correct title and description", () => {
      const insight: BehavioralInsight = {
        ...mockInsight,
        kind: "domain_streak_break",
      };

      render(<BehavioralInsightBanner insight={insight} />);

      expect(screen.getByText("Domain Review Needed")).toBeInTheDocument();
      expect(
        screen.getByText(
          "You haven't reviewed this domain in over a week. Spaced repetition works best with consistency.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("dismiss functionality", () => {
    it("displays dismiss button", () => {
      render(<BehavioralInsightBanner insight={mockInsight} />);

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it("hides banner when dismiss button is clicked", () => {
      const { rerender } = render(
        <BehavioralInsightBanner insight={mockInsight} />,
      );

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      fireEvent.click(dismissButton);

      // Re-render with same insight to simulate component update
      rerender(<BehavioralInsightBanner insight={mockInsight} />);

      // Banner should not be visible (returns null)
      expect(
        screen.queryByText("Reading Speed Pattern Detected"),
      ).not.toBeInTheDocument();
    });

    it("persists dismiss state to localStorage", () => {
      render(<BehavioralInsightBanner insight={mockInsight} />);

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(localStorage.getItem(`dismissed_insight_${mockInsight.id}`)).toBe(
        "true",
      );
    });

    it("does not render if already dismissed in localStorage", () => {
      localStorage.setItem(`dismissed_insight_${mockInsight.id}`, "true");

      render(<BehavioralInsightBanner insight={mockInsight} />);

      expect(
        screen.queryByText("Reading Speed Pattern Detected"),
      ).not.toBeInTheDocument();
    });

    it("renders if localStorage has false value", () => {
      localStorage.setItem(`dismissed_insight_${mockInsight.id}`, "false");

      render(<BehavioralInsightBanner insight={mockInsight} />);

      expect(
        screen.getByText("Reading Speed Pattern Detected"),
      ).toBeInTheDocument();
    });
  });

  describe("severity-based styling", () => {
    it("applies high severity background color", () => {
      const insight: BehavioralInsight = {
        ...mockInsight,
        severity: "high",
      };

      const { container } = render(
        <BehavioralInsightBanner insight={insight} />,
      );
      const alertElement = container.querySelector(".bg-red-50");

      expect(alertElement).toBeInTheDocument();
    });

    it("applies medium severity background color", () => {
      const insight: BehavioralInsight = {
        ...mockInsight,
        severity: "medium",
      };

      const { container } = render(
        <BehavioralInsightBanner insight={insight} />,
      );
      const alertElement = container.querySelector(".bg-orange-50");

      expect(alertElement).toBeInTheDocument();
    });

    it("applies low severity background color", () => {
      const insight: BehavioralInsight = {
        ...mockInsight,
        severity: "low",
      };

      const { container } = render(
        <BehavioralInsightBanner insight={insight} />,
      );
      const alertElement = container.querySelector(".bg-amber-50");

      expect(alertElement).toBeInTheDocument();
    });
  });

  describe("multiple insights with different IDs", () => {
    it("dismisses only the specific insight, not all insights", () => {
      const insight1: BehavioralInsight = {
        ...mockInsight,
        id: "insight-1",
        kind: "slow_on_long_stems",
      };
      const insight2: BehavioralInsight = {
        ...mockInsight,
        id: "insight-2",
        kind: "accuracy_decline_after_30min",
      };

      // Render first insight
      const { rerender } = render(
        <BehavioralInsightBanner insight={insight1} />,
      );
      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      fireEvent.click(dismissButton);

      // Verify first is dismissed
      expect(localStorage.getItem(`dismissed_insight_${insight1.id}`)).toBe(
        "true",
      );

      // Render second insight (should show)
      rerender(<BehavioralInsightBanner insight={insight2} />);
      expect(screen.getByText("Fatigue Pattern Detected")).toBeInTheDocument();

      // Verify second is not dismissed
      expect(localStorage.getItem(`dismissed_insight_${insight2.id}`)).not.toBe(
        "true",
      );
    });
  });

  describe("edge cases", () => {
    it("handles localStorage errors gracefully", () => {
      const storageError = new Error("QuotaExceededError");
      vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw storageError;
      });

      expect(() => {
        render(<BehavioralInsightBanner insight={mockInsight} />);
      }).not.toThrow();
    });

    it("renders with different insight details object shapes", () => {
      const insightWithComplexDetails: BehavioralInsight = {
        ...mockInsight,
        details: {
          avgReadingTime: 45.5,
          medianReadingTime: 40,
          questionsAffected: 12,
          percentageSlow: 67,
        },
      };

      render(<BehavioralInsightBanner insight={insightWithComplexDetails} />);

      expect(
        screen.getByText("Reading Speed Pattern Detected"),
      ).toBeInTheDocument();
    });
  });
});
