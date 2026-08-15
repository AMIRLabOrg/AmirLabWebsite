"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { BrandLockup } from "./brand-mark";

const footerLink = "text-[.72rem] text-ink-muted hover:text-ink";
const footerColumn = "grid justify-items-start gap-[.58rem] border-t border-line-strong pt-[.62rem]";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const workspace = pathname.startsWith("/workspace");
  const auth = pathname.startsWith("/login") || pathname.startsWith("/auth/");
  return (
    <>
      {workspace || auth ? null : <SiteHeader />}
      <main id="content">{children}</main>
      {workspace || auth ? null : (
        <footer className="border-t border-line-strong bg-surface">
          <div className="mx-auto grid w-full max-w-[var(--public-wide)] grid-cols-[minmax(280px,1.45fr)_repeat(3,minmax(120px,.55fr))] items-start gap-x-14 gap-y-[2.1rem] px-[clamp(1rem,3.2vw,3rem)] pt-12 pb-[1.4rem] max-[720px]:grid-cols-2 max-[560px]:grid-cols-1">
            <div className="grid justify-items-start gap-3 max-[720px]:col-span-2 max-[560px]:col-span-1">
              <Link className="inline-flex w-fit min-w-0 items-center" href="/" prefetch={false}><BrandLockup /></Link>
              <p className="m-0 font-mono text-[.62rem] leading-[1.65] text-ink-muted">Dhaka, Bangladesh · est. 2020<br />Non-profit academic consortium</p>
              <a className={footerLink} href="mailto:connect@amirl.org">connect@amirl.org</a>
            </div>
            <nav className={footerColumn} aria-label="Footer navigation"><strong className="font-mono text-[.56rem] tracking-[.09em] uppercase">Navigate</strong><Link className={footerLink} href="/" prefetch={false}>Home</Link><Link className={footerLink} href="/people" prefetch={false}>People</Link><Link className={footerLink} href="/about" prefetch={false}>About</Link><Link className={footerLink} href="/open-positions" prefetch={false}>Open positions</Link></nav>
            <nav className={footerColumn} aria-label="Research outputs"><strong className="font-mono text-[.56rem] tracking-[.09em] uppercase">Research outputs</strong><Link className={footerLink} href="/papers" prefetch={false}>Papers</Link><Link className={footerLink} href="/datasets" prefetch={false}>Datasets</Link><Link className={footerLink} href="/projects" prefetch={false}>Projects</Link></nav>
            <nav className={footerColumn} aria-label="Engage with AmirLab"><strong className="font-mono text-[.56rem] tracking-[.09em] uppercase">Engage</strong><Link className={footerLink} href="/open-positions" prefetch={false}>Apply to AmirLab</Link><Link className={footerLink} href="/login" prefetch={false}>Member login</Link><a className={footerLink} href="mailto:connect@amirl.org">Get in touch</a></nav>
            <div className="col-span-full mt-[.6rem] flex items-center justify-between gap-4 border-t border-line pt-4 font-mono text-[.58rem] text-ink-muted max-[560px]:flex-col max-[560px]:items-start"><span>© {new Date().getFullYear()} AmirLab · Non-profit academic research consortium</span><a href="https://amirl.org" rel="noreferrer" target="_blank">amirl.org</a></div>
          </div>
        </footer>
      )}
    </>
  );
}
