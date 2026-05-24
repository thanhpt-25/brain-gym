import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DdsAutoApplyPanel } from "./DdsAutoApplyPanel";
import api from "../../services/api";

vi.mock("../../services/api");

describe("DdsAutoApplyPanel - US-1107: Gate 2 Readiness", () => {
  let queryClient: QueryClient;
  const apiMock = api as any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    apiMock.get = vi.fn((url: string) => {
      if (url.includes("auto-apply/readiness")) {
        return Promise.resolve({
          data: {
            cleanApprovals: 32,
            threshold: 30,
            rollbackCount: 0,
            lastRollbackAt: null,
            readyToPromote: true,
            progressPercent: 100, // 32/30 * 100 = 106.67%, capped at 100
          },
        });
      }
      if (url.includes("pending")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });

    apiMock.post = vi.fn().mockResolvedValue({ data: { success: true } });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DdsAutoApplyPanel />
      </QueryClientProvider>,
    );
  };

  describe("Gate 2 Readiness Display", () => {
    it("should display clean approvals count vs threshold", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
              progressPercent: 100,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("32/30")).toBeInTheDocument();
      });
    });

    it("should show readyToPromote badge when promotion is allowed", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 30,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
              progressPercent: 100,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Ready/)).toBeInTheDocument();
      });
    });

    it("should display rollback count and last rollback date", async () => {
      const lastRollback = new Date("2026-05-20").toISOString();
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 25,
              threshold: 30,
              rollbackCount: 2,
              lastRollbackAt: lastRollback,
              readyToPromote: false,
              progressPercent: 83.33,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText(/5\/20\/2026/)).toBeInTheDocument();
      });
    });

    it("should show warning when approvals below threshold", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 20,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: false,
              progressPercent: 66.67,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/10 more clean approvals needed/),
        ).toBeInTheDocument();
      });
    });

    it("should show warning when rollbacks detected", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 30,
              threshold: 30,
              rollbackCount: 1,
              lastRollbackAt: new Date().toISOString(),
              readyToPromote: false,
              progressPercent: 100,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/Cannot promote: recent rollbacks detected/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Promote Button", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_DDS_SHADOW_MODE", "false");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should enable promote button when readyToPromote is true", async () => {
      const readinessData = {
        cleanApprovals: 30,
        threshold: 30,
        rollbackCount: 0,
        lastRollbackAt: null,
        readyToPromote: true,
        progressPercent: 100,
      };

      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({ data: readinessData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        const promoteBtn = screen.getByRole("button", {
          name: /Promote DDS cohort to live mode/,
        });
        expect(promoteBtn).not.toBeDisabled();
      });
    });

    it("should disable promote button when readyToPromote is false", async () => {
      const readinessData = {
        cleanApprovals: 20,
        threshold: 30,
        rollbackCount: 0,
        lastRollbackAt: null,
        readyToPromote: false,
        progressPercent: 66.67,
      };

      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({ data: readinessData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        const promoteBtn = screen.queryByRole("button", {
          name: /Promote DDS cohort to live mode/,
        });
        if (promoteBtn) {
          expect(promoteBtn).toBeDisabled();
        }
      });
    });

    it("should call promote endpoint when button is clicked", async () => {
      const readinessData = {
        cleanApprovals: 30,
        threshold: 30,
        rollbackCount: 0,
        lastRollbackAt: null,
        readyToPromote: true,
        progressPercent: 100,
      };

      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({ data: readinessData });
        }
        return Promise.resolve({ data: [] });
      });

      apiMock.post = vi.fn().mockResolvedValueOnce({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        const promoteBtn = screen.getByRole("button", {
          name: /Promote DDS cohort to live mode/,
        });
        fireEvent.click(promoteBtn);
      });

      await waitFor(() => {
        expect(apiMock.post).toHaveBeenCalledWith(
          "/ai-question-bank/dds/auto-apply/promote",
        );
      });
    });
  });

  describe("Readiness Metrics Progress Bar", () => {
    it("should show correct progress bar width based on approvals", async () => {
      const readinessData = {
        cleanApprovals: 15,
        threshold: 30,
        rollbackCount: 0,
        lastRollbackAt: null,
        readyToPromote: false,
        progressPercent: 50,
      };

      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({ data: readinessData });
        }
        return Promise.resolve({ data: [] });
      });

      const { container } = renderComponent();

      await waitFor(() => {
        const fill = container.querySelector(".dds-metric-fill");
        const style = window.getComputedStyle(fill!);
        expect(style.width).toBe("50%");
      });
    });

    it("should cap progress bar at 100% even if over threshold", async () => {
      const readinessData = {
        cleanApprovals: 50,
        threshold: 30,
        rollbackCount: 0,
        lastRollbackAt: null,
        readyToPromote: true,
        progressPercent: 100, // 50/30 * 100 = 166.67%, capped at 100
      };

      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({ data: readinessData });
        }
        return Promise.resolve({ data: [] });
      });

      const { container } = renderComponent();

      await waitFor(() => {
        const fill = container.querySelector(".dds-metric-fill");
        const style = window.getComputedStyle(fill!);
        expect(style.width).toBe("100%");
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state while fetching readiness data", async () => {
      const apiMock = api as any;
      apiMock.get.mockImplementation(
        (url: string) =>
          new Promise((resolve) =>
            setTimeout(() => {
              if (url.includes("auto-apply/readiness")) {
                resolve({
                  data: {
                    cleanApprovals: 30,
                    threshold: 30,
                    rollbackCount: 0,
                    lastRollbackAt: null,
                    readyToPromote: true,
                    progressPercent: 100,
                  },
                });
              } else {
                resolve({ data: [] });
              }
            }, 100),
          ),
      );

      renderComponent();

      expect(screen.getByText(/Loading Gate 2 readiness/)).toBeInTheDocument();

      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading Gate 2 readiness/),
          ).not.toBeInTheDocument();
        },
        { timeout: 200 },
      );
    });
  });

  describe("Accessibility (WCAG 2.1 AA)", () => {
    it("should not have accessibility violations on initial render", async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText("32/30")).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });

    it("should have proper ARIA labels on progress bar", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 15,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: false,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText("15/30")).toBeInTheDocument();
      });

      const fill = container.querySelector(".dds-metric-fill");
      expect(fill).toBeInTheDocument();

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });

    it("should have accessible button states (enabled/disabled)", async () => {
      const readinessData = {
        cleanApprovals: 30,
        threshold: 30,
        rollbackCount: 0,
        lastRollbackAt: null,
        readyToPromote: true,
      };

      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({ data: readinessData });
        }
        return Promise.resolve({ data: [] });
      });

      const { container } = renderComponent();

      await waitFor(() => {
        const promoteBtn = screen.getByRole("button", {
          name: /Promote DDS cohort to live mode/,
        });
        expect(promoteBtn).not.toBeDisabled();
      });

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });

    it("should have semantic HTML structure", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("32/30")).toBeInTheDocument();
      });

      const section = screen.getByRole("status");
      expect(section).toBeInTheDocument();
      const heading = section.querySelector("h4");
      expect(heading).toBeInTheDocument();
    });
  });

  describe("Canary Status Display (US-1101)", () => {
    it("should display canary status when cohort config is available", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({
            data: {
              cohortName: "default",
              shadowModeEnabled: false,
              canaryArmed: true,
              promotedAt: new Date("2026-06-15").toISOString(),
              canaryPausedAt: null,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("🛡️ Armed")).toBeInTheDocument();
        expect(screen.getByText(/Promoted:/)).toBeInTheDocument();
      });
    });

    it("should show Armed state when canaryArmed is true", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({
            data: {
              cohortName: "default",
              shadowModeEnabled: false,
              canaryArmed: true,
              promotedAt: new Date().toISOString(),
              canaryPausedAt: null,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        const armedBadge = screen.getByText("🛡️ Armed");
        expect(armedBadge).toHaveClass("dds-canary-armed");
      });
    });

    it("should show Paused state when canaryPausedAt is set", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({
            data: {
              cohortName: "default",
              shadowModeEnabled: true,
              canaryArmed: false,
              promotedAt: new Date("2026-06-10").toISOString(),
              canaryPausedAt: new Date("2026-06-12").toISOString(),
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        const pausedBadge = screen.getByText("⏸️ Paused");
        expect(pausedBadge).toHaveClass("dds-canary-paused");
      });
    });

    it("should show Inactive state when cohort not yet promoted", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({
            data: {
              cohortName: "default",
              shadowModeEnabled: true,
              canaryArmed: false,
              promotedAt: null,
              canaryPausedAt: null,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        const inactiveBadge = screen.getByText("○ Inactive");
        expect(inactiveBadge).toHaveClass("dds-canary-inactive");
      });
    });

    it("should display promotion timestamp when available", async () => {
      const promotionDate = new Date("2026-06-15");
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({
            data: {
              cohortName: "default",
              shadowModeEnabled: false,
              canaryArmed: true,
              promotedAt: promotionDate.toISOString(),
              canaryPausedAt: null,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(promotionDate.toLocaleDateString())),
        ).toBeInTheDocument();
      });
    });

    it("should display pause timestamp when available", async () => {
      const pauseDate = new Date("2026-06-12");
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({
            data: {
              cohortName: "default",
              shadowModeEnabled: true,
              canaryArmed: false,
              promotedAt: new Date("2026-06-10").toISOString(),
              canaryPausedAt: pauseDate.toISOString(),
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(pauseDate.toLocaleDateString())),
        ).toBeInTheDocument();
      });
    });

    it("should handle missing cohort config gracefully", async () => {
      apiMock.get.mockImplementation((url: string) => {
        if (url.includes("auto-apply/readiness")) {
          return Promise.resolve({
            data: {
              cleanApprovals: 32,
              threshold: 30,
              rollbackCount: 0,
              lastRollbackAt: null,
              readyToPromote: true,
            },
          });
        }
        if (url.includes("auto-apply/cohort-config")) {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: [] });
      });

      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText("32/30")).toBeInTheDocument();
      });

      const canarySection = container.querySelector(".dds-canary-status");
      expect(canarySection).not.toBeInTheDocument();

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });
  });
});
