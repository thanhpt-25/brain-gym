import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProofSection } from "../ProofSection";
import * as analyticsService from "@/services/analytics";
import * as gamificationService from "@/services/gamification";

vi.mock("@/services/analytics");
vi.mock("@/services/gamification");

const mockGetPlatformStats = vi.spyOn(analyticsService, "getPlatformStats");
const mockGetLeaderboard = vi.spyOn(gamificationService, "getLeaderboard");

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProofSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLeaderboard.mockResolvedValue([]);
});

describe("ProofSection", () => {
  it("hides the pass-rate stat when there are too few attempts to be meaningful", async () => {
    mockGetPlatformStats.mockResolvedValue({
      totalQuestions: 500,
      totalCertifications: 4,
      totalExamAttempts: 3,
      averagePassRate: 100,
    });

    renderSection();

    await waitFor(() => expect(screen.getByText("500")).toBeInTheDocument());
    expect(screen.queryByText(/avg\. practice score/i)).not.toBeInTheDocument();
  });

  it("shows the pass-rate stat once there are enough attempts", async () => {
    mockGetPlatformStats.mockResolvedValue({
      totalQuestions: 500,
      totalCertifications: 4,
      totalExamAttempts: 40,
      averagePassRate: 62,
    });

    renderSection();

    await waitFor(() => expect(screen.getByText("62%")).toBeInTheDocument());
    expect(screen.getByText(/avg\. practice score/i)).toBeInTheDocument();
  });
});
