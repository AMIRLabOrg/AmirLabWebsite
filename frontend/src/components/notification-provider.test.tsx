import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/client-api";
import { NotificationProvider, useNotifications } from "./notification-provider";

vi.mock("@/components/auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/client-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/client-api")>();
  return { ...original, apiRequest: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const auth = vi.mocked(useAuth);
const request = vi.mocked(apiRequest);

class TestEventSource {
  static latest: TestEventSource | undefined;
  private readonly listeners = new Set<EventListener>();
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    TestEventSource.latest = this;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === "research" && typeof listener === "function") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === "research" && typeof listener === "function") {
      this.listeners.delete(listener);
    }
  }

  close(): void {}

  emitResearch(data: unknown): void {
    const event = new MessageEvent("research", {
      data: JSON.stringify(data),
    });
    for (const listener of this.listeners) listener(event);
  }
}

function EventProbe() {
  const { subscribeResearchEvents } = useNotifications();
  const [event, setEvent] = useState("waiting");

  useEffect(
    () =>
      subscribeResearchEvents((next) => {
        setEvent(`${next.researchItemId}:${next.kind}`);
      }),
    [subscribeResearchEvents],
  );

  return <p>{event}</p>;
}

describe("NotificationProvider research events", () => {
  beforeEach(() => {
    auth.mockReturnValue({
      loading: false,
      logout: vi.fn(async () => {}),
      refreshUser: vi.fn(async () => null),
      user: {
        email: "moderator@amirlab.org",
        id: "moderator-1",
        person: null,
        role: "MODERATOR",
        status: "ACTIVE",
      },
    });
    request.mockResolvedValue({
      applications: 0,
      profileReviews: 0,
      projectReviews: 0,
      researchReviews: 1,
      unreadCount: 0,
      weeklyReportReviews: 0,
    });
    vi.stubGlobal("EventSource", TestEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    request.mockReset();
  });

  it("delivers named research SSE events to subscribers", async () => {
    render(
      <NotificationProvider>
        <EventProbe />
      </NotificationProvider>,
    );

    await act(async () => Promise.resolve());
    expect(TestEventSource.latest?.url).toContain("/notifications/events");
    expect(TestEventSource.latest?.options?.withCredentials).toBe(true);

    await act(async () => {
      TestEventSource.latest?.emitResearch({
        kind: "source",
        scope: "research",
        researchItemId: "research-1",
        sourceStatus: "PENDING",
      });
    });

    expect(screen.getByText("research-1:source")).toBeTruthy();
  });
});
