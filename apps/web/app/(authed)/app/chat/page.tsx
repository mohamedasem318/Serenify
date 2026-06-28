import { redirect } from "next/navigation";

import { ChatShell } from "@/components/chat/chat-shell";
import {
  getConversation,
  getCurrentConversation,
  listConversations,
  type ConversationDetail,
  type ConversationSummary,
} from "@/lib/api/chat-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "employee" | "team_lead" | "admin";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: Role }>();
  if (!profile) redirect("/onboarding");
  // Employee-only surface (FR-012/016). Team leads/admins never see chat.
  if (profile.role !== "employee") redirect("/app");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  let conversations: ConversationSummary[] = [];
  let detail: ConversationDetail | null = null;
  if (token) {
    const requestedId = typeof sp?.c === "string" ? sp.c : null;
    // `?new=1` (from the home "New chat" action) opens a blank composer — skip resuming the
    // current conversation so no empty row is created and none is auto-selected. An explicit
    // `?c=<id>` still wins; plain /app/chat still resumes the most-recent chat (FR resume).
    const startNew = sp?.new === "1";
    const detailPromise = requestedId
      ? getConversation(token, requestedId)
      : startNew
        ? null
        : getCurrentConversation(token);
    const [listRes, detailRes] = await Promise.all([listConversations(token), detailPromise]);
    if (listRes.ok) conversations = listRes.data;
    if (detailRes && detailRes.ok) detail = detailRes.data;
  }

  return (
    // Balanced, bounded height (fuller than the mock's 560px, still not full-viewport): grows
    // with the viewport but clamps to 35–46rem so the workspace fills the page without a big
    // empty middle or a composer stranded far below the content. The ChatShell grid flex-1's
    // into the height under the heading; its log keeps its own scroll.
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[35rem] max-h-[46rem] w-full max-w-6xl flex-col gap-4">
      <h1 className="font-display text-2xl text-ink">Chat</h1>
      <ChatShell initialConversations={conversations} initialDetail={detail} />
    </div>
  );
}
