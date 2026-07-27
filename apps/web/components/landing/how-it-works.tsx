import { HOW_HEADING, HOW_STEPS } from "@/lib/landing/copy";
import { cn } from "@/lib/utils";

/**
 * How it works (feature 013, US1 — T102).
 *
 * THE THREE STAGES ARE NAMED BY THE BINDING TERMINOLOGY, not by the mock's paraphrase.
 * The mock called them "It notices / It asks / It helps, if you want", which names none of
 * the three surfaces this product actually has. They are CALIBRATION, the MONITORING
 * SESSION, and the WEEKLY WORK-ENVIRONMENT CHECK-IN — bare "check-in" is never used for
 * the concept, here or anywhere.
 *
 * The numbered stages are the one place on this page that carries ordinal labels, and
 * they are genuinely ordinal — this is a sequence a person moves through over time, which
 * is the whole reason the page is shaped this way. No other section gets an eyebrow.
 *
 * NO FAKE DEVICE CHROME (FR-052) and NO MODEL PERFORMANCE FIGURE (FR-004). The second
 * step earns its emphasis from the copy, not from a screenshot of a prompt.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{HOW_HEADING}</h2>

        <ol className="mt-8 grid list-none gap-4 lg:grid-cols-3">
          {HOW_STEPS.map((step) => (
            <li
              key={step.number}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border p-5",
                "flag" in step && step.flag
                  ? "border-meadow bg-meadow/[0.06]"
                  : "border-border bg-surface/40",
              )}
            >
              <span className="font-display text-sm font-semibold tracking-widest text-muted">
                {step.number}
              </span>
              <h3 className="mt-2 text-base font-semibold text-ink [overflow-wrap:anywhere]">
                {step.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              {"flag" in step && step.flag ? (
                <span className="mt-4 w-fit rounded-full bg-meadow/12 px-2.5 py-0.5 text-xs font-medium text-meadow-text">
                  {step.flag}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
