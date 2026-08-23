import type { Metadata } from "next";
import { RevertEmailForm } from "@/components/revert-email-form";

export const metadata: Metadata = { title: "Revert email change" };

export default function RevertEmailPage() {
  return (
    <div className="min-h-svh bg-canvas">
      <section className="grid min-h-svh content-center justify-items-center p-[clamp(2rem,6vw,5rem)] max-[560px]:px-4">
        <div className="w-[min(100%,520px)]">
          <div className="border-t border-line-strong pt-[.8rem]">
            <p className="mb-[.8rem] flex items-center gap-[.55rem] font-mono text-[.6rem] font-semibold uppercase tracking-[.09em] text-brand before:h-px before:w-[30px] before:bg-brand">
              Account security
            </p>
            <h1 className="m-0 font-serif text-[clamp(2.6rem,5.5vw,4.4rem)] font-medium leading-[.94] tracking-[-.05em]">
              Revert email change
            </h1>
          </div>
          <RevertEmailForm />
        </div>
      </section>
    </div>
  );
}
