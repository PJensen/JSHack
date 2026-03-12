export const TOWN_DISTRICT_DEFS = Object.freeze([
  Object.freeze({
    key: "civic_core",
    label: "Civic Core",
    anchorIdentity: "house_sign",
    offsetX: 5,
    offsetY: -4,
    radius: 11,
    tags: Object.freeze(["civic", "residential"]),
  }),
  Object.freeze({
    key: "market_green",
    label: "Market Green",
    anchorIdentity: "tavern_sign",
    offsetX: -2,
    offsetY: 2,
    radius: 10,
    tags: Object.freeze(["market", "food", "rumor"]),
  }),
  Object.freeze({
    key: "workshop_row",
    label: "Workshop Row",
    anchorIdentity: "smithy_sign",
    offsetX: -1,
    offsetY: -1,
    radius: 10,
    tags: Object.freeze(["craft", "industry", "repair"]),
  }),
  Object.freeze({
    key: "churchyard",
    label: "Churchyard",
    anchorIdentity: "church_sign",
    offsetX: -1,
    offsetY: -6,
    radius: 10,
    tags: Object.freeze(["temple", "graveyard", "ritual"]),
  }),
]);

export function getTownDistrictDef(key) {
  return TOWN_DISTRICT_DEFS.find((entry) => entry.key === key) || null;
}
