import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The primary card on the employee /app body. Claims the left ~60%
 * of the desktop grid; stacks first at ≤768px. Today this is a calm
 * "not yet" empty state — the live check-in form, signal indicators,
 * and recommendations land in features 004–009.
 *
 * Copy rubric (constitution-V calm voice):
 *   - No exclamation marks.
 *   - No alarmist or clinical phrasing ("stress", "warning",
 *     "alert", "abnormal", "elevated", "concerning").
 *   - Supportive voice: acknowledges the surface will fill in,
 *     without making promises about timing.
 */
export function TodaysCheckinCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-2xl text-ink">
          Today&apos;s check-in
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted">
          A quiet space for a quick read on how today is going.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted">
          Your daily check-in will live here once it&apos;s ready. Until
          then this corner stays calm on purpose.
        </p>
      </CardContent>
    </Card>
  );
}
