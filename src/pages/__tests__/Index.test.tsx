import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Index from "../Index";
import * as certificationsService from "@/services/certifications";
import * as analyticsService from "@/services/analytics";
import * as gamificationService from "@/services/gamification";
import { useAuthStore } from "@/stores/auth.store";

vi.mock("@/services/certifications");
vi.mock("@/services/analytics");
vi.mock("@/services/gamification");
vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));

const mockGetCertifications = vi.spyOn(certificationsService, "getCertifications");
const mockGetPlatformStats = vi.spyOn(analyticsService, "getPlatformStats");
const mockGetLeaderboard = vi.spyOn(gamificationService, "getLeaderboard");

function renderIndex() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ isAuthenticated: false, user: null } as never);
  mockGetPlatformStats.mockResolvedValue({
    totalQuestions: 0,
    totalCertifications: 0,
    totalExamAttempts: 0,
    averagePassRate: 0,
  });
  mockGetLeaderboard.mockResolvedValue([]);
});

describe("Index landing page", () => {
  it("does not show fabricated testimonials", async () => {
    mockGetCertifications.mockResolvedValue([]);
    renderIndex();

    await waitFor(() =>
      expect(screen.getAllByText(/reconnecting to live data/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/Priya S\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Marcus T\./)).not.toBeInTheDocument();
  });

  it("marks certifications as a preview and disables actions when the API has no live data", async () => {
    mockGetCertifications.mockResolvedValue([]);
    renderIndex();

    await waitFor(() =>
      expect(screen.getAllByText(/reconnecting to live data/i).length).toBeGreaterThan(0),
    );
  });

  it("no longer claims the exam adapts question-by-question", async () => {
    mockGetCertifications.mockResolvedValue([]);
    renderIndex();

    await waitFor(() => screen.getAllByText(/reconnecting to live data/i));
    expect(
      screen.queryByText(/right questions.*harder/i),
    ).not.toBeInTheDocument();
  });
});
