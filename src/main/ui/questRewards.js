import { getCatalogItem } from "../../rules/data/itemCatalog.js";

/**
 * @param {any} questDef
 * @param {any} vars
 * @returns {string[]}
 */
export function listQuestRewardItemIds(questDef, vars) {
  const raw = Array.isArray(vars?.rewardItemIds)
    ? vars.rewardItemIds
    : (Array.isArray(questDef?.journal?.rewardItemIds) ? questDef.journal.rewardItemIds : []);
  return raw.map((id) => String(id || "").trim()).filter(Boolean);
}

/**
 * @param {string} itemId
 * @returns {{ itemId:string, name:string, description:string }}
 */
export function describeQuestRewardItem(itemId) {
  const id = String(itemId || "").trim();
  const def = id ? getCatalogItem(id) : null;
  const name = String(def?.name || id || "Reward").trim();
  const description = String(def?.description || "").trim();
  return { itemId: id, name, description };
}

/**
 * Compact single-line text for HUD surfaces.
 * @param {any} questDef
 * @param {any} vars
 * @returns {string}
 */
export function questRewardPreviewText(questDef, vars) {
  const items = listQuestRewardItemIds(questDef, vars).map(describeQuestRewardItem);
  if (items.length <= 0) return String(vars?.rewardText || questDef?.journal?.rewardText || "").trim();
  if (items.length === 1) {
    const item = items[0];
    return item.description ? `${item.name} - ${item.description}` : item.name;
  }
  return `Choose one: ${items.map((item) => item.name).join(", ")}`;
}

/**
 * Richer reward text for quest journal surfaces.
 * @param {any} questDef
 * @param {any} vars
 * @returns {string}
 */
export function questRewardDetailText(questDef, vars) {
  const parts = [];
  for (const item of listQuestRewardItemIds(questDef, vars).map(describeQuestRewardItem)) {
    parts.push(item.description ? `${item.name} - ${item.description}` : item.name);
  }

  const rewardGold = Math.max(0, Number(vars?.rewardGold || 0) | 0);
  if (rewardGold > 0) parts.push(`${rewardGold} gold`);

  const rewardItems = Array.isArray(questDef?.journal?.rewardItems)
    ? questDef.journal.rewardItems
    : [];
  const itemNames = new Set(listQuestRewardItemIds(questDef, vars)
    .map(describeQuestRewardItem)
    .map((item) => item.name.toLowerCase()));
  for (const item of rewardItems) {
    const label = String(item?.label || "").trim();
    if (!label) continue;
    if (itemNames.has(label.toLowerCase())) continue;
    const count = Math.max(1, Number(item?.count || 1) | 0);
    parts.push(count > 1 ? `${count}x ${label}` : label);
  }

  const explicit = String(vars?.rewardText || questDef?.journal?.rewardText || "").trim();
  if (parts.length <= 0 && explicit) return explicit;
  if (parts.length > 0) return parts.join(" and ");
  return "No reward recorded.";
}
