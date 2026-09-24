import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BecomeContributorCard from "../BecomeContributorCard";
import * as service from "@/services/contributorRequests";
import * as certs from "@/services/certifications";
import { useAuthStore } from "@/stores/auth.store";

vi.mock("@/services/contributorRequests", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/contributorRequests")>();
  return {
    ...actual,
    getMyContributorRequest: vi.fn(),
    getContributorEligibility: vi.fn(),
    createContributorRequest: vi.fn(),
    cancelContributorRequest: vi.fn(),
    syncRoleFromServer: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("@/services/certifications", () => ({
  getCertifications: vi.fn(),
}));

const mocked = vi.mocked(service);

// Radix checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const eligible: service.Eligibility = {
  eligible: true,
  checks: [
    { key: "ROLE", passed: true },
    { key: "ACCOUNT_STATUS", passed: true },
    { key: "NO_PENDING_REQUEST", passed: true },
    { key: "COOLDOWN", passed: true },
    { key: "ACCOUNT_AGE", passed: true, current: 20, required: 7 },
    { key: "COMPLETED_ATTEMPTS", passed: true, current: 5, required: 3 },
  ],
};

function setRole(role: string) {
  useAuthStore.setState({
    user: {
      id: "u1",
      email: "l@x.io",
      displayName: "Learner",
      role,
      plan: "FREE",
      orgMemberships: [],
    },
    isAuthenticated: true,
  });
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BecomeContributorCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setRole("LEARNER");
  vi.mocked(certs.getCertifications).mockResolvedValue([
    { id: "c1", code: "SAA-C03", name: "Solutions Architect" } as never,
  ]);
});

describe("BecomeContributorCard", () => {
  it("renders nothing for non-learners", () => {
    setRole("CONTRIBUTOR");
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
    expect(mocked.getMyContributorRequest).not.toHaveBeenCalled();
  });

  it("shows the checklist and disables the button when not eligible", async () => {
    mocked.getMyContributorRequest.mockResolvedValue({
      request: null,
      history: [],
    });
    mocked.getContributorEligibility.mockResolvedValue({
      eligible: false,
      checks: [
        { key: "ACCOUNT_AGE", passed: true, current: 10, required: 7 },
        { key: "COMPLETED_ATTEMPTS", passed: false, current: 1, required: 3 },
      ],
    });

    renderCard();

    expect(await screen.findByText("Completed exams")).toBeDefined();
    expect(screen.getByText("1/3")).toBeDefined();
    expect(
      (
        screen.getByRole("button", {
          name: "Request contributor access",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("submits a valid request", async () => {
    mocked.getMyContributorRequest.mockResolvedValue({
      request: null,
      history: [],
    });
    mocked.getContributorEligibility.mockResolvedValue(eligible);
    mocked.createContributorRequest.mockResolvedValue({} as never);

    renderCard();
    fireEvent.click(
      await screen.findByRole("button", { name: "Request contributor access" }),
    );

    const motivation = await screen.findByLabelText("Motivation");
    fireEvent.change(motivation, { target: { value: "too short" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      await screen.findByText("Please write at least 50 characters"),
    ).toBeDefined();
    expect(mocked.createContributorRequest).not.toHaveBeenCalled();

    fireEvent.change(motivation, {
      target: {
        value:
          "I passed SAA-C03 last year and would love to write scenario questions.",
      },
    });
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() =>
      expect(mocked.createContributorRequest).toHaveBeenCalled(),
    );
    expect(mocked.createContributorRequest.mock.calls[0][0]).toEqual({
      motivation:
        "I passed SAA-C03 last year and would love to write scenario questions.",
      expertise: ["c1"],
      sampleUrl: undefined,
    });
  });

  it("shows pending state with a cancel action", async () => {
    mocked.getMyContributorRequest.mockResolvedValue({
      request: {
        id: "r1",
        status: "PENDING",
        motivation: "x",
        expertise: [],
        createdAt: new Date().toISOString(),
      },
      history: [],
    });
    mocked.cancelContributorRequest.mockResolvedValue({});

    renderCard();

    expect(await screen.findByText("Pending review")).toBeDefined();
    expect(mocked.getContributorEligibility).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    const confirm = await screen.findAllByRole("button", {
      name: "Cancel request",
    });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() =>
      expect(mocked.cancelContributorRequest).toHaveBeenCalled(),
    );
  });

  it("shows the rejection reason and retry date during cooldown", async () => {
    mocked.getMyContributorRequest.mockResolvedValue({
      request: {
        id: "r1",
        status: "REJECTED",
        motivation: "x",
        expertise: [],
        decisionReason: "Please complete more exams first",
        createdAt: new Date().toISOString(),
        retryAfter: new Date(Date.now() + 86400000).toISOString(),
      },
      history: [],
    });

    renderCard();

    expect(
      await screen.findByText("Please complete more exams first"),
    ).toBeDefined();
    expect(screen.getByText(/You can send a new request from/)).toBeDefined();
    expect(mocked.getContributorEligibility).not.toHaveBeenCalled();
  });

  it("syncs the role once the request is approved", async () => {
    mocked.getMyContributorRequest.mockResolvedValue({
      request: {
        id: "r1",
        status: "APPROVED",
        motivation: "x",
        expertise: [],
        createdAt: new Date().toISOString(),
      },
      history: [],
    });
    mocked.getContributorEligibility.mockResolvedValue(eligible);

    renderCard();

    await waitFor(() => expect(mocked.syncRoleFromServer).toHaveBeenCalled());
  });
});
