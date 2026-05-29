import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SquadReputationLeaderboard } from "./SquadReputationLeaderboard";
import * as squadsService from "../../services/squads";

vi.mock("../../services/squads");

describe("SquadReputationLeaderboard - S11 Component", () => {
  let queryClient: QueryClient;
  const mockGetLeaderboard = squadsService.getReputationLeaderboard as any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SquadReputationLeaderboard squadId="squad-1" limit={10} {...props} />
      </QueryClientProvider>,
    );
  };

  describe("Loading State", () => {
    it("should display loading spinner while fetching", async () => {
      mockGetLeaderboard.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([]);
            }, 500);
          }),
      );

      renderComponent();
      expect(screen.getByText("Loading leaderboard…")).toBeInTheDocument();
    });

    it("should have aria-busy attribute when loading", async () => {
      mockGetLeaderboard.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([]);
            }, 500);
          }),
      );

      const { container } = renderComponent();
      const loadingDiv = container.querySelector('[aria-busy="true"]');
      expect(loadingDiv).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("should display error message on fetch failure", async () => {
      mockGetLeaderboard.mockRejectedValue(new Error("Network error"));

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load leaderboard."),
        ).toBeInTheDocument();
      });
    });

    it("should have role alert on error", async () => {
      mockGetLeaderboard.mockRejectedValue(new Error("Network error"));

      const { container } = renderComponent();

      await waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should display empty state message when no entries", async () => {
      mockGetLeaderboard.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/No reputation points yet/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Leaderboard Display", () => {
    const mockData = [
      {
        userId: "user-1",
        displayName: "Alice",
        points: 250,
        tier: "gold" as const,
      },
      {
        userId: "user-2",
        displayName: "Bob",
        points: 180,
        tier: "silver" as const,
      },
      {
        userId: "user-3",
        displayName: "Charlie",
        points: 150,
        tier: "bronze" as const,
      },
      {
        userId: "user-4",
        displayName: "Diana",
        points: 120,
        tier: "none" as const,
      },
    ];

    beforeEach(() => {
      mockGetLeaderboard.mockResolvedValue(mockData);
    });

    it("should render leaderboard section with aria-label", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const section = container.querySelector(
          '[aria-label="Squad reputation leaderboard"]',
        );
        expect(section).toBeInTheDocument();
      });
    });

    it("should display all leaderboard entries", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
        expect(screen.getByText("Charlie")).toBeInTheDocument();
        expect(screen.getByText("Diana")).toBeInTheDocument();
      });
    });

    it("should display reputation points for each entry", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("250 pts")).toBeInTheDocument();
        expect(screen.getByText("180 pts")).toBeInTheDocument();
        expect(screen.getByText("150 pts")).toBeInTheDocument();
        expect(screen.getByText("120 pts")).toBeInTheDocument();
      });
    });

    it("should render ordered list", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const ol = container.querySelector("ol");
        expect(ol).toBeInTheDocument();
        expect(ol?.children.length).toBe(4);
      });
    });

    it("should display tier badges for gold, silver, bronze", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText("Gold tier")).toBeInTheDocument();
        expect(screen.getByLabelText("Silver tier")).toBeInTheDocument();
        expect(screen.getByLabelText("Bronze tier")).toBeInTheDocument();
      });
    });

    it("should not display tier badge for none tier", async () => {
      renderComponent();

      await waitFor(() => {
        const dianaItem = screen.getByText("Diana").closest("li");
        expect(dianaItem?.querySelector(".rep-tier")).not.toBeInTheDocument();
      });
    });
  });

  describe("Current User Highlighting", () => {
    const mockData = [
      {
        userId: "user-1",
        displayName: "Alice",
        points: 250,
        tier: "gold" as const,
      },
      {
        userId: "current-user",
        displayName: "Me",
        points: 180,
        tier: "silver" as const,
      },
    ];

    beforeEach(() => {
      mockGetLeaderboard.mockResolvedValue(mockData);
    });

    it("should highlight current user entry with aria-current", async () => {
      const { container } = renderComponent({ currentUserId: "current-user" });

      await waitFor(() => {
        const meItem = screen.getByText("Me").closest("li");
        expect(meItem?.getAttribute("aria-current")).toBe("true");
      });
    });

    it("should append you label to current user name", async () => {
      renderComponent({ currentUserId: "current-user" });

      await waitFor(() => {
        expect(screen.getByText("(you)")).toBeInTheDocument();
      });
    });

    it("should not highlight other users", async () => {
      const { container } = renderComponent({ currentUserId: "current-user" });

      await waitFor(() => {
        const aliceItem = screen.getByText("Alice").closest("li");
        expect(aliceItem?.getAttribute("aria-current")).not.toBe("true");
      });
    });
  });

  describe("Anonymous Users", () => {
    const mockData = [
      {
        userId: "user-1",
        displayName: null,
        points: 100,
        tier: "none" as const,
      },
    ];

    beforeEach(() => {
      mockGetLeaderboard.mockResolvedValue(mockData);
    });

    it("should display Anonymous for null displayName", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Anonymous")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    const mockData = [
      {
        userId: "user-1",
        displayName: "Alice",
        points: 250,
        tier: "gold" as const,
      },
    ];

    beforeEach(() => {
      mockGetLeaderboard.mockResolvedValue(mockData);
    });

    it("should have semantic section element", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const section = container.querySelector("section");
        expect(section).toBeInTheDocument();
      });
    });

    it("should have h3 heading for leaderboard title", async () => {
      renderComponent();

      await waitFor(() => {
        const h3 = screen.getByText("Reputation Leaderboard");
        expect(h3.tagName).toBe("H3");
      });
    });

    it("should have aria-label on rank spans", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const rankSpan = container.querySelector('[aria-label^="Rank"]');
        expect(rankSpan).toBeInTheDocument();
      });
    });

    it("should have aria-label on points spans", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const pointsSpan = container.querySelector('[aria-label$="points"]');
        expect(pointsSpan).toBeInTheDocument();
      });
    });
  });
});
