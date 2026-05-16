import { test, expect } from "@playwright/experimental-ct-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import SquadDashboard from "@/pages/SquadDashboard";
import * as squadsService from "@/services/squads";

// Mock services
vi.mock("@/services/squads");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "aws-saa-study-group" }),
  };
});

vi.mock("@/components/PageTransition", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock data
const mockSquad = {
  id: "squad-1",
  name: "AWS SAA Study Group",
  slug: "aws-saa-study-group",
  certificationId: "cert-aws-saa-c03",
  targetExamDate: new Date("2026-12-15"),
  memberCount: 3,
  createdAt: new Date("2026-05-01"),
};

const mockMembers = [
  {
    id: "member-1",
    orgId: "squad-1",
    userId: "user-1",
    role: "OWNER",
    joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    user: {
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice Chen",
      avatarUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%234f46e5' width='48' height='48'/%3E%3C/svg%3E",
    },
  },
  {
    id: "member-2",
    orgId: "squad-1",
    userId: "user-2",
    role: "MEMBER",
    joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    user: {
      id: "user-2",
      email: "bob@example.com",
      displayName: "Bob Smith",
      avatarUrl: null,
    },
  },
  {
    id: "member-3",
    orgId: "squad-1",
    userId: "user-3",
    role: "MEMBER",
    joinedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    user: {
      id: "user-3",
      email: "carol@example.com",
      displayName: "Carol Davis",
      avatarUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%2306b6d4' width='48' height='48'/%3E%3C/svg%3E",
    },
  },
];

const mockReadiness = {
  readinessScore: 68,
  confidence: 0.82,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    Component: () => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SquadDashboard />
        </BrowserRouter>
      </QueryClientProvider>
    ),
  };
};

