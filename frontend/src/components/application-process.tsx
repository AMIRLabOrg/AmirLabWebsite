const STEPS = [
  { meta: "Choose an open role and upload one text-based PDF.", title: "Upload CV" },
  { meta: "We check readable text, contact details, and section structure.", title: "ATS validation" },
  { meta: "A lab reviewer checks the parsed CV beside the original file.", title: "Human review" },
  { meta: "Accepted applicants receive secure instructions to activate an account.", title: "Decision & account" },
] as const;

export function ApplicationProcess() {
  return (
    <aside className="sticky top-[6.5rem] self-start px-[.25rem] py-[.25rem] max-[900px]:static" aria-label="Application process">
      <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">Application path</p>
      <h2 className="mb-[1.8rem] mt-3 font-serif text-[clamp(2rem,3vw,2.8rem)] font-medium leading-[.98] tracking-[-.035em]">From upload to review</h2>
      <ol className="relative m-0 list-none p-0 before:absolute before:bottom-3 before:left-[6px] before:top-[7px] before:w-px before:bg-line after:absolute after:left-[6px] after:top-[7px] after:h-[16%] after:w-px after:origin-top after:animate-[rail-enter_700ms_180ms_cubic-bezier(.22,1,.36,1)_both] after:bg-brand motion-reduce:after:animate-none">
        {STEPS.map((step, index) => (
          <li className="relative z-[1] grid grid-cols-[13px_minmax(0,1fr)] gap-1 pb-6 last:pb-0" key={step.title}>
            <span aria-hidden="true" className={`row-span-2 mt-[.15rem] h-3 w-3 rounded-full border-2 ${index === 0 ? "border-brand bg-brand shadow-[0_0_0_4px_var(--brand-soft)]" : "border-line bg-surface"}`} />
            <strong className="pl-[.7rem] text-[.88rem] leading-[1.3]">{step.title}</strong>
            <p className="m-0 pl-[.7rem] text-[.76rem] leading-[1.45] text-ink-muted">{step.meta}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
