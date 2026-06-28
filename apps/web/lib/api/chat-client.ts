import { clientEnv } from "@/lib/env/client";

/**
 * The single typed module that talks to the FastAPI chat service (feature 011).
 * Sibling of `monitoring-client.ts`; same rule (constitution transport): no untyped
 * `fetch` leaks into components, origin from the validated public env, the Supabase
 * access token forwarded as the bearer so the API runs as the employee (RLS).
 *
 * Chat-derived bands surface ONLY through these types; nothing here carries a
 * persisted crisis flag — the crisis panel is a live, render-only payload.
 */

const CHAT_BASE = `${clientEnv.apiUrl}/chat`;

export type Band = "at_ease" | "a_little_tense" | "tense";
export type ConversationState = "open" | "ended";
export type ChatRole = "user" | "assistant";

export type ConversationSummary = {
  id: string;
  title: string | null;
  state: ConversationState;
  rollupBand: Band | null;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ConversationDetail = {
  conversation: ConversationSummary;
  messages: ChatMessage[];
};

export type CrisisResource = {
  country: "EG" | "US";
  name: string;
  number: string;
  url: string | null;
  lastChecked: string;
};

export type CrisisPanel = {
  resources: CrisisResource[];
  universalLine: string;
  emergencyNumber: string | null;
};

export type SendOutcome = "ok" | "assistant_failed" | "rate_limited";

export type SendResult = {
  outcome: SendOutcome;
  userMessage: ChatMessage | null;
  assistantMessage: ChatMessage | null;
  crisis: CrisisPanel | null;
  rollupBand: Band | null;
  conversation: ConversationSummary | null;
  retryAfterSeconds: number | null;
};

export type EndResult = {
  outcome: "ended" | "retry";
  conversation: ConversationSummary | null;
};

export type ChatErrorKind =
  | "unauthorized"
  | "forbidden_role"
  | "not_found"
  | "network"
  | "unknown";

export type Result<T> = { ok: true; data: T } | { ok: false; kind: ChatErrorKind };

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

function errorKind(status: number): ChatErrorKind {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden_role";
    case 404:
      return "not_found";
    default:
      return "unknown";
  }
}

// ── mappers (snake_case API JSON → camelCase domain types) ──────────────────

function mapSummary(r: Record<string, unknown>): ConversationSummary {
  return {
    id: String(r.id),
    title: (r.title as string | null) ?? null,
    state: r.state as ConversationState,
    rollupBand: (r.rollup_band as Band | null) ?? null,
    messageCount: Number(r.message_count ?? 0),
    lastMessageAt: (r.last_message_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: String(r.id),
    role: r.role as ChatRole,
    content: String(r.content),
    createdAt: String(r.created_at),
  };
}

function mapCrisis(r: Record<string, unknown> | null | undefined): CrisisPanel | null {
  if (!r) return null;
  const rows = (r.resources as Record<string, unknown>[]) ?? [];
  return {
    resources: rows.map((x) => ({
      country: x.country as "EG" | "US",
      name: String(x.name),
      number: String(x.number),
      url: (x.url as string | null) ?? null,
      lastChecked: String(x.last_checked),
    })),
    universalLine: String(r.universal_line),
    emergencyNumber: (r.emergency_number as string | null) ?? null,
  };
}

function mapSend(r: Record<string, unknown>): SendResult {
  return {
    outcome: r.outcome as SendOutcome,
    userMessage: r.user_message ? mapMessage(r.user_message as Record<string, unknown>) : null,
    assistantMessage: r.assistant_message
      ? mapMessage(r.assistant_message as Record<string, unknown>)
      : null,
    crisis: mapCrisis(r.crisis as Record<string, unknown> | null),
    rollupBand: (r.rollup_band as Band | null) ?? null,
    conversation: r.conversation
      ? mapSummary(r.conversation as Record<string, unknown>)
      : null,
    retryAfterSeconds: (r.retry_after_seconds as number | null) ?? null,
  };
}

async function request<T>(
  url: string,
  init: RequestInit,
  parse: (body: unknown) => T,
  okStatuses: number[] = [200, 201],
): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, kind: "network" };
  }
  if (!okStatuses.includes(res.status)) {
    return { ok: false, kind: errorKind(res.status) };
  }
  if (res.status === 204) {
    return { ok: true, data: parse(null) };
  }
  const body = await res.json();
  return { ok: true, data: parse(body) };
}

