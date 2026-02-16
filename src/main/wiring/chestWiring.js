import { Equipment } from "../../rules/components/Equipment.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { applySnapshot, serializeEntities } from "../../lib/ecs-js/serialization.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import {
  addItemEntityToInventory,
  findInventoryStackTargetForItem,
} from "../../rules/utils/inventoryStacking.js";

const INSTALLED = Symbol.for("jshack:main:chestWiring:installed");
const CHESTS_KEY = "jshack:chests:v1";
const LEGACY_STASH_KEY_V2 = "jshack:home:stash:v2";
const LEGACY_STASH_KEY_V1 = "jshack:home:stash:v1";

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({id:number,pos:{x:number,y:number}}|null),
 *   log: (msg: string) => void,
 *   bracketizeName: (s: string) => string,
 * }} opts
 */
export function installChestWiring({ world, playerEntity, log, bracketizeName }) {
  if (!world || typeof playerEntity !== "function" || typeof log !== "function" || typeof bracketizeName !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  function currentDepth() {
    for (const [, ds] of world.query(DungeonState)) {
      return Number(ds?.currentDepth || 0) | 0;
    }
    return 0;
  }

  /**
   * @param {number} chestId
   * @returns {string|null}
   */
  function chestStorageKey(chestId) {
    const pos = world.get(chestId, Position);
    if (!pos) return null;
    return `${currentDepth()}:${pos.x},${pos.y}`;
  }

  function readChestStore() {
    try {
      const raw = localStorage.getItem(CHESTS_KEY);
      if (!raw) return { v: 1, chests: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || typeof parsed.chests !== "object" || !parsed.chests) {
        return { v: 1, chests: {} };
      }
      return parsed;
    } catch {
      return { v: 1, chests: {} };
    }
  }

  /**
   * @param {{ v:1, chests:Record<string, any> }} store
   */
  function writeChestStore(store) {
    try { localStorage.setItem(CHESTS_KEY, JSON.stringify(store)); } catch {}
  }

  /**
   * @param {number} chestId
   * @returns {any|null}
   */
  function readLegacyStashPayload(chestId) {
    const ni = world.get(chestId, NamedIdentity);
    if (!ni || ni.name !== "Stash Chest") return null;
    let raw = null;
    try {
      raw = localStorage.getItem(LEGACY_STASH_KEY_V2);
      if (!raw) raw = localStorage.getItem(LEGACY_STASH_KEY_V1);
    } catch {}
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  /**
   * @param {number} chestId
   * @returns {any|null}
   */
  function getChestPayload(chestId) {
    const key = chestStorageKey(chestId);
    if (!key) return null;
    const store = readChestStore();
    if (store.chests[key]) return store.chests[key];

    // One-way migration path from previous dedicated stash key.
    const legacy = readLegacyStashPayload(chestId);
    if (!legacy) return null;
    store.chests[key] = legacy;
    writeChestStore(store);
    return legacy;
  }

  /**
   * @param {number} chestId
   * @param {any} payload
   */
  function setChestPayload(chestId, payload) {
    const key = chestStorageKey(chestId);
    if (!key) return;
    const store = readChestStore();
    store.chests[key] = payload;
    writeChestStore(store);
  }

  /**
   * Build a runtime component registry for snapshot restore.
   * @returns {Map<string, any>}
   */
  function buildSnapshotRegistry() {
    const reg = new Map();
    for (const [, store] of world._store) {
      const comp = store?._comp;
      if (!comp || typeof comp.name !== "string" || !comp.name) continue;
      reg.set(comp.name, comp);
    }
    return reg;
  }

  /**
   * @param {number} chestId
   * @returns {{ v:2, order:number[], snapshot:any }}
   */
  function serializeChestSnapshot(chestId) {
    const inv = world.get(chestId, Inventory);
    const order = (inv?.items || []).filter((id) => Number.isInteger(id) && id > 0 && world.isAlive(id));
    return {
      v: 2,
      order,
      snapshot: serializeEntities(world, order, { note: "chest_inventory" }),
    };
  }

  /** @param {number} chestId */
  function persistChest(chestId) {
    setChestPayload(chestId, serializeChestSnapshot(chestId));
  }

  /**
   * @param {number} chestId
   * @param {{ v?:number, order?:number[], snapshot?:any }} parsed
   * @returns {boolean}
   */
  function hydrateSnapshotPayload(chestId, parsed) {
    if (!parsed || parsed.v !== 2) return false;
    const snap = parsed.snapshot;
    if (!snap || typeof snap !== "object" || snap.v !== 1 || !snap.comps) return false;

    const inv = world.get(chestId, Inventory);
    if (!inv || !Array.isArray(inv.items)) return false;
    if (inv.items.length > 0) return true;

    /** @type {Map<number, number>} */
    const oldToNew = new Map();
    const prevTime = +world.time || 0;
    const prevFrame = world.frame | 0;
    try {
      applySnapshot(world, snap, buildSnapshotRegistry(), {
        mode: "append",
        skipUnknown: true,
        remapId(oldId) {
          const id = world.create();
          oldToNew.set(oldId, id);
          return id;
        },
      });
      world.time = prevTime;
      world.frame = prevFrame;
    } catch {
      world.time = prevTime;
      world.frame = prevFrame;
      return false;
    }

    const desiredOrder = Array.isArray(parsed.order) && parsed.order.length
      ? parsed.order
      : (Array.isArray(snap.alive) ? snap.alive : []);
    for (const oldId of desiredOrder) {
      const itemId = oldToNew.get(Number(oldId) | 0) || 0;
      if (!(itemId > 0) || !world.isAlive(itemId)) continue;
      if (!inv.items.includes(itemId)) inv.items.push(itemId);
    }
    return true;
  }

  /**
   * @param {number} chestId
   * @param {{ forceFromStorage?: boolean }} [opts]
   */
  function hydrateChest(chestId, opts = {}) {
    const inv = world.get(chestId, Inventory);
    if (!inv || !Array.isArray(inv.items)) return;
    const forceFromStorage = opts.forceFromStorage === true;
    if (!forceFromStorage && inv.items.length > 0) return; // already hydrated in current session

    /** @type {{ v?:number, order?:number[], snapshot?:any, items?:Array<{identity?:string,count?:number,affixes?:string[]}> }|null} */
    const parsed = getChestPayload(chestId);
    if (!parsed) return;

    if (forceFromStorage) inv.items.length = 0;

    if (hydrateSnapshotPayload(chestId, parsed)) {
      persistChest(chestId);
      return;
    }

    if (!Array.isArray(parsed.items)) return;

    for (const row of parsed.items) {
      const identity = String(row?.identity || "");
      if (!identity) continue;
      const count = Math.max(1, Number(row?.count || 1) | 0);
      const affixes = Array.isArray(row?.affixes) ? row.affixes : [];
      const itemId = createItemById(world, identity, { count, affixes });
      if (!(itemId > 0)) continue;
      addItemEntityToInventory(world, inv, itemId, { removePosition: false, forceOwnStack: true, allowUnpaidStack: true });
    }
    persistChest(chestId);
  }

  function buildChestItemDetail(id) {
    const info = world.get(id, ItemInfo);
    const name = world.get(id, NamedIdentity);
    if (!info) return null;
    return {
      id,
      name: name?.name || info.description || info.type || "item",
      type: info.type,
      slot: info.slot,
      count: info.count || 1,
      rarityName: info.rarityName || "common",
      description: info.description || "",
      bonuses: info.bonuses || {},
      affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
    };
  }

  function dispatchChestData(chestId) {
    const inv = world.get(chestId, Inventory);
    if (!inv) return;
    const chestItems = [];
    for (const id of (inv.items || [])) {
      const detail = buildChestItemDetail(id);
      if (detail) chestItems.push(detail);
    }
    const pe = playerEntity(world);
    const playerItems = [];
    if (pe) {
      const playerInv = world.get(pe.id, Inventory);
      if (playerInv) {
        for (const id of playerInv.items) {
          const info = world.get(id, ItemInfo);
          if (!info || info.type === "currency") continue;
          const name = world.get(id, NamedIdentity);
          playerItems.push({
            id,
            name: name?.name || info.description || info.type || "item",
            type: info.type,
            slot: info.slot,
            count: info.count || 1,
            rarityName: info.rarityName || "common",
            description: info.description || "",
          });
        }
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("ui:chestData", { detail: {
        chestId, chestItems, playerItems,
      } }));
    } catch {}
  }

  function refreshInventoryUi() {
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
    try { window.dispatchEvent(new CustomEvent("ui:requestUsableItemsData")); } catch {}
  }

  world.on("chest:open", ({ targetId }) => {
    const chestId = Number(targetId || 0) | 0;
    if (!(chestId > 0)) return;
    log("You open the chest.");
    try { window.dispatchEvent(new CustomEvent("ui:openChest", { detail: { chestId } })); } catch {}
    // Run hydrate/render after tick flush so deferred ECS writes are visible.
    setTimeout(() => {
      hydrateChest(chestId, { forceFromStorage: true });
      dispatchChestData(chestId);
    }, 0);
  });

  addEventListener("ui:requestChestTake", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const chestId = Number(e?.detail?.chestId || 0) | 0;
    const itemId = Number(e?.detail?.itemId || 0) | 0;
    const pe = playerEntity(world);
    if (!pe) return;

    const chestInv = world.get(chestId, Inventory);
    if (!chestInv) return;

    const idx = chestInv.items.indexOf(itemId);
    if (idx === -1) return;

    const playerInv = world.get(pe.id, Inventory);
    const stackIntoId = playerInv ? findInventoryStackTargetForItem(world, playerInv, itemId) : 0;
    const needsSlot = playerInv ? (!stackIntoId && !playerInv.items.includes(itemId)) : false;
    if (playerInv && playerInv.capacity != null && playerInv.items.length >= playerInv.capacity && needsSlot) {
      log("Your inventory is full.");
      return;
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";

    chestInv.items.splice(idx, 1);
    if (playerInv) {
      addItemEntityToInventory(world, playerInv, itemId);
    }

    log(`You take ${bracketizeName(itemName)} from the chest.`);
    persistChest(chestId);

    dispatchChestData(chestId);
    refreshInventoryUi();
  });

  addEventListener("ui:requestChestPut", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const chestId = Number(e?.detail?.chestId || 0) | 0;
    const itemId = Number(e?.detail?.itemId || 0) | 0;
    const pe = playerEntity(world);
    if (!pe) return;

    const chestInv = world.get(chestId, Inventory);
    if (!chestInv) return;
    const info = world.get(itemId, ItemInfo);
    if (!info || !world.isAlive(itemId)) return;

    const stackIntoId = findInventoryStackTargetForItem(world, chestInv, itemId, { allowUnpaidStack: true });
    const needsSlot = !stackIntoId && !chestInv.items.includes(itemId);
    if (chestInv.capacity != null && chestInv.items.length >= chestInv.capacity && needsSlot) {
      log("The chest is full.");
      return;
    }

    const playerInv = world.get(pe.id, Inventory);
    let ownedByPlayer = false;
    if (playerInv) {
      const idx = playerInv.items.indexOf(itemId);
      if (idx !== -1) {
        playerInv.items.splice(idx, 1);
        ownedByPlayer = true;
      }
    }

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo"]) {
        if (eq[slot] === itemId) {
          eq[slot] = null;
          ownedByPlayer = true;
          break;
        }
      }
    }
    if (!ownedByPlayer) {
      log("You don't seem to be carrying that.");
      return;
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    addItemEntityToInventory(world, chestInv, itemId, { allowUnpaidStack: true });
    log(`You put ${bracketizeName(itemName)} in the chest.`);
    persistChest(chestId);

    dispatchChestData(chestId);
    refreshInventoryUi();
  });
}
