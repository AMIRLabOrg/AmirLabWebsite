import type { Metadata } from "next";
import { AccountSetupForm } from "@/components/account-setup-form";
import { GuestOnly } from "@/components/guest-only";

export const metadata: Metadata = { title: "Set up account" };

export default async function AccountSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <GuestOnly>
      <section className="mx-auto w-full max-w-[500px] px-8 max-[640px]:px-4">
        <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">
          First-time access
        </p>
        <h1 className="mb-4 font-serif text-[clamp(2.4rem,5vw,4rem)] tracking-[-.05em]">
          Create your password
        </h1>
        <p className="m-0 max-w-[640px] text-[.95rem] leading-[1.65] text-ink-muted">
          This one-time link activates your account. Future logins use your
          email and password.
        </p>
        <AccountSetupForm token={token} />
      </section>
    </GuestOnly>
  );
}
