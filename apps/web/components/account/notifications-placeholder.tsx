export function NotificationsPlaceholder() {
  return (
    <section
      id="notifications"
      aria-labelledby="account-notifications-heading"
      // Feature 012: the `needed_quiet` session-end action routes to /app/account#notifications;
      // scroll-margin keeps the heading clear of the top of the viewport on anchor jump.
      className="scroll-mt-24 space-y-4"
    >
      <header className="space-y-1.5">
        <h2
          id="account-notifications-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Notifications
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          How and when Serenify reaches out to you — quiet by default.
        </p>
      </header>
      <div
        role="note"
        className="rounded-card border-2 border-dashed border-border bg-bg/40 p-6"
      >
        <p className="text-sm leading-relaxed text-muted">
          Notification preferences land in a later release. For now nothing
          pings you — the only place messages appear is inside the app.
        </p>
      </div>
    </section>
  );
}
