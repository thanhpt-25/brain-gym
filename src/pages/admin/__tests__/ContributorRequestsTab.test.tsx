import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ContributorRequestsTab from "../ContributorRequestsTab";
import * as service from "@/services/contributorRequests";
import { toast } from "sonner";

vi.mock("@/services/contributorRequests", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/contributorRequests")>();
  return {
    ...actual,
    getAdminContributorRequests: vi.fn(),
    getAdminContributorRequest: vi.fn(),
    approveContributorRequest: vi.fn(),
    rejectContributorRequest: vi.fn(),
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mocked = vi.mocked(service);

const request: service.AdminContributorRequest = {
  id: "r1",
  userId: "u1",
  status: "PENDING",
  motivation: "I want to help write AWS questions for the community.",
  expertise: ["c1"],
  sampleUrl: "https://example.com/me",
  createdAt: "2026-09-20T00:00:00.000Z",
  user: {
    id: "u1",
    email: "learner@x.io",
    displayName: "Lan Learner",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    role: "LEARNER",
    points: 120,
  },
  expertiseCertifications: [{ id: "c1", code: "SAA-C03", name: "SAA" }],
  stats: {
    completedAttempts: 6,
    avgScore: 78.5,
    commentsCount: 2,
    reportsFiled: 0,
    previousRequests: { rejected: 0, cancelled: 0 },
  },
};

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ContributorRequestsTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getAdminContributorRequests.mockResolvedValue({
    data: [request],
    meta: { total: 1, page: 1, limit: 20, lastPage: 1 },
  });
  mocked.getAdminContributorRequest.mockResolvedValue({
    ...request,
    history: [],
  });
});

describe("ContributorRequestsTab", () => {
  it("lists pending requests with activity stats", async () => {
    renderTab();
    expect(await screen.findByText("Lan Learner")).toBeDefined();
    expect(screen.getByText("78.5%")).toBeDefined();
    expect(screen.getByText("SAA-C03")).toBeDefined();
    expect(mocked.getAdminContributorRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING", page: 1 }),
    );
  });

  it("approves with an optional note", async () => {
    mocked.approveContributorRequest.mockResolvedValue({});
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.change(await screen.findByLabelText("Note (optional)"), {
      target: { value: "Welcome!" },
    });
    const buttons = screen.getAllByRole("button", { name: "Approve" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(mocked.approveContributorRequest).toHaveBeenCalledWith(
        "r1",
        "Welcome!",
      ),
    );
  });

  it("requires a reason of at least 10 characters to reject", async () => {
    mocked.rejectContributorRequest.mockResolvedValue({});
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const reason = await screen.findByLabelText("Reason (required)");
    const submit = () => {
      const buttons = screen.getAllByRole("button", { name: "Reject" });
      return buttons[buttons.length - 1] as HTMLButtonElement;
    };

    fireEvent.change(reason, { target: { value: "short" } });
    expect(submit().disabled).toBe(true);

    fireEvent.change(reason, {
      target: { value: "Please complete more practice exams first" },
    });
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mocked.rejectContributorRequest).toHaveBeenCalledWith(
        "r1",
        "Please complete more practice exams first",
      ),
    );
  });

  it("explains a 409 when another admin already handled it", async () => {
    mocked.approveContributorRequest.mockRejectedValue({
      response: { status: 409, data: { code: "REQUEST_NOT_PENDING" } },
    });
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const buttons = await screen.findAllByRole("button", { name: "Approve" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This request was already handled by someone else",
      ),
    );
  });
});
