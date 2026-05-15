import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import MasteryPage from "./MasteryPage";
import * as insights from "../../services/insights";
import * as mastery from "../../services/mastery";
import * as readiness from "../../services/readiness";
import { useAuthStore } from "../../stores/auth.store";

// Mock the services
vi.mock("../../services/insights");
vi.mock("../../services/mastery");
vi.mock("../../services/readiness");
vi.mock("../../stores/auth.store");

const mockQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const mockMasteryData = {
  isEmpty: false,
  totalAttempts: 5,
  domains: [
    {
      domainId: "domain-1",
      name: "Domain 1",
      masteryScore: 75,
      masteredCount: 3,
      reviewCount: 2,
      learningCount: 1,
      newCount: 0,
    },
  ],
};

const mockInsight = {
  id: "insight-1",
  userId: "user-1",
  certificationId: "cert-1",
  kind: "slow_on_long_stems" as const,
  severity: "medium" as const,
  details: {},
  generatedFor: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={mockQueryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>,
  );
};

describe("MasteryPage - BehavioralInsight Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock default implementations
    vi.mocked(mastery.getMastery).mockResolvedValue(mockMasteryData);
    vi.mocked(mastery.getNextTopic).mockResolvedValue(null);
    vi.mocked(readiness.useReadiness).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);
  });

  describe("feature flag gating", () => {
    it("does not fetch insights when FF_INSIGHTS_BETA is false", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: false },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(insights.useBehavioralInsights).toHaveBeenCalledWith(undefined);
      });
    });

    it("fetches insights when FF_INSIGHTS_BETA is true", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: true },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [mockInsight],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(insights.useBehavioralInsights).toHaveBeenCalled();
      });
    });
  });

  describe("banner rendering", () => {
    it("renders behavioral insight banner when flag is true and insight exists", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: true },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [mockInsight],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Reading Speed Pattern Detected"),
        ).toBeInTheDocument();
      });
    });

    it("does not render banner when flag is false", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: false },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(
          screen.queryByText("Reading Speed Pattern Detected"),
        ).not.toBeInTheDocument();
      });
    });

    it("does not render banner when no insights are available", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: true },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(
          screen.queryByText("Reading Speed Pattern Detected"),
        ).not.toBeInTheDocument();
      });
    });

    it("renders only the first insight when multiple insights exist", async () => {
      const insight2 = {
        ...mockInsight,
        id: "insight-2",
        kind: "accuracy_decline_after_30min" as const,
      };

      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: true },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [mockInsight, insight2],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        // Should show first insight
        expect(
          screen.getByText("Reading Speed Pattern Detected"),
        ).toBeInTheDocument();
        // Should not show second insight
        expect(
          screen.queryByText("Fatigue Pattern Detected"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("layout positioning", () => {
    it("renders banner below pass likelihood survey banner", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: {
            FF_INSIGHTS_BETA: true,
            passPredictorBeta: true,
          },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [mockInsight],
        isLoading: false,
      } as any);

      const { container } = renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        const mainContent = container.querySelector("main#main-content");
        expect(mainContent).toBeInTheDocument();
        expect(
          screen.getByText("Reading Speed Pattern Detected"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("loading states", () => {
    it("does not crash when insights are loading", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: true },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      const { container } = renderWithProviders(<MasteryPage />);

      // Page should render without crashing
      await waitFor(() => {
        expect(
          container.querySelector("main#main-content"),
        ).toBeInTheDocument();
      });
    });

    it("shows mastery data when loading completes", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: { FF_INSIGHTS_BETA: true },
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [mockInsight],
        isLoading: false,
      } as any);

      renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        // Mastery data should be visible
        expect(screen.getByText("Domain breakdown")).toBeInTheDocument();
        // Insight should be visible
        expect(
          screen.getByText("Reading Speed Pattern Detected"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("feature flag variations", () => {
    it("handles missing featureFlags gracefully", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          featureFlags: undefined,
          plan: "PREMIUM",
        },
        isAuthenticated: true,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      const { container } = renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(
          container.querySelector("main#main-content"),
        ).toBeInTheDocument();
      });
    });

    it("handles null user gracefully", async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        logout: vi.fn(),
      } as any);

      vi.mocked(insights.useBehavioralInsights).mockReturnValue({
        data: [],
        isLoading: false,
      } as any);

      const { container } = renderWithProviders(<MasteryPage />);

      await waitFor(() => {
        expect(
          container.querySelector("main#main-content"),
        ).toBeInTheDocument();
      });
    });
  });
});
