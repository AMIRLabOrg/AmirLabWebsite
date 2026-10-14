"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/client-api";
import {
  disableBrowserPush,
  enableBrowserPush,
  pushSupported,
} from "@/lib/browser-push";
import { loadingPlaceholder } from "@/lib/loading-style";
import { usePwa } from "@/components/pwa-provider";
import { ButtonControl } from "@/components/ui/button-control";
import { SemanticStatus } from "@/components/ui/semantic-status";
import {
  WorkspaceHero,
  WorkspacePanel,
  WorkspaceSurface,
} from "@/components/ui/workspace-surface";
const subscribeSupport = () => () => {};
interface AccountSession {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}
function deviceLabel(agent: string | null) {
  const browser = agent?.includes("Firefox")
    ? "Firefox"
    : agent?.includes("Edg/")
      ? "Edge"
      : agent?.includes("Chrome")
        ? "Chrome"
        : agent?.includes("Safari")
          ? "Safari"
          : "Unknown browser";
  const device = agent?.includes("Android")
    ? "Android"
    : agent?.includes("iPhone") || agent?.includes("iPad")
      ? "iOS"
      : agent?.includes("Windows")
        ? "Windows"
        : agent?.includes("Macintosh")
          ? "macOS"
          : agent?.includes("Linux")
            ? "Linux"
            : "Unknown device";
  return `${browser} · ${device}`;
}
function date(value: string) {
  return new Date(value).toLocaleString();
}
export function AccountSettings() {
  const { registration, install, unavailable } = usePwa();
  const supported = useSyncExternalStore(
    subscribeSupport,
    pushSupported,
    () => false,
  );
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [pushState, setPushState] = useState("Checking browser support…");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    apiRequest<AccountSession[]>("/auth/sessions", { method: "GET" })
      .then((data) => {
        if (active) {
          setSessions(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    if (!pushSupported()) return;
    let active = true;
    if (registration)
      void registration.pushManager
        .getSubscription()
        .then((value) => {
          if (active) {
            setSubscription(value);
            setPushState(
              value
                ? "This browser has a push subscription. Enable again to link it to this session."
                : "Notifications are off for this browser.",
            );
          }
        })
        .catch(() => {
          if (active) {
            setPushState("Could not check notifications. Reload to try again.");
            setPushError(true);
          }
        });
    return () => {
      active = false;
    };
  }, [registration]);
  async function revoke(session: AccountSession) {
    setBusy(session.id);
    setErrors((previous) => ({ ...previous, [session.id]: "" }));
    try {
      await apiRequest(`/auth/sessions/${encodeURIComponent(session.id)}`, {
        method: "DELETE",
      });
      setSessions((previous) =>
        previous.filter((item) => item.id !== session.id),
      );
    } catch {
      setErrors((previous) => ({
        ...previous,
        [session.id]: "Could not sign out this device. Try again.",
      }));
    } finally {
      setBusy(null);
    }
  }
  async function revokeOthers() {
    setBusy("others");
    setErrors((previous) => ({ ...previous, others: "" }));
    try {
      await apiRequest("/auth/sessions/logout-others", { method: "POST" });
      setSessions((previous) => previous.filter((item) => item.current));
    } catch {
      setErrors((previous) => ({
        ...previous,
        others: "Could not sign out other devices. Try again.",
      }));
    } finally {
      setBusy(null);
    }
  }
  async function pushAction(action: "enable" | "disable" | "test") {
    setPushBusy(true);
    setPushError(false);
    try {
      if (action === "enable") {
        setSubscription(await enableBrowserPush());
        setPushState("Notifications are enabled for this session.");
      }
      if (action === "disable" && subscription) {
        await disableBrowserPush(subscription);
        setSubscription(null);
        setPushState("Notifications are off for this browser.");
      }
      if (action === "test") {
        const result = await apiRequest<{ queued: number }>(
          "/collaboration/push/test",
          { method: "POST" },
        );
        setPushState(
          result.queued > 0
            ? "Test notification requested. Check this device's notifications."
            : "No notification was sent. Enable notifications to link this browser to your current session, then try again.",
        );
      }
    } catch (error) {
      setPushError(true);
      setPushState(
        error instanceof Error
          ? error.message
          : "Could not update notifications. Try again.",
      );
    } finally {
      setPushBusy(false);
    }
  }
  const groups: AccountSession[][] = [];
  for (const session of sessions) {
    const group = session.userAgent
      ? groups.find(([first]) => first.userAgent === session.userAgent)
      : undefined;
    if (group) group.push(session);
    else groups.push([session]);
  }
  const rows: (AccountSession[] | undefined)[] = loading
    ? [undefined, undefined]
    : groups;
  return (
    <WorkspaceSurface measure="form">
      <WorkspaceHero
        eyebrow="Settings"
        title="Account & devices"
        description="Manage signed-in devices, browser notifications, and the AmirLab app."
      />
      <WorkspacePanel
        title="Signed-in devices"
        description="Matching reported browsers and devices are grouped across domains and networks. Groups are approximate and may include different profiles or devices. Expand a group to manage each login."
        action={
          <ButtonControl
            className="whitespace-nowrap"
            variant="danger"
            disabled={
              loading ||
              busy !== null ||
              !sessions.some((item) => !item.current)
            }
            busy={busy === "others"}
            onClick={() => void revokeOthers()}
          >
            Sign out other devices
          </ButtonControl>
        }
      >
        {errors.others ? (
          <div role="alert" className="p-4">
            <SemanticStatus tone="error">{errors.others}</SemanticStatus>
          </div>
        ) : null}
        {loadError ? (
          <div role="alert" className="grid gap-3 p-4">
            <SemanticStatus tone="error">
              Could not load signed-in devices. Try again.
            </SemanticStatus>
            <ButtonControl
              onClick={() => {
                setLoading(true);
                setReload((value) => value + 1);
              }}
            >
              Retry
            </ButtonControl>
          </div>
        ) : null}
        <div aria-busy={loading}>
          {rows.map((group, index) => {
            const session = group?.find((item) => item.current) ?? group?.[0];
            const similar =
              group?.filter((item) => item.id !== session?.id) ?? [];
            return (
              <div
                key={session?.id ?? index}
                className="grid gap-3 border-b border-line p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="grid min-w-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-sm font-medium ${loadingPlaceholder(!session, "label", "long")}`}
                    >
                      {session ? deviceLabel(session.userAgent) : "Device name"}
                    </h3>
                    {session?.current ? (
                      <SemanticStatus tone="info">This session</SemanticStatus>
                    ) : null}
                  </div>
                  <p
                    className={`text-xs text-ink-muted ${loadingPlaceholder(!session, "label", "long")}`}
                  >
                    {session
                      ? `Last active ${date(session.lastSeenAt)}`
                      : "Last active date"}
                  </p>
                  <p
                    className={`break-words text-xs text-ink-muted ${loadingPlaceholder(!session, "label", "long")}`}
                  >
                    {session
                      ? `Signed in ${date(session.createdAt)} · Expires ${date(session.expiresAt)}${session.ipAddress ? ` · IP ${session.ipAddress}` : ""}`
                      : "Session details"}
                  </p>
                  {similar.length ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-ink-muted">
                        {similar.length + 1} similar sessions
                      </summary>
                      <p className="my-2 text-ink-muted">
                        Same reported browser and device; these may be different
                        profiles, devices, or domains.
                      </p>
                      {similar.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-2 border-t border-line py-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <p>
                            Signed in {date(item.createdAt)} · Last active{" "}
                            {date(item.lastSeenAt)}
                            {item.ipAddress ? ` · IP ${item.ipAddress}` : ""}
                          </p>
                          <ButtonControl
                            variant="danger-ghost"
                            disabled={busy !== null}
                            busy={busy === item.id}
                            onClick={() => void revoke(item)}
                          >
                            Sign out
                          </ButtonControl>
                          {errors[item.id] ? (
                            <span role="alert">{errors[item.id]}</span>
                          ) : null}
                        </div>
                      ))}
                    </details>
                  ) : null}
                  {session && errors[session.id] ? (
                    <span role="alert">
                      <SemanticStatus tone="error">
                        {errors[session.id]}
                      </SemanticStatus>
                    </span>
                  ) : null}
                </div>
                {!session || !session.current ? (
                  <ButtonControl
                    variant="danger-ghost"
                    loading={!session}
                    busy={busy === session?.id}
                    disabled={busy !== null}
                    onClick={() => {
                      if (session) void revoke(session);
                    }}
                  >
                    Sign out
                  </ButtonControl>
                ) : null}
              </div>
            );
          })}
        </div>
        {!loading && !loadError && sessions.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">
            No active devices found. Reload to check your current session.
          </p>
        ) : null}
      </WorkspacePanel>
      <WorkspacePanel
        title="Browser notifications"
        description="Receive a generic workspace update on your lock screen. Enable notifications separately on each device."
      >
        <div className="grid gap-3 p-4">
          <div role="status">
            <SemanticStatus tone={pushError ? "error" : "neutral"}>
              {supported
                ? unavailable
                  ? "The app worker is unavailable. Reload and try again."
                  : pushState
                : "This browser does not support push. On iPhone or iPad, install AmirLab on your Home Screen first."}
            </SemanticStatus>
          </div>
          <p className="text-xs text-ink-muted">
            On iPhone or iPad, open Safari, choose Share → Add to Home Screen,
            then open the app. If permission is denied, allow notifications in
            browser or device settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonControl
              variant="primary"
              disabled={!registration || pushBusy}
              onClick={() => void pushAction("enable")}
            >
              Enable notifications
            </ButtonControl>
            <ButtonControl
              disabled={!subscription || pushBusy}
              onClick={() => void pushAction("disable")}
            >
              Disable notifications
            </ButtonControl>
            <ButtonControl
              disabled={!subscription || pushBusy}
              onClick={() => void pushAction("test")}
            >
              Send test
            </ButtonControl>
          </div>
        </div>
      </WorkspacePanel>
      <WorkspacePanel
        title="Install AmirLab"
        description="Open your workspace from your Home Screen or desktop."
      >
        <div className="grid gap-3 p-4">
          <p className="text-sm text-ink-muted">
            Use your browser&apos;s Install app option. On iPhone or iPad,
            choose Share → Add to Home Screen. You need an internet connection
            to view workspace content.
          </p>
          {install ? (
            <ButtonControl
              variant="primary"
              onClick={() => void install().catch(() => {})}
            >
              Install app
            </ButtonControl>
          ) : null}
        </div>
      </WorkspacePanel>
    </WorkspaceSurface>
  );
}
