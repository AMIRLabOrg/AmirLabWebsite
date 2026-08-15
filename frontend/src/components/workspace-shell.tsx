"use client";

import { loadingPlaceholder } from "@/lib/loading-style";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BrandLockup } from "@/components/brand-mark";
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

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  const accountName = user?.person?.fullName ?? user?.email ?? "AmirLab member";
  const navigationGroups = workspaceNavigation(user?.role);
  const currentLabel = workspaceNavigationItem(pathname, navigationGroups)?.label ?? "Workspace";

  return (
    <div data-loading={(loading || !user) || undefined}>
      <div className="grid min-h-screen w-full grid-cols-[228px_minmax(0,1fr)] items-stretch bg-canvas max-[820px]:block">
        <aside className="sticky top-0 flex h-screen min-w-0 flex-col overflow-y-auto border-r border-line bg-paper px-[.85rem] pt-[.85rem] pb-4 max-[820px]:static max-[820px]:h-auto max-[820px]:overflow-visible max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:px-4 max-[820px]:pt-[.65rem] max-[820px]:pb-0">
          <Link aria-label="AMIRLab public website" className="grid grid-cols-[30px_1fr] items-center gap-[.55rem] border-b border-line-strong px-[.35rem] pt-[.1rem] pb-[.85rem] max-[820px]:border-b-0 max-[820px]:pb-[.55rem]" href="/">
            <BrandLockup compact />
          </Link>
          <nav aria-label="Workspace navigation" className="mt-[.55rem] grid gap-[.55rem] max-[820px]:-mx-4 max-[820px]:mt-0 max-[820px]:flex max-[820px]:gap-0 max-[820px]:overflow-x-auto max-[820px]:px-4 max-[820px]:[scrollbar-width:none]">
            {navigationGroups.map((group) => (
              <div className="grid gap-0 border-b border-line pb-[.55rem] max-[820px]:contents" key={group.label}>
                <span className="px-[.45rem] pt-[.28rem] pb-[.38rem] font-mono text-[.5rem] tracking-[.1em] text-ink-faint uppercase max-[820px]:hidden">{group.label}</span>
                {group.items.map((item) => {
                  const { href, icon: Icon, indicator, label } = item;
                  const active = isWorkspaceNavigationActive(pathname, href, item.match);
                  const indicatorCount = indicator === "notifications" ? unreadCount : indicator ? queueCounts[indicator] : 0;
                  return (
                    <Link
                      className={cn(
                        "flex min-h-[33px] items-center gap-2 border-l-2 border-transparent px-[.48rem] py-[.42rem] text-[.69rem] font-semibold text-ink-muted hover:bg-brand-faint hover:text-brand max-[820px]:min-h-[38px] max-[820px]:shrink-0 max-[820px]:border-b-2 max-[820px]:border-l-0",
                        active && "border-l-brand bg-brand-faint font-semibold text-brand max-[820px]:border-b-brand max-[820px]:border-l-transparent",
                      )}
                      href={href}
                      key={href}
                    >
                      <Icon aria-hidden="true" size={17} />
                      <span>{label}</span>
                      {indicatorCount > 0 ? (
                        <strong className="ml-auto inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-[10px] border border-current bg-transparent px-[.25rem] font-mono text-[.52rem] font-bold text-inherit">
                          {indicatorCount > 99 ? "99+" : indicatorCount}
                        </strong>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-auto grid gap-[.15rem] pt-[.8rem] max-[820px]:hidden">
            <button className="flex min-h-[38px] w-full cursor-pointer items-center justify-between gap-[.45rem] border-0 bg-transparent px-[.7rem] py-[.45rem] text-left text-[.75rem] font-semibold text-danger hover:text-danger-hover disabled:cursor-not-allowed disabled:opacity-55" disabled={loading || !user} onClick={() => setConfirmLogout(true)} type="button">
              <span className="inline-flex items-center gap-[.45rem]"><LogOut aria-hidden="true" size={15} /> Log out</span>
            </button>
            <Link className="flex min-h-[38px] items-center justify-between gap-[.45rem] px-[.7rem] py-[.45rem] text-[.75rem] text-ink-muted hover:text-brand" href="/" target="_blank">Public website <ArrowUpRight aria-hidden="true" size={15} /></Link>
          </div>
        </aside>
        <div className="grid min-w-0 grid-rows-[52px_minmax(0,1fr)] max-[820px]:grid-rows-[65px_minmax(0,1fr)]">
          <header className="sticky top-0 z-30 flex min-h-[52px] items-center justify-between border-b border-line bg-[color-mix(in_srgb,var(--canvas)_96%,transparent)] px-[clamp(1rem,2vw,1.8rem)] py-[.45rem]">
            <div className="grid gap-[.12rem]">
              <span className={cn("font-mono text-[.5rem] tracking-[.07em] text-ink-muted uppercase", loadingPlaceholder(loading || !user, "text"))} data-placeholder={loading || !user ? "text" : undefined}>Lab operating system</span>
              <strong className={cn("text-[.76rem]", loadingPlaceholder(loading || !user, "text"))} data-placeholder={loading || !user ? "text" : undefined}>{loading || !user ? "Workspace" : currentLabel}</strong>
            </div>
            <div className="flex items-center gap-[.55rem]">
              <Link aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`} className="relative inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-brand-faint hover:text-brand" href="/workspace/notifications">
                <Bell aria-hidden="true" size={20} />
                {unreadCount > 0 ? <span className="absolute -top-1 -right-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-[8px] bg-brand px-1 font-mono text-[.48rem] text-on-accent">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
              </Link>
              <Link className="inline-flex" href="/workspace/profile" title={accountName}>
                <ProfileAvatar avatarId={user?.person?.avatar?.id} loading={loading || !user} name={accountName} shape="round" size="md" />
              </Link>
            </div>
          </header>
          <div className={cn("min-w-0", pathname === "/workspace/chat" ? "min-h-0 overflow-hidden p-0" : "p-0 max-[820px]:px-4")}>
            {loading || !user ? null : children}
          </div>
        </div>
      </div>
      <ConfirmDialog busy={loggingOut} confirmLabel="Log out" description="You will be signed out of this workspace and returned to the login page." onCancel={() => setConfirmLogout(false)} onConfirm={() => { setLoggingOut(true); void logout(); }} open={confirmLogout} title="Log out of AmirLab?" tone="danger" />
    </div>
  );
}
