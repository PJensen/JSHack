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

function stripInventoryLegacyFields(payload) {
  if (!payload || typeof payload !== "object") return payload;
  delete payload.items;
  delete payload.maxWeight;
  delete payload.weightLimit;
  return payload;
}

function stripShopLegacyFields(payload) {
  if (!payload || typeof payload !== "object") return payload;
  delete payload.items;
  return payload;
}

/**
 * Normalize legacy inventory snapshot payloads into the current hierarchy-first
 * runtime shape.
 *
 * - Renames `InventoryBag` rows to `InventoryRoot`
 * - Removes legacy Inventory payload fields (`items`, `maxWeight`, `weightLimit`)
 * - Removes legacy ShopInventory `items` payloads
 *
 * @param {any} snapshot
 * @returns {any}
 */
export function normalizeInventorySnapshot(snapshot) {
  if (!snapshot?.comps || typeof snapshot.comps !== "object") return snapshot;

  const out = clonePlain(snapshot);
  const comps = out.comps;

  if (Array.isArray(comps.InventoryBag) && comps.InventoryBag.length > 0) {
    if (Array.isArray(comps.InventoryRoot)) comps.InventoryRoot.push(...comps.InventoryBag);
    else comps.InventoryRoot = comps.InventoryBag;
    delete comps.InventoryBag;
  }

  if (Array.isArray(comps.Inventory)) {
    for (const row of comps.Inventory) stripInventoryLegacyFields(row?.[1]);
  }

  if (Array.isArray(comps.ShopInventory)) {
    for (const row of comps.ShopInventory) stripShopLegacyFields(row?.[1]);
  }

  return out;
}
