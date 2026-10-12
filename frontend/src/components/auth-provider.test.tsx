import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, apiRequest } from "@/lib/client-api";
import { AuthProvider, useAuth } from "./auth-provider";
import { GuestOnly } from "./guest-only";
import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

vi.mock("@/lib/client-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/client-api")>();
  return { ...original, apiRequest: vi.fn() };
});

const pwa = vi.hoisted(() => ({
  registration: null as object | null,
}));
vi.mock("./pwa-provider", () => ({ usePwa: () => pwa }));
const request = vi.mocked(apiRequest);

function AuthState() {
  const { loading, user } = useAuth();
  return <p>{loading ? "loading" : (user?.email ?? "guest")}</p>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    pwa.registration = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows the session notice when an expired returning visitor opens login", async () => {
    sessionStorage.setItem("amirl_csrf", "previous-session");
    request.mockRejectedValueOnce(new ApiRequestError("Session expired", 401));
    render(
      <AuthProvider>
        <GuestOnly>
          <LoginForm />
        </GuestOnly>
      </AuthProvider>,
    );
    await act(async () => Promise.resolve());
    expect(
      screen.getByText("Your session ended. Please log in again."),
    ).toBeTruthy();
  });

  it("clears loading and keeps retrying until a temporarily unavailable API is ready", async () => {
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
    expect(screen.getByText("guest")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getByText("admin@amirl.org")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("clears a remotely revoked session on the session-invalid event", async () => {
    request.mockResolvedValueOnce({
      csrfToken: "csrf",
      user: { email: "admin@amirl.org" },
    });
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );
    await act(async () => Promise.resolve());
    expect(screen.getByText("admin@amirl.org")).toBeTruthy();
    sessionStorage.setItem("amirl_csrf", "csrf");
    await act(async () =>
      window.dispatchEvent(new Event("amirl:session-invalid")),
    );
    expect(screen.getByText("guest")).toBeTruthy();
    expect(sessionStorage.getItem("amirl_csrf")).toBeNull();
    expect(sessionStorage.getItem("amirl_session_ended")).toBe("1");
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
  it("relinks an opted-in browser subscription when a new session loads", async () => {
    const subscription = {
      options: {},
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: { p256dh: "key", auth: "auth" },
      }),
    };
    const worker = {
      pushManager: { getSubscription: async () => subscription },
    };
    pwa.registration = worker;
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: () => {
        throw new Error("Must not prompt during session loading");
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => worker,
        ready: Promise.resolve(worker),
      },
    });
    request.mockImplementation(async (path) => {
      if (path === "/auth/me")
        return {
          csrfToken: "new-csrf",
          user: { id: "user-1", email: "member@amirlab.org" },
        };
      if (path === "/collaboration/push/public-key") return { publicKey: "YQ" };
      return {};
    });
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );
    await act(async () => Promise.resolve());
    expect(request).toHaveBeenCalledWith(
      "/collaboration/push/subscription",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      }),
    );
  });
  it("relinks an opted-in browser when focus discovers a new session for the same account", async () => {
    const subscription = {
      options: {},
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: { p256dh: "key", auth: "auth" },
      }),
    };
    const worker = {
      pushManager: { getSubscription: async () => subscription },
    };
    pwa.registration = worker;
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "granted" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => worker,
        ready: Promise.resolve(worker),
      },
    });
    let csrfToken = "first-session";
    request.mockImplementation(async (path) =>
      path === "/auth/me"
        ? {
            csrfToken,
            user: { id: "same-account", email: "member@amirlab.org" },
          }
        : path === "/collaboration/push/public-key"
          ? { publicKey: "YQ" }
          : {},
    );
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );
    await act(async () => Promise.resolve());
    request.mockClear();
    csrfToken = "second-session";
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(request).toHaveBeenCalledWith(
      "/collaboration/push/subscription",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