// ── public API ──────────────────────────────────────────────────────────

export async function listConversations(
  accessToken: string,
): Promise<Result<ConversationSummary[]>> {
  return request(
    `${CHAT_BASE}/conversations`,
    { method: "GET", headers: authHeaders(accessToken) },
    (b) => ((b as { conversations: Record<string, unknown>[] }).conversations ?? []).map(mapSummary),
  );
}

export async function createConversation(
  accessToken: string,
): Promise<Result<ConversationSummary>> {
  return request(
    `${CHAT_BASE}/conversations`,
    { method: "POST", headers: authHeaders(accessToken) },
    (b) => mapSummary(b as Record<string, unknown>),
  );
}

export async function getCurrentConversation(
  accessToken: string,
): Promise<Result<ConversationDetail | null>> {
  return request(
    `${CHAT_BASE}/conversations/current`,
    { method: "GET", headers: authHeaders(accessToken) },
    (b) => {
      if (!b) return null;
      const body = b as { conversation: Record<string, unknown>; messages: Record<string, unknown>[] };
      return { conversation: mapSummary(body.conversation), messages: body.messages.map(mapMessage) };
    },
  );
}

export async function getConversation(
  accessToken: string,
  conversationId: string,
): Promise<Result<ConversationDetail>> {
  return request(
    `${CHAT_BASE}/conversations/${conversationId}`,
    { method: "GET", headers: authHeaders(accessToken) },
    (b) => {
      const body = b as { conversation: Record<string, unknown>; messages: Record<string, unknown>[] };
      return { conversation: mapSummary(body.conversation), messages: body.messages.map(mapMessage) };
    },
  );
}

export async function renameConversation(
  accessToken: string,
  conversationId: string,
  title: string,
): Promise<Result<ConversationSummary>> {
  return request(
    `${CHAT_BASE}/conversations/${conversationId}`,
    { method: "PATCH", headers: authHeaders(accessToken), body: JSON.stringify({ title }) },
    (b) => mapSummary(b as Record<string, unknown>),
  );
}

export async function deleteConversation(
  accessToken: string,
  conversationId: string,
): Promise<Result<void>> {
  return request(
    `${CHAT_BASE}/conversations/${conversationId}`,
    { method: "DELETE", headers: authHeaders(accessToken) },
    () => undefined,
    [204],
  );
}

export async function sendMessage(
  accessToken: string,
  conversationId: string,
  content: string,
): Promise<Result<SendResult>> {
  return request(
    `${CHAT_BASE}/conversations/${conversationId}/messages`,
    { method: "POST", headers: authHeaders(accessToken), body: JSON.stringify({ content }) },
    (b) => mapSend(b as Record<string, unknown>),
  );
}

export async function retryAssistant(
  accessToken: string,
  conversationId: string,
): Promise<Result<SendResult>> {
  return request(
    `${CHAT_BASE}/conversations/${conversationId}/retry`,
    { method: "POST", headers: authHeaders(accessToken) },
    (b) => mapSend(b as Record<string, unknown>),
  );
}

export async function endConversation(
  accessToken: string,
  conversationId: string,
): Promise<Result<EndResult>> {
  return request(
    `${CHAT_BASE}/conversations/${conversationId}/end`,
    { method: "POST", headers: authHeaders(accessToken) },
    (b) => {
      const body = b as { outcome: "ended" | "retry"; conversation: Record<string, unknown> | null };
      return {
        outcome: body.outcome,
        conversation: body.conversation ? mapSummary(body.conversation) : null,
      };
    },
  );
}
