import MockAdapter from "axios-mock-adapter";
import axios from "axios";

const mockSetAuth = vi.fn();
const mockLogout = vi.fn();
const mockGetState = vi.fn();

vi.mock("../../stores/auth.store", () => ({
  useAuthStore: {
    getState: mockGetState,
  },
}));

function makeAuthState(
  overrides: { accessToken?: string | null; refreshToken?: string | null } = {},
) {
  return {
    accessToken: overrides.accessToken ?? "access-token-123",
    refreshToken: overrides.refreshToken ?? "refresh-token-abc",
    setAuth: mockSetAuth,
    logout: mockLogout,
  };
}

// Import api after vi.mock declarations (vitest hoists vi.mock automatically)
const { default: api } = await import("../api");

const mock = new MockAdapter(axios);

beforeEach(() => {
  mock.reset();
  mockGetState.mockReturnValue(makeAuthState());
  mockSetAuth.mockReset();
  mockLogout.mockReset();
});

afterAll(() => {
  mock.restore();
});

describe("request interceptor", () => {
  it("attaches Bearer token from auth store", async () => {
    mockGetState.mockReturnValue(makeAuthState({ accessToken: "my-token" }));
    mock.onGet("/api/v1/test").reply(200, { ok: true });

    await api.get("/test");

    const headers = mock.history.get[0].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-token");
  });

  it("omits Authorization header when no access token", async () => {
    mockGetState.mockReturnValue(makeAuthState({ accessToken: null }));
    mock.onGet("/api/v1/test").reply(200, { ok: true });

    await api.get("/test");

    const headers = mock.history.get[0].headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("response interceptor — 401 retry", () => {
  it("refreshes token on 401 and retries original request", async () => {
    mock
      .onGet("/api/v1/protected")
      .replyOnce(401)
      .onGet("/api/v1/protected")
      .replyOnce(200, { data: "secret" });

    mock.onPost("/api/v1/auth/refresh").replyOnce(200, {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      user: { id: "1", email: "a@b.com" },
    });

    const response = await api.get("/protected");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: "secret" });
    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: "1", email: "a@b.com" },
      "new-access",
      "new-refresh",
    );
  });

  it("calls logout when no refresh token is available", async () => {
    mockGetState.mockReturnValue(makeAuthState({ refreshToken: null }));
    mock.onGet("/api/v1/protected").replyOnce(401);

    await expect(api.get("/protected")).rejects.toBeDefined();
    expect(mockLogout).toHaveBeenCalled();
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  it("calls logout when the refresh endpoint fails", async () => {
    mock.onGet("/api/v1/protected").replyOnce(401);
    mock.onPost("/api/v1/auth/refresh").replyOnce(401);

    await expect(api.get("/protected")).rejects.toBeDefined();
    expect(mockLogout).toHaveBeenCalled();
  });

  it("does not enter infinite retry loop on repeated 401s", async () => {
    mock.onGet("/api/v1/protected").reply(401);
    mock.onPost("/api/v1/auth/refresh").replyOnce(200, {
      accessToken: "new-token",
      refreshToken: "new-refresh",
      user: { id: "1" },
    });

    await expect(api.get("/protected")).rejects.toBeDefined();
    expect(
      mock.history.post.filter((r) => r.url?.includes("refresh")),
    ).toHaveLength(1);
  });
});

describe("response interceptor — HTML guard", () => {
  it("rejects with 'Backend unavailable' when HTML is returned", async () => {
    mock.onGet("/api/v1/test").replyOnce(200, "<html>...</html>", {
      "content-type": "text/html; charset=utf-8",
    });

    await expect(api.get("/test")).rejects.toThrow("Backend unavailable");
  });

  it("passes through normal JSON responses", async () => {
    mock
      .onGet("/api/v1/test")
      .replyOnce(200, { ok: true }, { "content-type": "application/json" });

    const res = await api.get("/test");
    expect(res.data).toEqual({ ok: true });
  });
});
