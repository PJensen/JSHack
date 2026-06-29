// display/ui/mailboxOverlay.js
// Presentation-only mailbox modal. Data and mutations arrive through ui:* events.

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, onClick, className = "") {
  const btn = el("button", className, label);
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

function input(type, placeholder = "", value = "") {
  const node = document.createElement("input");
  node.type = type;
  node.placeholder = placeholder;
  node.value = value;
  return node;
}

function dispatch(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function ensureStyles() {
  if (document.getElementById("mailboxOverlayStyles")) return;
  const style = document.createElement("style");
  style.id = "mailboxOverlayStyles";
  style.textContent = `
    .mailbox-panel { width: min(720px, calc(100vw - 24px)); max-height: min(760px, calc(100vh - 24px)); overflow: auto; }
    .mailbox-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .mailbox-title { font-size: 20px; font-weight: 700; }
    .mailbox-sub { opacity: 0.75; font-size: 12px; }
    .mailbox-tabs { display: flex; gap: 6px; margin: 10px 0; }
    .mailbox-tabs button, .mailbox-actions button, .mailbox-row button, .mailbox-phone button { cursor: pointer; }
    .mailbox-tabs button { padding: 7px 10px; border: 1px solid #526070; background: #202733; color: #eaf2ff; border-radius: 6px; }
    .mailbox-tabs button.active { background: #38506f; border-color: #7fa6d8; }
    .mailbox-status { min-height: 20px; margin: 6px 0; color: #d8e8ff; font-size: 13px; }
    .mailbox-error { color: #ffb0a8; }
    .mailbox-notice { color: #a8ffc8; }
    .mailbox-list { display: flex; flex-direction: column; gap: 8px; }
    .mailbox-row { border: 1px solid #3f4b5a; background: #151b24; border-radius: 6px; padding: 9px; }
    .mailbox-row-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    .mailbox-row-title { font-weight: 700; }
    .mailbox-row-meta { opacity: 0.75; font-size: 12px; margin-top: 2px; }
    .mailbox-row-body { white-space: pre-wrap; margin-top: 8px; line-height: 1.35; }
    .mailbox-attachments { margin-top: 8px; font-size: 13px; color: #d8e8ff; }
    .mailbox-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .mailbox-form { display: grid; gap: 8px; }
    .mailbox-form input, .mailbox-form textarea, .mailbox-phone input { box-sizing: border-box; width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #526070; background: #0f141b; color: #f0f6ff; }
    .mailbox-form textarea { min-height: 88px; resize: vertical; }
    .mailbox-item-list { display: grid; gap: 4px; max-height: 180px; overflow: auto; padding: 6px; border: 1px solid #3f4b5a; border-radius: 6px; }
    .mailbox-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .mailbox-phone { display: grid; gap: 10px; }
  `;
  document.head.appendChild(style);
}

function formatDate(value) {
  const n = Number(value || 0);
  if (!(n > 0)) return "";
  try { return new Date(n).toLocaleString(); } catch { return ""; }
}

function attachmentText(mail) {
  const parts = [];
  const gold = Math.max(0, Number(mail?.gold || 0) | 0);
  if (gold > 0) parts.push(`${gold} gold`);
  const count = Array.isArray(mail?.items) ? mail.items.length : 0;
  if (count > 0) parts.push(`${count} item${count === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function renderPhone(panel, state) {
  const box = el("div", "mailbox-phone");
  box.appendChild(el("div", "mailbox-title", "Mailbox"));
  box.appendChild(el("div", "mailbox-sub", "Enter your phone number to check town mail."));
  const phone = input("tel", "Phone number");
  const submit = button("Save phone", () => {
    dispatch("ui:mailboxPhoneSubmit", { phone: phone.value });
  });
  box.appendChild(phone);
  box.appendChild(submit);
  if (state?.error) box.appendChild(el("div", "mailbox-status mailbox-error", state.error));
  panel.appendChild(box);
  setTimeout(() => phone.focus(), 0);
}

function renderMailRow(mail, kind, panel) {
  const activeId = String(panel._mailboxActiveId || "");
  const id = String(mail?.id || "");
  const row = el("div", "mailbox-row");
  const head = el("div", "mailbox-row-head");
  const left = el("div");
  left.appendChild(el("div", "mailbox-row-title", String(mail?.subject || "(no subject)")));
  const fromTo = kind === "inbox" ? `From ${mail?.fromPhone || "unknown"}` : `To ${mail?.toPhone || "unknown"}`;
  const date = formatDate(mail?.createdAt);
  left.appendChild(el("div", "mailbox-row-meta", `${fromTo}${date ? ` · ${date}` : ""}`));
  const open = button(activeId === id ? "Close" : "Open", () => {
    panel._mailboxActiveId = activeId === id ? "" : id;
    if (kind === "inbox" && activeId !== id) dispatch("ui:mailboxOpenMessage", { id });
    renderMailbox(panel, panel._mailboxState || {});
  });
  head.appendChild(left);
  head.appendChild(open);
  row.appendChild(head);

  const attach = attachmentText(mail);
  if (attach) row.appendChild(el("div", "mailbox-attachments", attach));

  if (activeId === id) {
    row.appendChild(el("div", "mailbox-row-body", String(mail?.body || "")));
    if (kind === "inbox" && !mail?.claimedAt && (Math.max(0, Number(mail?.gold || 0) | 0) > 0 || (mail?.items || []).length > 0)) {
      const actions = el("div", "mailbox-actions");
      actions.appendChild(button("Claim attachments", () => dispatch("ui:mailboxClaim", { id })));
      row.appendChild(actions);
    }
  }
  return row;
}

function renderInbox(panel, state) {
  const list = el("div", "mailbox-list");
  const rows = Array.isArray(state?.inbox) ? state.inbox : [];
  if (!rows.length) {
    list.appendChild(el("div", "mailbox-row", "Inbox is empty."));
    return list;
  }
  for (const mail of rows) list.appendChild(renderMailRow(mail, "inbox", panel));
  return list;
}

function renderOutbox(panel, state) {
  const wrap = el("div");
  const form = el("div", "mailbox-form");
  const toPhone = input("tel", "Recipient phone");
  const subject = input("text", "Subject", "JSHack mail");
  const body = document.createElement("textarea");
  body.placeholder = "Message";
  const gold = input("number", "Gold", "0");
  gold.min = "0";
  gold.max = String(Math.max(0, Number(state?.inventory?.gold || 0) | 0));
  const itemList = el("div", "mailbox-item-list");
  const selected = new Set();
  const items = Array.isArray(state?.inventory?.items) ? state.inventory.items : [];
  if (!items.length) itemList.appendChild(el("div", "mailbox-sub", "No carried items available."));
  for (const item of items) {
    const row = el("label", "mailbox-item");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(item.id);
      else selected.delete(item.id);
    });
    row.appendChild(cb);
    row.appendChild(document.createTextNode(`${item.name}${item.count > 1 ? ` x${item.count}` : ""}`));
    itemList.appendChild(row);
  }
  form.appendChild(toPhone);
  form.appendChild(subject);
  form.appendChild(body);
  form.appendChild(el("div", "mailbox-sub", `Gold carried: ${Math.max(0, Number(state?.inventory?.gold || 0) | 0)}`));
  form.appendChild(gold);
  form.appendChild(itemList);
  form.appendChild(button("Send mail", () => {
    dispatch("ui:mailboxSend", {
      toPhone: toPhone.value,
      subject: subject.value,
      body: body.value,
      gold: Number(gold.value || 0) | 0,
      itemIds: Array.from(selected),
    });
  }));
  wrap.appendChild(form);

  const sent = Array.isArray(state?.outbox) ? state.outbox : [];
  const title = el("div", "mailbox-sub", "Sent mail");
  title.style.marginTop = "14px";
  wrap.appendChild(title);
  const list = el("div", "mailbox-list");
  if (!sent.length) list.appendChild(el("div", "mailbox-row", "Outbox is empty."));
  for (const mail of sent) list.appendChild(renderMailRow(mail, "outbox", panel));
  wrap.appendChild(list);
  return wrap;
}

export function renderMailbox(panel, state = {}) {
  ensureStyles();
  panel._mailboxState = state;
  panel.classList.add("mailbox-panel");
  panel.innerHTML = "";
  if (state.needsPhone) {
    renderPhone(panel, state);
    return;
  }
  const tab = panel._mailboxTab || "inbox";
  const head = el("div", "mailbox-head");
  const title = el("div");
  title.appendChild(el("div", "mailbox-title", "Mailbox"));
  title.appendChild(el("div", "mailbox-sub", state.phone ? `Phone ${state.phone}` : ""));
  const actions = el("div", "mailbox-actions");
  actions.appendChild(button("Refresh", () => dispatch("ui:mailboxRefresh")));
  actions.appendChild(button("Change phone", () => dispatch("ui:mailboxForgetPhone")));
  head.appendChild(title);
  head.appendChild(actions);
  panel.appendChild(head);

  const tabs = el("div", "mailbox-tabs");
  const inbox = button("Inbox", () => {
    panel._mailboxTab = "inbox";
    renderMailbox(panel, panel._mailboxState || {});
  }, tab === "inbox" ? "active" : "");
  const outbox = button("Outbox", () => {
    panel._mailboxTab = "outbox";
    renderMailbox(panel, panel._mailboxState || {});
  }, tab === "outbox" ? "active" : "");
  tabs.appendChild(inbox);
  tabs.appendChild(outbox);
  panel.appendChild(tabs);

  const status = el("div", "mailbox-status");
  if (state.busy) status.textContent = "Contacting mailbox...";
  if (state.error) {
    status.className = "mailbox-status mailbox-error";
    status.textContent = state.error;
  } else if (state.notice) {
    status.className = "mailbox-status mailbox-notice";
    status.textContent = state.notice;
  }
  panel.appendChild(status);
  panel.appendChild(tab === "outbox" ? renderOutbox(panel, state) : renderInbox(panel, state));
}
