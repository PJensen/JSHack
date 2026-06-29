// cloud/wiring/mailboxWiring.js
// Browser/cloud bridge for town mailbox interactions.

import { children, getParent, Parent, Sibling, attach, destroySubtree } from "../../lib/ecs-js/hierarchy.js";
import { makeRegistry } from "../../lib/ecs-js/serialization.js";
import * as Components from "../../rules/components/index.js";
import { Player } from "../../rules/components/Player.js";
import { MailboxOpenRequested } from "../../events/MailboxOpenRequested.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Weight } from "../../rules/components/Weight.js";
import {
  addToInventory,
  consumeFromStack,
  inventoryItems,
  removeFromInventory,
} from "../../rules/utils/inventoryFacade.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { playerEntity } from "../../rules/utils/queries.js";
import {
  canonicalMailPhone,
  claimMail,
  getInbox,
  getOutbox,
  openMail,
  sendMail,
} from "../mailbox/client.js";

const INSTALLED_KEY = Symbol.for("jshack:mailbox:wiring:installed");
const PHONE_KEY = "jshack.mailbox.phone";
const SNAPSHOT_KIND = "jshack:itemSnapshot";
const EXCLUDED_COMPONENTS = new Set([Parent.name, Sibling.name, Position.name, Weight.name]);

function clonePlain(value) {
  if (typeof structuredClone === "function") {
    try { return structuredClone(value); } catch {}
  }
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clonePlain);
  const out = {};
  for (const key of Object.keys(value)) out[key] = clonePlain(value[key]);
  return out;
}

function uiEvent(name, detail = {}) {
  try {
    const target = globalThis.window || globalThis;
    target.dispatchEvent?.(new CustomEvent(name, { detail }));
  } catch {}
}

function readStoredPhone() {
  try { return canonicalMailPhone(globalThis.localStorage?.getItem(PHONE_KEY)); } catch { return ""; }
}

function writeStoredPhone(phone) {
  const p = canonicalMailPhone(phone);
  if (!p) return "";
  try { globalThis.localStorage?.setItem(PHONE_KEY, p); } catch {}
  return p;
}

function forgetStoredPhone() {
  try { globalThis.localStorage?.removeItem(PHONE_KEY); } catch {}
}

function componentNameForStore(ckey, store) {
  if (store?._comp?.name) return store._comp.name;
  const desc = ckey?.description;
  return typeof desc === "string" ? desc : "";
}

function componentRegistryFromWorld(world) {
  const registry = makeRegistry(Object.values(Components), Parent, Sibling, Weight);
  for (const [ckey, store] of world?._store || []) {
    const name = componentNameForStore(ckey, store);
    if (name && store?._comp) registry.set(name, store._comp);
  }
  return registry;
}

function collectSubtreeIds(world, rootId) {
  const out = [];
  const walk = (id) => {
    if (!(id > 0) || !world.isAlive(id)) return;
    out.push(id);
    for (const child of children(world, id)) walk(child);
  };
  walk(rootId);
  return out;
}

function buildItemSnapshot(world, itemId) {
  const root = Number(itemId || 0) | 0;
  if (!(root > 0) || !world.isAlive(root) || !world.has(root, ItemInfo)) return null;
  const ids = collectSubtreeIds(world, root);
  const idSet = new Set(ids);
  const registry = componentRegistryFromWorld(world);
  const rows = [];
  for (const id of ids) {
    const comps = {};
    for (const [ckey, store] of world._store || []) {
      const name = componentNameForStore(ckey, store);
      if (!name || EXCLUDED_COMPONENTS.has(name) || !registry.has(name)) continue;
      const rec = store.get ? store.get(id) : null;
      if (!rec) continue;
      comps[name] = clonePlain(rec);
    }
    const parent = getParent(world, id);
    rows.push({
      oldId: id,
      parentOldId: idSet.has(parent) ? parent : 0,
      comps,
    });
  }
  const ni = world.get(root, NamedIdentity);
  const info = world.get(root, ItemInfo);
  return {
    kind: SNAPSHOT_KIND,
    version: 1,
    rootOldId: root,
    label: String(ni?.name || ni?.identity || info?.type || "item"),
    rows,
  };
}

