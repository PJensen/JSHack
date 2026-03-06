function stableStringify(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function normalizeEntityIds(item) {
  const raw = Array.isArray(item?.entityIds) ? item.entityIds : [item?.id];
  const ids = [];
  for (const id of raw) {
    const n = Number(id || 0) | 0;
    if (n > 0 && !ids.includes(n)) ids.push(n);
  }
  return ids;
}

const GROUP_SKIP_KEYS = new Set([
  "id",
  "count",
  "entityIds",
  "value",
  "price",
  "buyPrice",
  "sellPrice",
  "unpaidPrice",
]);

const SUM_KEYS = Object.freeze([
  "value",
  "price",
  "buyPrice",
  "sellPrice",
  "unpaidPrice",
]);

function buildGroupKey(item) {
  const keyData = {};
  for (const key of Object.keys(item || {})) {
    if (GROUP_SKIP_KEYS.has(key)) continue;
    keyData[key] = item[key];
  }
  return stableStringify(keyData);
}

/**
 * Coalesce visually identical UI items into one entry while preserving backing ids.
 *
 * @param {Array<Record<string, any>>} items
 * @returns {Array<Record<string, any>>}
 */
export function groupDisplayItems(items) {
  const groups = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== "object") continue;
    const entityIds = normalizeEntityIds(item);
    const key = buildGroupKey(item);
    const count = Math.max(1, Number(item.count || 0) | 0);
    let grouped = groups.get(key);
    if (!grouped) {
      grouped = {
        ...item,
        id: entityIds[0] || (Number(item.id || 0) | 0),
        count: 0,
        entityIds: [],
      };
      for (const sumKey of SUM_KEYS) {
        if (Number.isFinite(Number(item[sumKey]))) grouped[sumKey] = 0;
      }
      groups.set(key, grouped);
    }

    grouped.count += count;
    for (const id of entityIds) {
      if (!grouped.entityIds.includes(id)) grouped.entityIds.push(id);
    }
    for (const sumKey of SUM_KEYS) {
      if (!Number.isFinite(Number(item[sumKey]))) continue;
      grouped[sumKey] = Number(grouped[sumKey] || 0) + Number(item[sumKey] || 0);
    }
  }
  return Array.from(groups.values());
}

/**
 * @param {any} item
 * @returns {number[]}
 */
export function getGroupedEntityIds(item) {
  return normalizeEntityIds(item);
}
