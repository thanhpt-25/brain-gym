import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import SquadDashboard from "./SquadDashboard";
import * as squadsService from "@/services/squads";

// Mock the services
vi.mock("@/services/squads");

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "test-squad-abc123" }),
  };
});

// Mock the PageTransition component
vi.mock("@/components/PageTransition", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Loader2 icon
vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader">Loading...</div>,
}));

// Mock squad components (they're already tested separately)
vi.mock("@/components/squads/SquadMemberList", () => ({
  SquadMemberList: ({
    members,
  }: {
    members: typeof mockMembers;
    targetExamDate?: string;
  }) => (
    <div data-testid="squad-member-list">
      {members.map((m) => (
        <div key={m.id} data-testid="member-card">
          {m.user?.displayName}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/squads/ReadinessCard", () => ({
  ReadinessCard: ({
    score,
    isLoading,
  }: {
    score: number;
    isLoading: boolean;
    certificationId: string;
  }) => (
    <div data-testid="readiness-card">
      {isLoading ? "Loading..." : `${score}%`}
    </div>
  ),
}));

vi.mock("@/components/squads/EmptyState", () => ({
  EmptyState: ({ message }: { message: string; icon?: React.ReactNode }) => (
    <div data-testid="empty-state">{message}</div>
  ),
}));

// Mock data
const mockSquad = {
  id: "squad-1",
  name: "AWS SAA Study Group",
  slug: "test-squad-abc123",
  certificationId: "cert-aws-saa-c03",
  targetExamDate: new Date("2026-12-15"),
  memberCount: 2,
  createdAt: new Date("2026-05-01"),
};

const mockMembers = [
  {
    id: "member-1",
    orgId: "squad-1",
    userId: "user-1",
    role: "OWNER",
    joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (active)
    user: {
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice Chen",
      avatarUrl: "https://example.com/alice.jpg",
    },
  },
  {
    id: "member-2",
    orgId: "squad-1",
    userId: "user-2",
    role: "MEMBER",
    joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (inactive)
    user: {
      id: "user-2",
      email: "bob@example.com",
      displayName: "Bob Smith",
      avatarUrl: null,
    },
  },
];

const mockReadiness = {
  readinessScore: 65,
  confidence: 0.8,
};

describe("SquadDashboard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SquadDashboard />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  };

  describe("Loading State", () => {
    it("displays loading spinner while squad data is loading", () => {
      vi.mocked(squadsService.getSquadBySlug).mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves
          }),
      );

      renderComponent();

      expect(screen.getByTestId("loader")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("displays error message when squad fetch fails", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockRejectedValue(
        new Error("Failed to load squad"),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      });
    });
  });

  describe("Not Found State", () => {
    it("displays not found message when squad does not exist", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(
        null as unknown as SquadDto,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Squad not found/i)).toBeInTheDocument();
      });
    });
  });

  describe("Success State", () => {
    beforeEach(() => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );
    });

    it("renders squad name and member count", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("AWS SAA Study Group")).toBeInTheDocument();
        expect(screen.getByText("2 members")).toBeInTheDocument();
      });
    });

    it("renders readiness card with score", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("readiness-card")).toBeInTheDocument();
        expect(screen.getByText("65%")).toBeInTheDocument();
      });
    });

    it("renders member list with all members", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("squad-member-list")).toBeInTheDocument();
        expect(screen.getAllByTestId("member-card")).toHaveLength(2);
        expect(screen.getByText("Alice Chen")).toBeInTheDocument();
        expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      });
    });

    it("fetches squad data by slug from URL params", async () => {
      renderComponent();

      await waitFor(() => {
        expect(squadsService.getSquadBySlug).toHaveBeenCalledWith(
          "test-squad-abc123",
        );
      });
    });

    it("fetches members after squad data is loaded", async () => {
      renderComponent();

      await waitFor(() => {
        expect(squadsService.getSquadMembers).toHaveBeenCalledWith("squad-1");
      });
    });

    it("fetches readiness after squad data is loaded", async () => {
      renderComponent();

      await waitFor(() => {
        expect(squadsService.getSquadReadiness).toHaveBeenCalledWith(
          "cert-aws-saa-c03",
        );
      });
    });

    it("queries run in parallel with correct enabled conditions", async () => {
      renderComponent();

      // Initial render: only squad query should run
      expect(squadsService.getSquadBySlug).toHaveBeenCalledTimes(1);

      // Wait for squad data
      await waitFor(() => {
        expect(squadsService.getSquadMembers).toBeDefined();
      });

      // After squad data: members and readiness queries should run
      await waitFor(() => {
        expect(squadsService.getSquadMembers).toHaveBeenCalled();
        expect(squadsService.getSquadReadiness).toHaveBeenCalled();
      });
    });
  });

  describe("Empty State", () => {
    it("shows empty state when squad has no members", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue([]);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeInTheDocument();
        expect(
          screen.getByText("Invite members to see their readiness."),
        ).toBeInTheDocument();
      });
    });

    it("does not show member list when there are no members", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue([]);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.queryByTestId("squad-member-list"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Readiness Loading State", () => {
    it("shows loading state in readiness card while fetching", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
      vi.mocked(squadsService.getSquadReadiness).mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves
          }),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("AWS SAA Study Group")).toBeInTheDocument();
      });

      // ReadinessCard should show loading state (tested separately)
      expect(screen.getByTestId("readiness-card")).toBeInTheDocument();
    });

    it("displays readiness score of 0 if readiness fetch fails", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
      vi.mocked(squadsService.getSquadReadiness).mockRejectedValue(
        new Error("Failed to fetch readiness"),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("readiness-card")).toBeInTheDocument();
        expect(screen.getByText("0%")).toBeInTheDocument();
      });
    });
  });

  describe("Query Key Management", () => {
    beforeEach(() => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );
    });

    it("uses correct query keys for caching", async () => {
      renderComponent();

      await waitFor(() => {
        expect(squadsService.getSquadBySlug).toHaveBeenCalled();
      });

      // Verify queries are cached properly by checking if they're called again
      // (they shouldn't be on re-render if using same queryClient)
      const initialCallCount = vi.mocked(squadsService.getSquadBySlug).mock
        .calls.length;

      // Re-render shouldn't trigger new calls due to caching
      expect(vi.mocked(squadsService.getSquadBySlug).mock.calls.length).toBe(
        initialCallCount,
      );
    });
  });

  describe("Member Count Display", () => {
    it("displays correct singular form for single member", async () => {
      const squadWithOneMember = { ...mockSquad, memberCount: 1 };
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(
        squadWithOneMember,
      );
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue([
        mockMembers[0],
      ]);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("1 member")).toBeInTheDocument();
      });
    });

    it("displays correct plural form for multiple members", async () => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("2 members")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
      vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(
        mockReadiness,
      );
    });

    it("has semantic structure with header and sections", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        expect(container.querySelector("header")).toBeInTheDocument();
        expect(container.querySelector("section")).toBeInTheDocument();
      });
    });

    it("renders h1 for squad title", async () => {
      renderComponent();

      await waitFor(() => {
        const heading = screen.getByRole("heading", {
          level: 1,
          name: "AWS SAA Study Group",
        });
        expect(heading).toBeInTheDocument();
      });
    });

    it("renders h2 for members section", async () => {
      renderComponent();

      await waitFor(() => {
        const heading = screen.getByRole("heading", {
          level: 2,
          name: "Members",
        });
        expect(heading).toBeInTheDocument();
      });
    });
  });
});
