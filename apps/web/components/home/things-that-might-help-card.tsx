import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Upper-right secondary card on the employee /app body. Stacks
 * second at ≤768px. Today this is a calm "not yet" empty state —
 * suggestions (calibrated by the per-user baseline from feature
 * 005 and surfaced by features 007/008) land here when there's
 * something useful to say.
 *
 * Copy rubric matches TodaysCheckinCard: no exclamation marks,
 * none of the alarmist/clinical blocklist, supportive voice. The
 * phrasing "when they're useful" is the load-bearing piece — it
 * promises usefulness, not novelty, and signals that an empty
 * card is the right state when nothing is yet known about the
 * user.
 */
export function ThingsThatMightHelpCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-xl text-ink">
          Things that might help
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted">
          Suggestions land here when they&apos;re useful.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted">
          Nothing to nudge you toward right now — Serenify is still
          learning your patterns.
        </p>
      </CardContent>
    </Card>
  );
}
