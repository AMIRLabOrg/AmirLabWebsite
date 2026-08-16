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
import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useNotifications } from "@/components/notification-provider";
import { ProfileAvatar } from "@/components/profile-avatar";
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
    <div data-loading={loading || !user || undefined}>
      <div
        className={cn(
          "grid min-h-screen w-full items-stretch bg-canvas transition-[grid-template-columns] duration-300 ease-in-out max-[820px]:block",
          sidebarOpen
            ? "grid-cols-[260px_minmax(0,1fr)]"
            : "grid-cols-[64px_minmax(0,1fr)]",
        )}
      >
        <aside className="sticky top-0 flex h-screen min-w-0 flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-paper pt-[.85rem] pb-4 max-[820px]:static max-[820px]:h-auto max-[820px]:w-full max-[820px]:overflow-visible max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:pt-[.65rem] max-[820px]:pb-0">
          <div
            className={cn(
              "flex items-center gap-2 border-b border-line-strong pt-[.1rem] pb-[.85rem] max-[820px]:border-b-0 max-[820px]:pb-[.55rem] min-h-[51px]",
              sidebarOpen
                ? "justify-between px-[.85rem]"
                : "justify-center px-0",
            )}
          >
            {sidebarOpen ? (
              <strong className="text-[.9rem]">Workspace</strong>
            ) : null}
            <button
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-brand-faint hover:text-brand max-[820px]:hidden"
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
              "mt-[.55rem] grid gap-[.55rem] max-[820px]:-mx-4 max-[820px]:mt-0 max-[820px]:flex max-[820px]:gap-0 max-[820px]:overflow-x-auto max-[820px]:px-4 max-[820px]:[scrollbar-width:none]",
              sidebarOpen ? "px-[.85rem]" : "px-[.4rem]",
            )}
          >
            {navigationGroups.map((group) => (
              <div
                className="grid gap-0 border-b border-line pb-[.55rem] max-[820px]:contents"
                key={group.label}
              >
                {sidebarOpen ? (
                  <span className="px-[.45rem] pt-[.28rem] pb-[.38rem] font-mono text-[.5rem] tracking-[.1em] text-ink-faint uppercase max-[820px]:hidden">
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
                        "flex min-h-[33px] items-center gap-2 border-l-2 border-transparent py-[.42rem] text-[.69rem] font-semibold text-ink-muted hover:bg-brand-faint hover:text-brand transition-colors max-[820px]:min-h-[38px] max-[820px]:shrink-0 max-[820px]:border-b-2 max-[820px]:border-l-0",
                        sidebarOpen
                          ? "px-[.48rem]"
                          : "justify-center px-0 relative",
                        active &&
                          "border-l-brand bg-brand-faint font-semibold text-brand max-[820px]:border-b-brand max-[820px]:border-l-transparent",
                      )}
                      href={href}
                      key={href}
                      title={!sidebarOpen ? label : undefined}
                    >
                      <Icon aria-hidden="true" size={17} className="shrink-0" />
                      {sidebarOpen && (
                        <span className="whitespace-nowrap">{label}</span>
                      )}
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
        </aside>
        <div className="grid min-w-0 grid-rows-[52px_minmax(0,1fr)] max-[820px]:grid-rows-[65px_minmax(0,1fr)]">
          <header className="sticky top-0 z-30 flex min-h-[52px] items-center justify-between border-b border-line bg-[color-mix(in_srgb,var(--canvas)_96%,transparent)] px-[clamp(1rem,2vw,1.8rem)] py-[.45rem]">
            <div className="flex items-center gap-[clamp(.5rem,2vw,1rem)]">
              <div className="grid gap-[.12rem]">
                <span
                  className={cn(
                    "font-mono text-[.5rem] tracking-[.07em] text-ink-muted uppercase",
                    loadingPlaceholder(loading || !user, "text"),
                  )}
                  data-placeholder={loading || !user ? "text" : undefined}
                >
                  Lab operating system
                </span>
                <strong
                  className={cn(
                    "text-[.76rem]",
                    loadingPlaceholder(loading || !user, "text"),
                  )}
                  data-placeholder={loading || !user ? "text" : undefined}
                >
                  {loading || !user ? "Workspace" : currentLabel}
                </strong>
              </div>
            </div>
            <div className="flex items-center gap-[.55rem]">
              <Link
                aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-brand-faint hover:text-brand"
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
          </header>
          <div
            className={cn(
              "min-w-0",
              pathname === "/workspace/chat"
                ? "min-h-0 overflow-hidden p-0"
                : "p-0 max-[820px]:px-4",
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
