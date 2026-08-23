import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-svh bg-canvas">
      <section className="grid min-h-svh content-center justify-items-center p-[clamp(2rem,6vw,5rem)] max-[560px]:px-4">
        <div className="w-[min(100%,520px)]">
          <div className="border-t border-line-strong pt-[.8rem]">
            <p className="mb-[.8rem] flex items-center gap-[.55rem] font-mono text-[.6rem] font-semibold uppercase tracking-[.09em] text-brand before:h-px before:w-[30px] before:bg-brand">
              Account recovery
            </p>
            <h1 className="m-0 font-serif text-[clamp(2.6rem,5.5vw,4.4rem)] font-medium leading-[.94] tracking-[-.05em]">
              Reset your password
            </h1>
            <p className="mt-[.9rem] max-w-[470px] text-[.82rem] leading-[1.6] text-ink-muted">
              Enter the email used to sign in. If the account is active, we will
              send a one-time reset link.
            </p>
          </div>
          <ForgotPasswordForm />
        </div>
      </section>
    </div>
  );
}
