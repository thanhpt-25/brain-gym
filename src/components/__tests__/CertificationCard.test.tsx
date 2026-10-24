import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import CertificationCard from "../CertificationCard";
import { useAuthStore } from "@/stores/auth.store";
import type { Certification } from "@/types/exam";

const cert: Certification = {
  id: "cert-1",
  code: "SAA-C03",
  name: "AWS Solutions Architect Associate",
  provider: "Amazon Web Services",
  description: "desc",
  icon: "☁️",
  questionCount: 10,
  timeMinutes: 130,
  passingScore: 72,
};

function renderCard(props: Partial<React.ComponentProps<typeof CertificationCard>> = {}) {
  return render(
    <MemoryRouter>
      <CertificationCard cert={cert} onClick={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: false, user: null } as never);
});

describe("CertificationCard", () => {
  it("prompts sign-up instead of navigating when an unauthenticated visitor clicks Mock Exam", () => {
    const onClick = vi.fn();
    renderCard({ onClick });

    fireEvent.click(screen.getByRole("button", { name: /mock exam/i }));

    expect(onClick).not.toHaveBeenCalled();
    expect(
      screen.getByText(/create a free account to continue/i),
    ).toBeInTheDocument();
  });

  it("navigates directly when the user is already authenticated", () => {
    useAuthStore.setState({ isAuthenticated: true } as never);
    const onClick = vi.fn();
    renderCard({ onClick });

    fireEvent.click(screen.getByRole("button", { name: /mock exam/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables all actions for fallback/placeholder certifications", () => {
    const onClick = vi.fn();
    renderCard({ onClick, isFallback: true });

    fireEvent.click(screen.getByRole("button", { name: /mock exam/i }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText(/reconnecting to live data/i)).toBeInTheDocument();
  });
});
