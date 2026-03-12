export const TOWN_ENTRANCE_DEFS = Object.freeze([
  Object.freeze({
    key: "town",
    label: "Town",
    tags: Object.freeze(["civic", "sewers", "cellars"]),
    laborDemand: Object.freeze(["sanitation", "masonry", "watch"]),
    districtEffects: Object.freeze(["drains_unsteady", "cellar_fear_up"]),
    radius: 18,
    factionControl: "civic",
  }),
  Object.freeze({
    key: "graveyard",
    label: "Graveyard",
    tags: Object.freeze(["burial", "temple", "necrotic"]),
    laborDemand: Object.freeze(["burial", "warding", "incense"]),
    districtEffects: Object.freeze(["mourner_traffic_up", "night_fear_up"]),
    radius: 14,
    factionControl: "temple",
  }),
]);

export function getTownEntranceDef(key) {
  return TOWN_ENTRANCE_DEFS.find((entry) => entry.key === key) || null;
}