test.describe("SquadDashboard - Visual Regression", () => {
  const breakpoints = [
    { name: "mobile", width: 320, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  test.beforeEach(async () => {
    vi.mocked(squadsService.getSquadBySlug).mockResolvedValue(mockSquad);
    vi.mocked(squadsService.getSquadMembers).mockResolvedValue(mockMembers);
    vi.mocked(squadsService.getSquadReadiness).mockResolvedValue(mockReadiness);
  });

  test.describe("Light Mode", () => {
    breakpoints.forEach(({ name, width, height }) => {
      test(`renders correctly at ${name} breakpoint (${width}x${height})`, async ({
        mount,
      }) => {
        const { Component } = createWrapper();

        const component = await mount(<Component />, {
          viewport: { width, height },
        });

        // Wait for data to load
        await component.locator("h1").waitFor({ timeout: 5000 });

        // Verify content is visible
        await expect(component.locator("h1")).toContainText(
          "AWS SAA Study Group",
        );
        await expect(component.locator("section")).toContainText("Members");

        // Take screenshot
        await expect(component).toHaveScreenshot(
          `squad-dashboard-${name}-light.png`,
          {
            maxDiffPixels: 100,
          },
        );
      });
    });
  });

  test.describe("Dark Mode", () => {
    breakpoints.forEach(({ name, width, height }) => {
      test(`renders correctly at ${name} breakpoint (${width}x${height})`, async ({
        mount,
        page,
      }) => {
        // Enable dark mode
        await page.addInitScript(() => {
          document.documentElement.classList.add("dark");
          localStorage.setItem("theme", "dark");
        });

        const { Component } = createWrapper();

        const component = await mount(<Component />, {
          viewport: { width, height },
        });

        // Wait for data to load
        await component.locator("h1").waitFor({ timeout: 5000 });

        // Verify content is visible
        await expect(component.locator("h1")).toContainText(
          "AWS SAA Study Group",
        );

        // Take screenshot
        await expect(component).toHaveScreenshot(
          `squad-dashboard-${name}-dark.png`,
          {
            maxDiffPixels: 100,
          },
        );
      });
    });
  });

  test.describe("Hover States", () => {
    test("member card shows hover state", async ({ mount }) => {
      const { Component } = createWrapper();

      const component = await mount(<Component />, {
        viewport: { width: 1440, height: 900 },
      });

      await component.locator("h1").waitFor({ timeout: 5000 });

      // Hover over first member card
      const memberCard = component
        .locator('[data-testid="member-card"]')
        .first();
      await memberCard.hover();

      await expect(component).toHaveScreenshot(
        "squad-dashboard-hover-member-card.png",
        {
          maxDiffPixels: 50,
        },
      );
    });
  });

  test.describe("Inactive Member Styling", () => {
    test("inactive members are visually distinct", async ({ mount }) => {
      const { Component } = createWrapper();

      const component = await mount(<Component />, {
        viewport: { width: 1440, height: 900 },
      });

      await component.locator("h1").waitFor({ timeout: 5000 });

      // Verify inactive badge is present
      const inactiveBadge = component.locator('[data-testid="inactive-badge"]');
      await expect(inactiveBadge).toBeVisible();
      await expect(inactiveBadge).toContainText("Inactive (7+ days)");

      await expect(component).toHaveScreenshot(
        "squad-dashboard-inactive-members.png",
        {
          maxDiffPixels: 100,
        },
      );
    });
  });

  test.describe("Empty State", () => {
    test("displays empty state when no members", async ({ mount }) => {
      vi.mocked(squadsService.getSquadMembers).mockResolvedValue([]);

      const { Component } = createWrapper();

      const component = await mount(<Component />, {
        viewport: { width: 1440, height: 900 },
      });

      await component.locator("h1").waitFor({ timeout: 5000 });

      // Verify empty state message
      await expect(
        component.locator('[data-testid="empty-state"]'),
      ).toBeVisible();
      await expect(component).toContainText(
        "Invite members to see their readiness.",
      );

      await expect(component).toHaveScreenshot(
        "squad-dashboard-empty-state.png",
        {
          maxDiffPixels: 100,
        },
      );
    });
  });

  test.describe("Readiness Display", () => {
    test("displays readiness score and level", async ({ mount }) => {
      const { Component } = createWrapper();

      const component = await mount(<Component />, {
        viewport: { width: 1440, height: 900 },
      });

      await component.locator("h1").waitFor({ timeout: 5000 });

      // Verify readiness card
      const readinessCard = component.locator('[data-testid="readiness-card"]');
      await expect(readinessCard).toBeVisible();
      await expect(readinessCard).toContainText("68%");
      await expect(readinessCard).toContainText("Intermediate");

      await expect(component).toHaveScreenshot(
        "squad-dashboard-readiness-display.png",
        {
          maxDiffPixels: 100,
        },
      );
    });
  });

  test.describe("Responsive Behavior", () => {
    test("grid layout switches from 2-column to 1-column below 1024px", async ({
      mount,
    }) => {
      const { Component } = createWrapper();

      const desktopComponent = await mount(<Component />, {
        viewport: { width: 1440, height: 900 },
      });

      await desktopComponent.locator("h1").waitFor({ timeout: 5000 });

      const desktopLayout = await desktopComponent.locator(".squad-grid");
      const desktopGridCols = await desktopLayout.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns;
      });

      expect(desktopGridCols).toContain("1fr 2fr");

      // Test tablet layout
      const tabletComponent = await mount(<Component />, {
        viewport: { width: 768, height: 1024 },
      });

      await tabletComponent.locator("h1").waitFor({ timeout: 5000 });

      const tabletLayout = await tabletComponent.locator(".squad-grid");
      const tabletGridCols = await tabletLayout.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns;
      });

      expect(tabletGridCols).toContain("1fr");
    });
  });

  test.describe("Content Accessibility", () => {
    test("all members are visible and readable", async ({ mount }) => {
      const { Component } = createWrapper();

      const component = await mount(<Component />, {
        viewport: { width: 1440, height: 900 },
      });

      await component.locator("h1").waitFor({ timeout: 5000 });

      // Verify all members are displayed
      const memberNames = ["Alice Chen", "Bob Smith", "Carol Davis"];

      for (const name of memberNames) {
        await expect(component).toContainText(name);
      }

      // Verify role badges are visible
      const ownerBadge = component.locator("text=Owner");
      const memberBadges = component.locator("text=Member");

      await expect(ownerBadge).toBeVisible();
      await expect(memberBadges).toHaveCount(2);

      await expect(component).toHaveScreenshot(
        "squad-dashboard-content-accessibility.png",
        {
          maxDiffPixels: 100,
        },
      );
    });
  });
});
