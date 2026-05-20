export function PrivacyPlaceholder() {
  return (
    <section
      aria-labelledby="account-privacy-heading"
      className="space-y-4"
    >
      <header className="space-y-1.5">
        <h2
          id="account-privacy-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Privacy
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          What your team-lead and admins can see lives here, alongside the
          rest of your visibility controls.
        </p>
      </header>
      <div
        role="note"
        className="rounded-card border-2 border-dashed border-border bg-bg/40 p-6"
      >
        <p className="text-sm leading-relaxed text-muted">
          Visibility controls arrive with the transparency view. You'll be
          able to choose what your manager sees and what stays private —
          there's nothing to configure yet.
        </p>
      </div>
    </section>
  );
}
