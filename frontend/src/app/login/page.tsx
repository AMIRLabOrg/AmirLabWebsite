import type { Metadata } from "next";
import { GuestOnly } from "@/components/guest-only";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="min-h-svh bg-canvas">
      <GuestOnly>
        <section className="grid min-h-svh">
          <div className="grid content-center justify-items-center p-[clamp(2rem,6vw,5rem)] max-[900px]:py-12 max-[560px]:px-4 max-[560px]:pb-8 max-[560px]:pt-[1.4rem]">
            <div className="w-[min(100%,520px)] max-[560px]:w-full">
              <div className="border-t border-line-strong pt-[.8rem]">
                <p className="mb-[.8rem] flex items-center gap-[.55rem] font-mono text-[.6rem] font-semibold uppercase tracking-[.09em] text-brand before:h-px before:w-[30px] before:bg-brand">Member access</p>
                <h1 className="m-0 font-serif text-[clamp(2.8rem,6vw,4.8rem)] font-medium leading-[.9] tracking-[-.055em]">Lab workspace</h1>
                <p className="mt-[.9rem] max-w-[460px] text-[.82rem] leading-[1.6] text-ink-muted">Sign in to the private research operating system.</p>
              </div>
              <LoginForm />
            </div>
          </div>
        </section>
      </GuestOnly>
    </div>
  );
}