function restoreItemSnapshot(world, snapshot, ownerId) {
  if (snapshot?.kind !== SNAPSHOT_KIND || !Array.isArray(snapshot.rows)) return 0;
  const registry = componentRegistryFromWorld(world);
  const idMap = new Map();
  for (const row of snapshot.rows) {
    const oldId = Number(row?.oldId || 0) | 0;
    if (!(oldId > 0)) continue;
    idMap.set(oldId, world.create());
  }
  for (const row of snapshot.rows) {
    const oldId = Number(row?.oldId || 0) | 0;
    const id = idMap.get(oldId);
    if (!(id > 0)) continue;
    for (const [name, payload] of Object.entries(row?.comps || {})) {
      const Comp = registry.get(name);
      if (!Comp || name === Parent.name || name === Sibling.name) continue;
      try { world.add(id, Comp, clonePlain(payload)); } catch {}
    }
  }
  for (const row of snapshot.rows) {
    const oldId = Number(row?.oldId || 0) | 0;
    const oldParent = Number(row?.parentOldId || 0) | 0;
    const id = idMap.get(oldId);
    const parent = idMap.get(oldParent);
    if (id > 0 && parent > 0) {
      try { attach(world, id, parent); } catch {}
    }
  }
  const root = idMap.get(Number(snapshot.rootOldId || 0) | 0) || 0;
  if (root > 0 && addToInventory(world, ownerId, root, { mergeCompatible: false })) return root;
  if (root > 0) {
    try { destroySubtree(world, root); } catch { try { world.destroy(root); } catch {} }
  }
  return 0;
}

function itemLabel(world, itemId) {
  const ni = world.get(itemId, NamedIdentity);
  const info = world.get(itemId, ItemInfo);
  return String(ni?.name || ni?.identity || info?.type || `item ${itemId}`);
}

function inventoryPayload(world, actorId) {
  const items = [];
  let gold = 0;
  for (const itemId of inventoryItems(world, actorId)) {
    const info = world.get(itemId, ItemInfo);
    const ni = world.get(itemId, NamedIdentity);
    const identity = String(ni?.identity || "");
    const count = Math.max(1, Number(info?.count || 0) | 0);
    if (identity === "gold" || String(info?.type || "") === "currency") {
      gold += count;
      continue;
    }
    items.push({
      id: itemId,
      name: itemLabel(world, itemId),
      identity,
      type: String(info?.type || "item"),
      count,
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  return { items, gold };
}

function normalizeMailRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    gold: Math.max(0, Number(row?.gold || 0) | 0),
    items: Array.isArray(row?.items) ? row.items : [],
  }));
}

/**
 * @param {{ world: import("../../lib/ecs-js/index.js").World }} deps
 */
