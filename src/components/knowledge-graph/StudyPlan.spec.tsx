import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { StudyPlanPanel } from "./StudyPlan";
import * as knowledgeGraphService from "../../services/knowledgeGraph";

// Mock the service functions
vi.mock("../../services/knowledgeGraph");

describe("StudyPlanPanel", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const mockPlans = [
    {
      id: "plan-1",
      targetCertId: "cert-1",
      sourceCertIds: ["cert-2"],
      skipTopics: ["Topic A", "Topic B"],
      mustLearnTopics: ["Topic C"],
      effortReductionPct: 45,
      totalTopics: 100,
      skippableCount: 45,
      createdAt: "2024-01-15T10:00:00Z",
    },
  ];

  const renderComponent = (targetCertId: string = "cert-1") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <StudyPlanPanel targetCertId={targetCertId} targetCertName="AWS" />
        <Toaster />
      </QueryClientProvider>,
    );
  };

  it("renders study plan panel with title and generate button", () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue([]);

    renderComponent();

    expect(screen.getByText(/Study Plans — AWS/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generate Plan/ }),
    ).toBeInTheDocument();
  });

  it("displays empty state when no plans exist", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText(/No plans yet. Generate one/),
      ).toBeInTheDocument();
    });
  });

  it("displays plans filtered by target certification", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue([
      ...mockPlans,
      {
        id: "plan-2",
        targetCertId: "cert-2",
        sourceCertIds: ["cert-1"],
        skipTopics: [],
        mustLearnTopics: ["Topic D"],
        effortReductionPct: 20,
        totalTopics: 50,
        skippableCount: 10,
        createdAt: "2024-01-16T10:00:00Z",
      },
    ]);

    renderComponent("cert-1");

    await waitFor(() => {
      const cards = screen.getAllByText(/% effort saved/);
      expect(cards).toHaveLength(1);
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });
  });

  it("shows plan details when card is expanded", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    expect(screen.getByText(/Can skip \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Topic A/)).toBeInTheDocument();
    expect(screen.getByText(/Topic B/)).toBeInTheDocument();
    expect(screen.getByText(/Must study \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Topic C/)).toBeInTheDocument();
  });

  it("shows Schedule button when plan is expanded", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    expect(
      screen.getByRole("button", { name: /Schedule/ }),
    ).toBeInTheDocument();
  });

  it("disables Schedule button when plan lacks ID", async () => {
    const planWithoutId = { ...mockPlans[0], id: undefined };
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue([
      planWithoutId as any,
    ]);
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    expect(scheduleBtn).toBeDisabled();
  });

  it("calls scheduleFromPlan when Schedule button is clicked", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockResolvedValue({
      scheduled: 45,
      alreadyExisted: 0,
    });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(knowledgeGraphService.scheduleFromPlan).toHaveBeenCalledWith(
        "plan-1",
      );
    });
  });

  it("shows success toast when scheduling succeeds", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockResolvedValue({
      scheduled: 45,
      alreadyExisted: 0,
    });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Scheduled 45 questions/)).toBeInTheDocument();
    });
  });

  it("shows success toast with already-existed count", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockResolvedValue({
      scheduled: 40,
      alreadyExisted: 5,
    });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Scheduled 40 questions.*5 already existed/),
      ).toBeInTheDocument();
    });
  });

  it("shows error toast when scheduling fails", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockRejectedValue({
      response: {
        data: {
          message: "Failed to schedule questions",
        },
      },
    });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to schedule questions/),
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while scheduling", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );

    let resolveSchedule: (value: {
      scheduled: number;
      alreadyExisted: number;
    }) => void;
    const schedulePromise = new Promise((resolve) => {
      resolveSchedule = resolve;
    });
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockReturnValue(
      schedulePromise as any,
    );
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Scheduling…/)).toBeInTheDocument();
    });

    resolveSchedule!({ scheduled: 45, alreadyExisted: 0 });

    await waitFor(() => {
      expect(screen.getByText(/Scheduled 45 questions/)).toBeInTheDocument();
    });
  });

  it("disables Schedule button while scheduling", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );

    let resolveSchedule: (value: {
      scheduled: number;
      alreadyExisted: number;
    }) => void;
    const schedulePromise = new Promise((resolve) => {
      resolveSchedule = resolve;
    });
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockReturnValue(
      schedulePromise as any,
    );
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(scheduleBtn).toBeDisabled();
    });

    resolveSchedule!({ scheduled: 45, alreadyExisted: 0 });

    await waitFor(() => {
      expect(scheduleBtn).not.toBeDisabled();
    });
  });

  it("invalidates study-plans query after successful scheduling", async () => {
    vi.mocked(knowledgeGraphService.listStudyPlans).mockResolvedValue(
      mockPlans,
    );
    vi.mocked(knowledgeGraphService.scheduleFromPlan).mockResolvedValue({
      scheduled: 45,
      alreadyExisted: 0,
    });
    const user = userEvent.setup();

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/45% effort saved/)).toBeInTheDocument();
    });

    const cardHeader = screen.getByRole("button", {
      name: /45% effort saved/,
    });
    await user.click(cardHeader);

    const scheduleBtn = screen.getByRole("button", { name: /Schedule/ });
    await user.click(scheduleBtn);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["study-plans"],
      });
    });
  });
});
