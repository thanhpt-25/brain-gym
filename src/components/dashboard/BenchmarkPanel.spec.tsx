import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BenchmarkPanel } from "./BenchmarkPanel";
import api from "../../services/api";

vi.mock("../../services/api");

describe("BenchmarkPanel - S11 Component", () => {
  let queryClient: QueryClient;
  const apiMock = api as any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    apiMock.get = vi.fn((url: string) => {
      if (url.includes("/analytics/benchmark")) {
        return Promise.resolve({
          data: {
            userId: "user-1",
            certificationId: "cert-1",
            userScore: 85,
            percentile: 72,
            cohortSize: 1500,
            top10PctScore: 95,
            averageScore: 78,
            domainBreakdown: [
              {
                domainId: "domain-1",
                domainName: "Security",
                userAccuracy: 88,
                cohortAccuracy: 82,
              },
              {
                domainId: "domain-2",
                domainName: "Networking",
                userAccuracy: 92,
                cohortAccuracy: 75,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BenchmarkPanel
          certificationId="cert-1"
          certificationName="AWS Solutions Architect"
          {...props}
        />
      </QueryClientProvider>,
    );
  };

  describe("Loading State", () => {
    it("should display loading spinner while fetching", async () => {
      apiMock.get.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: {} });
            }, 500);
          }),
      );

      renderComponent();
      expect(screen.getByText("Loading benchmark…")).toBeInTheDocument();
    });

    it("should have aria-busy attribute when loading", async () => {
      apiMock.get.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: {} });
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
      apiMock.get.mockRejectedValue(new Error("Network error"));

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load benchmark data."),
        ).toBeInTheDocument();
      });
    });

    it("should have role alert on error", async () => {
      apiMock.get.mockRejectedValue(new Error("Network error"));

      const { container } = renderComponent();

      await waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe("Benchmark Data Display", () => {
    it("should display user score", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Your score")).toBeInTheDocument();
        expect(screen.getByText("85%")).toBeInTheDocument();
      });
    });

    it("should display percentile when available", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Percentile")).toBeInTheDocument();
        expect(screen.getByText("72th")).toBeInTheDocument();
      });
    });

    it("should display cohort average score", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Cohort avg")).toBeInTheDocument();
        expect(screen.getByText("78%")).toBeInTheDocument();
      });
    });

    it("should display top 10 percent score", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Top 10%")).toBeInTheDocument();
        expect(screen.getByText("95%")).toBeInTheDocument();
      });
    });

    it("should display cohort size", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Cohort size")).toBeInTheDocument();
        expect(screen.getByText("1500")).toBeInTheDocument();
      });
    });
  });

  describe("Hidden Data State", () => {
    beforeEach(() => {
      apiMock.get.mockResolvedValue({
        data: {
          userId: "user-1",
          certificationId: "cert-1",
          userScore: 85,
          percentile: null,
          cohortSize: null,
          top10PctScore: null,
          averageScore: null,
          domainBreakdown: [],
          hiddenReason: "Not enough participants for benchmark",
        },
      });
    });

    it("should display hidden reason when percentile is null", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Not enough participants for benchmark"),
        ).toBeInTheDocument();
      });
    });

    it("should have role note for hidden message", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const noteDiv = container.querySelector('[role="note"]');
        expect(noteDiv).toBeInTheDocument();
      });
    });

    it("should not display percentile when hidden", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Your score")).toBeInTheDocument();
        expect(screen.queryByText("Percentile")).not.toBeInTheDocument();
      });
    });

    it("should not display cohort stats when hidden", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Cohort avg")).not.toBeInTheDocument();
        expect(screen.queryByText("Top 10%")).not.toBeInTheDocument();
      });
    });

    it("should not display domain breakdown when hidden", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Domain breakdown")).not.toBeInTheDocument();
      });
    });
  });

  describe("Domain Breakdown", () => {
    it("should display domain breakdown section", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Domain breakdown")).toBeInTheDocument();
      });
    });

    it("should display all domain names", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Security")).toBeInTheDocument();
        expect(screen.getByText("Networking")).toBeInTheDocument();
      });
    });

    it("should display user and cohort accuracy bars", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const progressBars = container.querySelectorAll('[role="progressbar"]');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it("should display accuracy percentages in domain bars", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText("You: 88%")).toBeInTheDocument();
        expect(screen.getByLabelText("Cohort: 82%")).toBeInTheDocument();
      });
    });
  });

  describe("Hidden Domain Data", () => {
    beforeEach(() => {
      apiMock.get.mockResolvedValue({
        data: {
          userId: "user-1",
          certificationId: "cert-1",
          userScore: 85,
          percentile: 72,
          cohortSize: 1500,
          top10PctScore: 95,
          averageScore: 78,
          domainBreakdown: [
            {
              domainId: "domain-1",
              domainName: "Security",
              userAccuracy: null,
              cohortAccuracy: null,
            },
          ],
        },
      });
    });

    it("should display hidden badge for null accuracy values", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const hiddenElement = container.querySelector(".bench-bar-hidden");
        expect(hiddenElement).toBeInTheDocument();
      });
    });
  });

  describe("Certification Name Display", () => {
    it("should display certification name when provided", async () => {
      const { container } = renderComponent({
        certificationName: "AWS Solutions Architect",
      });

      await waitFor(() => {
        const certName = container.querySelector(".bench-cert-name");
        expect(certName?.textContent).toContain("AWS Solutions Architect");
      });
    });

    it("should render without certification name if not provided", async () => {
      renderComponent({ certificationName: undefined });

      await waitFor(() => {
        expect(screen.getByText("Passers Benchmark")).toBeInTheDocument();
      });
    });
  });

  describe("Empty Domain Breakdown", () => {
    beforeEach(() => {
      apiMock.get.mockResolvedValue({
        data: {
          userId: "user-1",
          certificationId: "cert-1",
          userScore: 85,
          percentile: 72,
          cohortSize: 1500,
          top10PctScore: 95,
          averageScore: 78,
          domainBreakdown: [],
        },
      });
    });

    it("should not display domain breakdown section when empty", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Domain breakdown")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have semantic section element with aria-label", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const section = container.querySelector(
          '[aria-label="Benchmark comparison"]',
        );
        expect(section).toBeInTheDocument();
      });
    });

    it("should have h3 heading for benchmark title", async () => {
      renderComponent();

      await waitFor(() => {
        const h3 = screen.getByText(/Passers Benchmark/);
        expect(h3.tagName).toBe("H3");
      });
    });

    it("should have h4 heading for domain breakdown", async () => {
      renderComponent();

      await waitFor(() => {
        const h4 = screen.getByText("Domain breakdown");
        expect(h4.tagName).toBe("H4");
      });
    });

    it("should have aria-valuenow on progress bars", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const progressBar = container.querySelector(
          '[role="progressbar"][aria-valuenow="88"]',
        );
        expect(progressBar).toBeInTheDocument();
      });
    });

    it("should have aria-valuemin and aria-valuemax on progress bars", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const progressBars = container.querySelectorAll('[role="progressbar"]');
        progressBars.forEach((bar) => {
          expect(bar.getAttribute("aria-valuemin")).toBe("0");
          expect(bar.getAttribute("aria-valuemax")).toBe("100");
        });
      });
    });

    it("should have unlabeled lists for domain breakdown", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        const list = container.querySelector(".bench-domain-list");
        expect(list?.tagName).toBe("UL");
      });
    });
  });

  describe("Query Params", () => {
    it("should pass certificationId to fetch function", async () => {
      renderComponent({ certificationId: "custom-cert-123" });

      await waitFor(() => {
        expect(apiMock.get).toHaveBeenCalledWith("/analytics/benchmark", {
          params: { certificationId: "custom-cert-123" },
        });
      });
    });
  });
});
