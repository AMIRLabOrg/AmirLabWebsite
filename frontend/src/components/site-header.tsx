"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { BrandLockup } from "@/components/brand-mark";
import { useNotifications } from "@/components/notification-provider";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  FrameBays,
  FrameRails,
  FrameRule,
  publicShellClass,
} from "@/components/ui/public-shell";
import { cn } from "@/lib/cn";

const NAVIGATION = [
  ["About", "/about"],
  ["People", "/people"],
  ["Departments", "/departments"],
  ["Papers", "/papers"],
  ["Datasets", "/datasets"],
  ["Projects", "/projects"],
  ["Open positions", "/open-positions"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { loading, user } = useAuth();
  const { loading: notificationsLoading, unreadCount } = useNotifications();
  const accountName = user?.person?.fullName ?? user?.email ?? "Account";

  return (
    <header className="sticky top-0 z-[60] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-[12px]">
      <FrameBays pattern="grid" />
      <FrameRails />
      <FrameRule edge="bottom" nodeSurface="surface" scope="parent" />
      <div
        className={cn(
          publicShellClass,
          "relative z-[6] grid min-h-[55px] grid-cols-[minmax(230px,.8fr)_minmax(0,1.5fr)_auto] items-center gap-[clamp(1rem,2.2vw,2.2rem)] max-[1050px]:grid-cols-[minmax(210px,1fr)_auto_auto] max-[560px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[560px]:gap-2",
        )}
      >
        <Link
          className="inline-flex w-fit min-w-0 items-center"
          href="/"
          onClick={() => setOpen(false)}
          prefetch={false}
        >
          <BrandLockup />
        </Link>
        <nav
          aria-label="Main navigation"
          className={cn(
            "flex min-w-0 items-stretch justify-center gap-[clamp(.75rem,1.4vw,1.35rem)] max-[1050px]:fixed max-[1050px]:right-[var(--frame-mobile-inner)] max-[1050px]:left-[var(--frame-mobile-inner)] max-[1050px]:top-[55px] max-[1050px]:z-[55] max-[1050px]:mx-auto max-[1050px]:max-h-[calc(100dvh-70px)] max-[1050px]:w-auto max-[1050px]:max-w-[520px] max-[1050px]:grid-cols-1 max-[1050px]:grid-rows-[repeat(7,min-content)] max-[1050px]:content-start max-[1050px]:items-start max-[1050px]:overflow-y-auto max-[1050px]:overscroll-contain max-[1050px]:border-x max-[1050px]:border-b max-[1050px]:border-line-strong max-[1050px]:bg-surface max-[1050px]:p-2 max-[1050px]:shadow-none",
            open ? "max-[1050px]:grid" : "max-[1050px]:hidden",
          )}
        >
          {NAVIGATION.map(([label, href]) => (
            <Link
              className={cn(
                "flex min-h-[55px] items-center whitespace-nowrap border-b-2 border-b-transparent text-[.8rem] font-medium text-ink-muted hover:text-ink-strong max-[1050px]:h-11 max-[1050px]:min-h-0 max-[1050px]:w-full max-[1050px]:justify-start max-[1050px]:border-b max-[1050px]:border-line max-[1050px]:px-3 max-[1050px]:text-[.82rem] last:max-[1050px]:border-b-0",
                pathname === href && "border-b-brand text-ink-strong",
              )}
              href={href}
              key={href}
              onClick={() => setOpen(false)}
              prefetch={false}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-16 justify-end">
          {loading ? (
            <span
              aria-label="Loading account"
              className="pointer-events-none"
              role="status"
            >
              <ProfileAvatar loading name="Account" shape="round" />
            </span>
          ) : user ? (
            <div className="flex items-center gap-[.45rem]">
              <Link
                aria-label={
                  notificationsLoading
                    ? "Notifications"
                    : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                }
                className="relative flex h-10 w-10 items-center justify-center rounded-control border border-transparent text-ink-muted"
                href="/workspace/notifications"
                prefetch={false}
                title="Notifications"
              >
                <Bell aria-hidden="true" size={21} />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-[5px] flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-danger font-mono text-[.52rem] text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <Link
                aria-label={`Manage ${accountName}`}
                href="/workspace"
                prefetch={false}
                title={accountName}
              >
                <ProfileAvatar
                  avatarId={user.person?.avatar?.id}
                  name={accountName}
                  shape="round"
                />
              </Link>
            </div>
          ) : (
            <Link
              className="inline-flex min-h-[var(--control-height)] items-center justify-center rounded-control border border-line-strong bg-transparent px-[.78rem] py-2 text-[.78rem] font-semibold hover:bg-brand-faint"
              href="/login"
              prefetch={false}
            >
              Log in
            </Link>
          )}
        </div>
        <button
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="hidden h-10 w-10 items-center justify-center rounded-control border border-line-strong bg-transparent p-0 max-[1050px]:inline-flex"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
