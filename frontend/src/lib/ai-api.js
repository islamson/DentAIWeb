/**
 * AI chat API helper.
 * POST /api/ai/chat with { message, history? }
 */

const HISTORY_LIMIT = 8;

export function buildHistory(messages) {
  if (!messages?.length) return [];
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 2000) }))
    .slice(-HISTORY_LIMIT);
}

export async function sendAIChatMessage(message, history = []) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      history: buildHistory(history),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || "AI yanıtı alınamadı.");
    err.status = res.status;
    err.code = data.code || null;
    throw err;
  }

  return data;
}
