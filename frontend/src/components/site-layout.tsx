"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { BrandLockup } from "./brand-mark";
import {
  FrameRails,
  FrameRule,
  FrameRuleNodes,
} from "@/components/ui/public-shell";

const footerLink = "text-[.72rem] text-ink-muted hover:text-ink";
const footerColumn = "grid justify-items-start gap-[.58rem] pt-[.62rem]";
const siteEmail = process.env.NEXT_PUBLIC_SITE_EMAIL ?? "admin@example.test";

export function SiteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const workspace = pathname.startsWith("/workspace");
  const auth = pathname.startsWith("/login") || pathname.startsWith("/auth/");
  return (
    <div className={workspace ? undefined : "public-site"}>
      {workspace || auth ? null : <SiteHeader />}
      <main className={workspace ? undefined : "relative isolate"} id="content">
        <div className={workspace ? undefined : "relative"}>{children}</div>
        {workspace ? null : <FrameRails className="z-0" />}
      </main>
      {workspace || auth ? null : (
        <footer className="relative z-10 border-t border-line-strong bg-surface">
          <FrameRails />
          <FrameRuleNodes
            className="top-[-.5px] z-10"
            nodeSurfaceClassName="bg-surface"
          />
          <div className="relative z-[1] mx-auto grid w-full max-w-[var(--public-wide)] grid-cols-[minmax(280px,1.45fr)_repeat(3,minmax(120px,.55fr))] items-start gap-x-14 gap-y-[2.1rem] px-[var(--public-gutter)] pt-12 max-[720px]:grid-cols-2 max-[560px]:grid-cols-1">
            <div className="grid justify-items-start gap-3 max-[720px]:col-span-2 max-[560px]:col-span-1">
              <Link
                className="inline-flex w-fit min-w-0 items-center"
                href="/"
                prefetch={false}
              >
                <BrandLockup />
              </Link>
              <p className="m-0 font-mono text-[.62rem] leading-[1.65] text-ink-muted">
                est. 2020
                <br />
                Non-profit academic consortium
              </p>
              <a className={footerLink} href={`mailto:${siteEmail}`}>
                {siteEmail}
              </a>
            </div>
            <nav className={footerColumn} aria-label="Footer navigation">
              <strong className="font-mono text-[.56rem] tracking-[.09em] uppercase">
                Navigate
              </strong>
              <Link className={footerLink} href="/" prefetch={false}>
                Home
              </Link>
              <Link className={footerLink} href="/people" prefetch={false}>
                People
              </Link>
              <Link className={footerLink} href="/about" prefetch={false}>
                About
              </Link>
              <Link
                className={footerLink}
                href="/open-positions"
                prefetch={false}
              >
                Open positions
              </Link>
            </nav>
            <nav className={footerColumn} aria-label="Research outputs">
              <strong className="font-mono text-[.56rem] tracking-[.09em] uppercase">
                Research outputs
              </strong>
              <Link className={footerLink} href="/papers" prefetch={false}>
                Papers
              </Link>
              <Link className={footerLink} href="/datasets" prefetch={false}>
                Datasets
              </Link>
              <Link className={footerLink} href="/projects" prefetch={false}>
                Projects
              </Link>
            </nav>
            <nav className={footerColumn} aria-label="Engage with AmirLab">
              <strong className="font-mono text-[.56rem] tracking-[.09em] uppercase">
                Engage
              </strong>
              <Link
                className={footerLink}
                href="/open-positions"
                prefetch={false}
              >
                Apply to AmirLab
              </Link>
              <Link className={footerLink} href="/login" prefetch={false}>
                Member login
              </Link>
              <a className={footerLink} href={`mailto:${siteEmail}`}>
                Get in touch
              </a>
            </nav>
            <div className="relative col-span-full mx-[calc(var(--public-gutter)*-1)] mt-[.6rem] flex items-center justify-between gap-4 border-t border-line px-[var(--public-gutter)] pt-4 pb-4 font-mono text-[.58rem] text-ink-muted lg:border-t-0 max-[560px]:flex-col max-[560px]:items-start">
              <FrameRule
                edge="top"
                scope="contained"
                nodeSurfaceClassName="bg-surface"
              />
              <span>
                © {new Date().getFullYear()} AmirLab · Non-profit academic
                research consortium
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