export function installMailboxWiring({ world }) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  let _phone = readStoredPhone();
  let _busy = false;
  let _lastInbox = [];
  let _lastOutbox = [];

  function playerId() {
    return Number(playerEntity(world)?.id || 0) | 0;
  }

  function publish(extra = {}) {
    const actorId = playerId();
    uiEvent("ui:mailboxData", {
      phone: _phone,
      needsPhone: !_phone,
      busy: _busy,
      inbox: _lastInbox,
      outbox: _lastOutbox,
      inventory: actorId > 0 ? inventoryPayload(world, actorId) : { items: [], gold: 0 },
      ...extra,
    });
  }

  async function refresh() {
    if (!_phone) {
      publish();
      return;
    }
    _busy = true;
    publish();
    try {
      const [inbox, outbox] = await Promise.all([getInbox(_phone), getOutbox(_phone)]);
      _lastInbox = normalizeMailRows(inbox?.mail);
      _lastOutbox = normalizeMailRows(outbox?.mail);
      publish();
    } catch (err) {
      publish({ error: String(err?.message || err) });
    } finally {
      _busy = false;
      publish();
    }
  }

  world.on(MailboxOpenRequested, ({ actor }) => {
    const id = Number(actor || 0) | 0;
    if (!(id > 0) || !world.has(id, Player)) return;
    uiEvent("ui:openMailbox");
    publish();
    refresh();
  });

  globalThis.addEventListener?.("ui:mailboxPhoneSubmit", (ev) => {
    _phone = writeStoredPhone(ev?.detail?.phone);
    uiEvent("ui:openMailbox");
    publish();
    refresh();
  });

  globalThis.addEventListener?.("ui:mailboxForgetPhone", () => {
    forgetStoredPhone();
    _phone = "";
    _lastInbox = [];
    _lastOutbox = [];
    publish();
  });

  globalThis.addEventListener?.("ui:mailboxRefresh", () => {
    refresh();
  });

  globalThis.addEventListener?.("ui:mailboxOpenMessage", (ev) => {
    const id = String(ev?.detail?.id || "");
    if (!id) return;
    openMail(id).then(refresh).catch((err) => publish({ error: String(err?.message || err) }));
  });

  globalThis.addEventListener?.("ui:mailboxSend", (ev) => {
    const actorId = playerId();
    const detail = ev?.detail || {};
    const toPhone = canonicalMailPhone(detail.toPhone);
    const fromPhone = _phone;
    const gold = Math.max(0, Number(detail.gold || 0) | 0);
    const itemIds = Array.isArray(detail.itemIds)
      ? detail.itemIds.map((id) => Number(id || 0) | 0).filter((id) => id > 0)
      : [];
    if (!(actorId > 0) || !fromPhone || !toPhone) {
      publish({ error: "Mailbox needs both phone numbers." });
      return;
    }
    const availableGold = inventoryPayload(world, actorId).gold;
    if (gold > availableGold) {
      publish({ error: "You do not have that much gold." });
      return;
    }
    const attachments = [];
    for (const itemId of itemIds) {
      if (!inventoryItems(world, actorId).includes(itemId)) continue;
      const snap = buildItemSnapshot(world, itemId);
      if (snap) attachments.push(snap);
    }
    _busy = true;
    publish();
    sendMail({
      toPhone,
      fromPhone,
      subject: String(detail.subject || "JSHack mail").slice(0, 120),
      body: String(detail.body || "").slice(0, 4000),
      gold,
      items: attachments,
    }).then(() => {
      if (gold > 0) {
        const consumed = consumeFromStack(world, actorId, "gold", gold);
        for (const id of consumed.entities) {
          try { destroySubtree(world, id); } catch { try { world.destroy(id); } catch {} }
        }
      }
      for (const itemId of itemIds) {
        if (!inventoryItems(world, actorId).includes(itemId)) continue;
        removeFromInventory(world, actorId, itemId);
        try { destroySubtree(world, itemId); } catch { try { world.destroy(itemId); } catch {} }
      }
      publish({ notice: "Mail sent." });
      refresh();
    }).catch((err) => {
      publish({ error: String(err?.message || err) });
    }).finally(() => {
      _busy = false;
      publish();
    });
  });

  globalThis.addEventListener?.("ui:mailboxClaim", (ev) => {
    const actorId = playerId();
    const id = String(ev?.detail?.id || "");
    if (!(actorId > 0) || !id) return;
    _busy = true;
    publish();
    claimMail(id).then((result) => {
      const gold = Math.max(0, Number(result?.gold || 0) | 0);
      if (gold > 0) {
        const goldId = createItemById(world, "gold", { count: gold });
        if (goldId > 0) addToInventory(world, actorId, goldId);
      }
      let restored = 0;
      for (const item of Array.isArray(result?.items) ? result.items : []) {
        if (restoreItemSnapshot(world, item, actorId) > 0) restored++;
      }
      publish({ notice: `Claimed ${gold} gold${restored ? ` and ${restored} item${restored === 1 ? "" : "s"}` : ""}.` });
      refresh();
    }).catch((err) => {
      publish({ error: String(err?.message || err) });
    }).finally(() => {
      _busy = false;
      publish();
    });
  });
}
