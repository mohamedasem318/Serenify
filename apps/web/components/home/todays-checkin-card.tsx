import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The primary card on the employee /app body. Claims the left ~60%
 * of the desktop grid; stacks first at ≤768px.
 *
 * Feature 008 / US1 (T034): the idle state gains the **Start check-in** action,
 * routing to the employee monitoring page (`/app/monitor`), where the explicit
 * camera-permission request happens (FR-001). The live recap + mini-trend and the
 * monitoring/paused card states are deferred to US4/US2.
 *
 * Copy rubric (constitution-V calm voice):
 *   - No exclamation marks.
 *   - No alarmist or clinical phrasing ("warning", "alert", "abnormal",
 *     "elevated", "concerning"). ("stress" is now apt — this card is the
 *     entry to a stress check-in; copy traces to the approved 008 mock.)
 *   - Supportive voice.
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
      <CardContent className="flex flex-col items-start gap-5">
        <p className="text-sm leading-relaxed text-muted">
          Watches for signs of stress while you work and checks in if something comes up.
        </p>
        <Button asChild variant="meadow">
          <Link href="/app/monitor">Start check-in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
