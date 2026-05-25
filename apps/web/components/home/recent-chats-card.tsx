import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Lower-right secondary card on the employee /app body. Stacks
 * third (last) at ≤768px. Today this is a calm "not yet" empty
 * state — past conversations with the in-app chatbot (feature
 * 008) will materialise here once the user starts using it.
 *
 * Copy rubric matches the other two home cards. The phrasing
 * "show up here" is deliberately verb-less in the title (not
 * "see your recent chats" or "view conversation history") so the
 * card reads as a passive surface that fills in over time, not
 * a control the user is meant to click yet.
 */
export function RecentChatsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-xl text-ink">
          Recent chats
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted">
          Past conversations show up here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted">
          You haven&apos;t started a chat yet. When you do, threads stay
          here so you can pick them back up.
        </p>
      </CardContent>
    </Card>
  );
}
