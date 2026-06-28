"use server";

import { revalidatePath } from "next/cache";

import * as chat from "@/lib/api/chat-client";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-action wrappers for the chat surfaces. Each validates the employee session,
 * forwards the Supabase access token to the typed FastAPI client (RLS-as-user), and
 * revalidates the affected paths. No untyped fetch, no service-role.
 */

async function accessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

const UNAUTH = { ok: false as const, kind: "unauthorized" as const };

export async function loadConversations() {
  const token = await accessToken();
  if (!token) return UNAUTH;
  return chat.listConversations(token);
}

export async function loadCurrentConversation() {
  const token = await accessToken();
  if (!token) return UNAUTH;
  return chat.getCurrentConversation(token);
}

export async function loadConversation(conversationId: string) {
  const token = await accessToken();
  if (!token) return UNAUTH;
  return chat.getConversation(token, conversationId);
}

export async function createChat() {
  const token = await accessToken();
  if (!token) return UNAUTH;
  const result = await chat.createConversation(token);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/chat");
  }
  return result;
}

export async function sendChatMessage(conversationId: string, content: string) {
  const token = await accessToken();
  if (!token) return UNAUTH;
  const result = await chat.sendMessage(token, conversationId, content);
  if (result.ok && result.data.outcome === "ok") {
    revalidatePath("/app");
    revalidatePath("/app/chat");
  }
  return result;
}

export async function retryChat(conversationId: string) {
  const token = await accessToken();
  if (!token) return UNAUTH;
  const result = await chat.retryAssistant(token, conversationId);
  if (result.ok && result.data.outcome === "ok") {
    revalidatePath("/app/chat");
  }
  return result;
}

export async function renameChat(conversationId: string, title: string) {
  const token = await accessToken();
  if (!token) return UNAUTH;
  const result = await chat.renameConversation(token, conversationId, title);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/chat");
  }
  return result;
}

export async function deleteChat(conversationId: string) {
  const token = await accessToken();
  if (!token) return UNAUTH;
  const result = await chat.deleteConversation(token, conversationId);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/chat");
  }
  return result;
}

export async function endChat(conversationId: string) {
  const token = await accessToken();
  if (!token) return UNAUTH;
  const result = await chat.endConversation(token, conversationId);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/chat");
  }
  return result;
}
