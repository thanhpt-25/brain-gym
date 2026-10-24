import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutosave } from "../useAutosave";
import { saveAnswer } from "@/services/attempts";

vi.mock("@/services/attempts", () => ({ saveAnswer: vi.fn() }));

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(saveAnswer).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("debounces and only sends the latest state per question", async () => {
    vi.mocked(saveAnswer).mockResolvedValue({});
    const { result } = renderHook(() => useAutosave("att-1", true));

    act(() => {
      result.current.queue({ questionId: "q1", selectedChoices: ["a"] });
      result.current.queue({ questionId: "q1", selectedChoices: ["b"] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveAnswer).toHaveBeenCalledTimes(1);
    expect(saveAnswer).toHaveBeenCalledWith("att-1", {
      questionId: "q1",
      selectedChoices: ["b"],
    });
    expect(result.current.status).toBe("saved");
  });

  it("retries after a network error", async () => {
    vi.mocked(saveAnswer)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValue({});
    const { result } = renderHook(() => useAutosave("att-1", true));

    act(() => {
      result.current.queue({ questionId: "q1", selectedChoices: ["a"] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.status).toBe("error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(saveAnswer).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("drops a save the server rejects instead of retrying it", async () => {
    vi.mocked(saveAnswer).mockRejectedValue({ response: { status: 400 } });
    const { result } = renderHook(() => useAutosave("att-1", true));

    act(() => {
      result.current.queue({ questionId: "q1", selectedChoices: ["a"] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(saveAnswer).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled, and cancel drops queued saves", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAutosave("att-1", enabled),
      { initialProps: { enabled: false } },
    );
    act(() => {
      result.current.queue({ questionId: "q1", selectedChoices: ["a"] });
    });
    rerender({ enabled: true });
    act(() => {
      result.current.queue({ questionId: "q2", selectedChoices: ["b"] });
    });
    await act(async () => {
      await result.current.cancel();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(saveAnswer).not.toHaveBeenCalled();
  });
});
