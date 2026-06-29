// cloud/mailbox/client.js
// Remote mailbox worker API. Cloud/network code stays out of rules.

export const MAILBOX_ENDPOINT = "https://snail.jensen-petej.workers.dev";

export function canonicalMailPhone(value) {
  return String(value ?? "").replace(/\D+/g, "").slice(0, 32);
}

async function requestJson(path, init = {}) {
  const res = await fetch(`${MAILBOX_ENDPOINT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || data?.ok === false) {
    throw new Error(String(data?.error || `mailbox request failed (${res.status})`));
  }
  return data || { ok: true };
}

export async function getInbox(phone) {
  const p = canonicalMailPhone(phone);
  return requestJson(`/mail/inbox?phone=${encodeURIComponent(p)}`);
}

export async function getOutbox(phone) {
  const p = canonicalMailPhone(phone);
  return requestJson(`/mail/outbox?phone=${encodeURIComponent(p)}`);
}

export async function sendMail(payload) {
  return requestJson("/mail/send", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function openMail(id) {
  return requestJson("/mail/open", {
    method: "POST",
    body: JSON.stringify({ id: String(id || "") }),
  });
}

export async function claimMail(id) {
  return requestJson("/mail/claim", {
    method: "POST",
    body: JSON.stringify({ id: String(id || "") }),
  });
}
