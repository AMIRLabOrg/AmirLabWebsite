"use client";

import { loadingPlaceholder } from "@/lib/loading-style";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useNotifications } from "@/components/notification-provider";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  FrameBays,
  FramePattern,
  FrameRails,
  FrameRule,
} from "@/components/ui/public-shell";
import { workspaceShellClass } from "@/components/ui/workspace-surface";
import { cn } from "@/lib/cn";
import {
  isWorkspaceNavigationActive,
  workspaceNavigation,
  workspaceNavigationItem,
} from "@/lib/workspace-navigation";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, logout, user } = useAuth();
  const { queueCounts, unreadCount } = useNotifications();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    try {
      if (window.matchMedia("(max-width: 820px)").matches) {
        // Mobile navigation must always keep its labels visible, regardless of
        // the desktop sidebar preference saved on this device.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSidebarOpen(true);
        return;
      }
      const stored = localStorage.getItem("amirlab:sidebar-open");
      if (stored !== null) setSidebarOpen(stored === "true");
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("amirlab:sidebar-open", String(next));
      } catch {}
      return next;
    });
  };

  const accountName = user?.person?.fullName ?? user?.email ?? "AmirLab member";
  const navigationGroups = workspaceNavigation(user?.role);
  const currentLabel =
    workspaceNavigationItem(pathname, navigationGroups)?.label ?? "Workspace";

  return (
    <div data-site="workspace" data-loading={loading || !user || undefined}>
      <div
        className={cn(
          "grid min-h-screen w-full items-stretch bg-canvas transition-[grid-template-columns] duration-300 ease-in-out max-[820px]:block",
          sidebarOpen
            ? "grid-cols-[264px_minmax(0,1fr)]"
            : "grid-cols-[58px_minmax(0,1fr)]",
        )}
      >
        <aside className="sticky top-0 flex h-screen min-w-0 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin] border-r border-line-strong bg-surface pb-4 max-[820px]:relative max-[820px]:h-auto max-[820px]:w-full max-[820px]:overflow-visible max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:pt-[.65rem] max-[820px]:pb-0">
          <FrameBays className="hidden max-[820px]:block" pattern="grid" />
          <FrameRails className="hidden max-[820px]:block" tone="quiet" />
          <div
            className={cn(
              "relative z-[6] flex h-[64px] shrink-0 items-center gap-2 border-b border-line-strong max-[820px]:h-[56px] max-[820px]:border-b max-[820px]:px-[var(--workspace-gutter)] max-[820px]:pb-0",
              sidebarOpen
                ? "justify-between px-[.85rem]"
                : "justify-center px-0",
            )}
          >
            {sidebarOpen ? (
              <div className="grid min-w-0 gap-[2px]">
                <strong className="truncate text-[.8rem] font-semibold">
                  Workspace
                </strong>
                <span className="truncate text-[.6rem] text-ink-muted">
                  {loading || !user ? "Research workspace" : user.email}
                </span>
              </div>
            ) : null}
            <button
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink max-[820px]:hidden"
              onClick={toggleSidebar}
              type="button"
            >
              {sidebarOpen ? (
                <PanelLeftClose aria-hidden="true" size={18} />
              ) : (
                <PanelLeftOpen aria-hidden="true" size={18} />
              )}
            </button>
          </div>
          <nav
            aria-label="Workspace navigation"
            className={cn(
              "relative z-[6] mt-[.6rem] grid gap-[.35rem] max-[820px]:mx-[var(--workspace-gutter)] max-[820px]:mt-0 max-[820px]:flex max-[820px]:gap-0 max-[820px]:overflow-x-auto max-[820px]:px-0 max-[820px]:[scrollbar-width:none]",
              sidebarOpen ? "px-[.85rem]" : "px-[.4rem]",
            )}
          >
            {navigationGroups.map((group) => (
              <div
                className="grid gap-0 border-b border-line pb-[.4rem] max-[820px]:contents"
                key={group.label}
              >
                {sidebarOpen ? (
                  <span className="px-[.45rem] pt-[.28rem] pb-[.38rem] font-mono text-[.55rem] tracking-[.105em] text-ink-faint uppercase max-[820px]:hidden">
                    {group.label}
                  </span>
                ) : (
                  <div className="h-[12px] max-[820px]:hidden" />
                )}
                {group.items.map((item) => {
                  const { href, icon: Icon, indicator, label } = item;
                  const active = isWorkspaceNavigationActive(
                    pathname,
                    href,
                    item.match,
                  );
                  const indicatorCount =
                    indicator === "notifications"
                      ? unreadCount
                      : indicator
                        ? queueCounts[indicator]
                        : 0;
                  return (
                    <Link
                      className={cn(
                        "flex min-h-[34px] items-center gap-2 border-l-2 border-transparent py-[.42rem] text-[.73rem] font-medium text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink max-[820px]:min-h-[38px] max-[820px]:shrink-0 max-[820px]:border-b-2 max-[820px]:border-l-0",
                        sidebarOpen
                          ? "px-[.48rem]"
                          : "justify-center px-0 relative",
                        active &&
                          "border-l-brand bg-surface-subtle font-medium text-ink max-[820px]:border-b-brand max-[820px]:border-l-transparent",
                      )}
                      href={href}
                      key={href}
                      title={!sidebarOpen ? label : undefined}
                    >
                      <Icon aria-hidden="true" size={17} className="shrink-0" />
                      <span
                        className={cn(
                          "whitespace-nowrap",
                          !sidebarOpen && "min-[821px]:hidden",
                        )}
                      >
                        {label}
                      </span>
                      {sidebarOpen && indicatorCount > 0 ? (
                        <strong className="ml-auto inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-[10px] border border-current bg-transparent px-[.25rem] font-mono text-[.52rem] font-bold text-inherit">
                          {indicatorCount > 99 ? "99+" : indicatorCount}
                        </strong>
                      ) : !sidebarOpen && indicatorCount > 0 ? (
                        <div className="absolute top-1 right-[.35rem] h-[6px] w-[6px] rounded-full bg-brand max-[820px]:hidden" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div
            className={cn(
              "mt-auto grid gap-[.15rem] pt-[.8rem] max-[820px]:hidden",
              sidebarOpen ? "px-[.85rem]" : "px-[.4rem]",
            )}
          >
            <button
              title={!sidebarOpen ? "Log out" : undefined}
              className={cn(
                "flex min-h-[38px] w-full cursor-pointer items-center gap-[.45rem] border-0 bg-transparent py-[.45rem] text-[.75rem] font-semibold text-danger transition-colors hover:text-danger-hover disabled:cursor-not-allowed disabled:opacity-55",
                sidebarOpen
                  ? "justify-between px-[.7rem]"
                  : "justify-center px-0",
              )}
              disabled={loading || !user}
              onClick={() => setConfirmLogout(true)}
              type="button"
            >
              {sidebarOpen ? (
                <span className="inline-flex items-center gap-[.45rem]">
                  <LogOut aria-hidden="true" size={15} className="shrink-0" />{" "}
                  Log out
                </span>
              ) : (
                <LogOut aria-hidden="true" size={17} className="shrink-0" />
              )}
            </button>
            {sidebarOpen && (
              <Link
                className="flex min-h-[38px] items-center justify-between gap-[.45rem] px-[.7rem] py-[.45rem] text-[.75rem] text-ink-muted transition-colors hover:text-brand whitespace-nowrap"
                href="/"
                target="_blank"
              >
                Public website{" "}
                <ArrowUpRight
                  aria-hidden="true"
                  size={15}
                  className="shrink-0"
                />
              </Link>
            )}
          </div>
          <FramePattern
            className="mt-3 h-[58px] shrink-0 border-t border-line-strong max-[820px]:hidden"
            variant="grid"
          />
        </aside>
        <div className="relative grid min-w-0 grid-rows-[64px_minmax(0,1fr)] max-[820px]:min-h-[calc(100svh-104px)] max-[820px]:grid-rows-[56px_minmax(0,1fr)]">
          <FrameRails tone="quiet" />
          <header className="sticky top-0 z-30 min-h-[64px] bg-surface/95 backdrop-blur-[12px] max-[820px]:min-h-[56px]">
            <FrameBays pattern="grid" />
            <FrameRails tone="quiet" />
            <FrameRule edge="bottom" nodeSurface="surface" scope="parent" />
            <div
              className={cn(
                workspaceShellClass,
                "relative z-[6] flex min-h-[64px] items-center justify-between bg-surface py-[.45rem] max-[820px]:min-h-[56px]",
              )}
            >
              <div className="flex min-w-0 items-center gap-[clamp(.5rem,2vw,1rem)]">
                <h1
                  className={cn(
                    "m-0 truncate font-serif text-[1.65rem] leading-none font-medium tracking-[-.025em] max-[820px]:font-sans max-[820px]:text-[1rem] max-[820px]:tracking-[-.01em]",
                    loadingPlaceholder(loading || !user, "text"),
                  )}
                  data-placeholder={loading || !user ? "text" : undefined}
                >
                  {loading || !user ? "Workspace" : currentLabel}
                </h1>
              </div>
              <div className="flex items-center gap-[.55rem]">
                <Link
                  aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
                  href="/workspace/notifications"
                >
                  <Bell aria-hidden="true" size={20} />
                  {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-[8px] bg-brand px-1 font-mono text-[.48rem] text-on-accent">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  className="inline-flex"
                  href="/workspace/profile"
                  title={accountName}
                >
                  <ProfileAvatar
                    avatarId={user?.person?.avatar?.id}
                    loading={loading || !user}
                    name={accountName}
                    shape="round"
                    size="md"
                  />
                </Link>
              </div>
            </div>
          </header>
          <div
            className={cn(
              "relative z-[1] min-w-0",
              pathname === "/workspace/chat"
                ? "min-h-0 overflow-hidden p-0"
                : "p-0",
            )}
          >
            {loading || !user ? null : children}
          </div>
        </div>
      </div>
      <ConfirmDialog
        busy={loggingOut}
        confirmLabel="Log out"
        description="You will be signed out of this workspace and returned to the login page."
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setLoggingOut(true);
          void logout();
        }}
        open={confirmLogout}
        title="Log out of AmirLab?"
        tone="danger"
      />
    </div>
  );
}
