import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, apiRequest } from "@/lib/client-api";
import { AuthProvider, useAuth } from "./auth-provider";

vi.mock("@/lib/client-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/client-api")>();
  return { ...original, apiRequest: vi.fn() };
});

const request = vi.mocked(apiRequest);

function AuthState() {
  const { loading, user } = useAuth();
  return <p>{loading ? "loading" : (user?.email ?? "guest")}</p>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps checking until a temporarily unavailable API is ready", async () => {
    request
      .mockRejectedValueOnce(
        new ApiRequestError("Unable to reach the server", 0),
      )
      .mockRejectedValueOnce(
        new ApiRequestError("Unable to reach the server", 0),
      )
      .mockRejectedValueOnce(
        new ApiRequestError("Unable to reach the server", 0),
      )
      .mockRejectedValueOnce(
        new ApiRequestError("Unable to reach the server", 0),
      )
      .mockResolvedValue({
        csrfToken: "csrf",
        user: { email: "admin@amirl.org" },
      });

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    expect(screen.getByText("loading")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getByText("admin@amirl.org")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("stops checking when the API confirms the session is unauthorized", async () => {
    request.mockRejectedValue(
      new ApiRequestError("Authentication is required", 401),
    );

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await act(async () => Promise.resolve());
    expect(screen.getByText("guest")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
