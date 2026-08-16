"use client";

import { AlertTriangle, Inbox, SearchX, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import { cn } from "@/lib/cn";

const ICONS = {
  empty: Inbox,
  error: AlertTriangle,
  filtered: SearchX,
  permission: ShieldAlert,
} as const;

export function StatePanel({
  action,
  body,
  title,
  variant = "empty",
}: {
  action?: { href?: string; label: string; onClick?: () => void };
  body: ReactNode;
  title: string;
  variant?: keyof typeof ICONS;
}) {
  const Icon = ICONS[variant];
  const iconTone =
    variant === "error"
      ? "border-danger text-danger"
      : variant === "permission"
        ? "border-warning text-warning"
        : "border-line text-ink-muted";
  return (
    <div
      className="flex flex-col items-center rounded-panel border border-line bg-surface px-8 py-16 text-center"
      role={variant === "error" ? "alert" : "status"}
    >
      <span
        className={cn(
          "mb-[1.2rem] flex h-12 w-12 items-center justify-center rounded-full border bg-canvas",
          iconTone,
        )}
      >
        <Icon aria-hidden="true" size={21} />
      </span>
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mx-auto mt-[.55rem] mb-[1.2rem] max-w-[420px] text-[.86rem] leading-[1.6] text-ink-muted">
        {body}
      </div>
      {action?.href ? (
        <ButtonLink href={action.href}>{action.label}</ButtonLink>
      ) : action?.onClick ? (
        <ButtonControl onClick={action.onClick}>{action.label}</ButtonControl>
      ) : null}
    </div>
  );
}
