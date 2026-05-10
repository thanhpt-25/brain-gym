import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassLikelihoodSurveyBanner } from "../PassLikelihoodSurveyBanner";
import * as surveysService from "../../../services/surveys";

vi.mock("../../../services/surveys");

const mockGetPassLikelihoodStatus = vi.spyOn(
  surveysService,
  "getPassLikelihoodStatus",
);
const mockSubmitPassLikelihood = vi.spyOn(
  surveysService,
  "submitPassLikelihood",
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function renderComponent(certificationId: string = "cert-123") {
  return render(
    <QueryClientProvider client={queryClient}>
      <PassLikelihoodSurveyBanner certificationId={certificationId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

describe("PassLikelihoodSurveyBanner", () => {
  it("does not render when survey is already submitted", async () => {
    mockGetPassLikelihoodStatus.mockResolvedValue({
      submitted: true,
      score: 7,
    });

    renderComponent();
    await waitFor(() => {
      expect(
        screen.queryByText("How confident are you?"),
      ).not.toBeInTheDocument();
    });
  });

  it("renders banner when survey is not submitted", async () => {
    mockGetPassLikelihoodStatus.mockResolvedValue({
      submitted: false,
      score: null,
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("How confident are you?")).toBeInTheDocument();
      expect(screen.getByText(/On a scale of 1-10/)).toBeInTheDocument();
    });
  });

  it("renders all score buttons 1-10", async () => {
    mockGetPassLikelihoodStatus.mockResolvedValue({
      submitted: false,
      score: null,
    });

    renderComponent();
    await waitFor(() => {
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument();
      }
    });
  });

  it("allows selecting a score and submitting", async () => {
    mockGetPassLikelihoodStatus.mockResolvedValue({
      submitted: false,
      score: null,
    });
    mockSubmitPassLikelihood.mockResolvedValue({
      id: "survey-123",
      score: 7,
      submittedAt: new Date().toISOString(),
    });

    renderComponent("cert-456");

    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });

    const scoreButton = screen.getByText("7");
    fireEvent.click(scoreButton);

    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitPassLikelihood).toHaveBeenCalledWith("cert-456", 7);
    });
  });

  it("disables submit button when no score is selected", async () => {
    mockGetPassLikelihoodStatus.mockResolvedValue({
      submitted: false,
      score: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Submit") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it("enables submit button when a score is selected", async () => {
    mockGetPassLikelihoodStatus.mockResolvedValue({
      submitted: false,
      score: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    const scoreButton = screen.getByText("5");
    fireEvent.click(scoreButton);

    const submitButton = screen.getByText("Submit") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it("refreshes status after successful submission", async () => {
    mockGetPassLikelihoodStatus
      .mockResolvedValueOnce({
        submitted: false,
        score: null,
      })
      .mockResolvedValueOnce({
        submitted: true,
        score: 8,
      });

    mockSubmitPassLikelihood.mockResolvedValue({
      id: "survey-123",
      score: 8,
      submittedAt: new Date().toISOString(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument();
    });

    const scoreButton = screen.getByText("8");
    fireEvent.click(scoreButton);

    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitPassLikelihood).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.queryByText("How confident are you?"),
      ).not.toBeInTheDocument();
    });
  });
});
