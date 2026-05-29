import { getAllMonsters } from "../../rules/data/monsters.js";

const POLYMORPH_FEATURED_TARGETS = Object.freeze([
  { id: "rat", role: "Safe control", note: "Small, fragile, low threat." },
  { id: "bat", role: "Safe control", note: "Fragile flyer, easy to finish." },
  { id: "lichen", role: "Safe control", note: "Nearly harmless body." },
  { id: "shrieker", role: "Disruptive", note: "Weak plant form with noise risk." },
  { id: "floating_eye", role: "Disruptive", note: "Dangerous gaze, weak body." },
  { id: "rust_monster", role: "Dangerous utility", note: "Can destroy equipment if mishandled." },
  { id: "cockatrice", role: "Dangerous utility", note: "High-risk petrification form." },
  { id: "dragon_whelp", role: "Gamble", note: "Powerful form, not crowd control." },
]);

const ROLE_BY_TAG = Object.freeze({
  caster: "Caster",
  venomous: "Venomous",
  undead: "Undead",
  beast: "Beast",
  humanoid: "Humanoid",
  aberration: "Aberration",
  plant: "Plant",
  giant: "Giant",
  draconic: "Draconic",
});

function firstRoleFor(def) {
  const tags = Array.isArray(def?.tags) ? def.tags : [];
  for (const tag of tags) {
    if (ROLE_BY_TAG[tag]) return ROLE_BY_TAG[tag];
  }
  return "Creature";
}

function dangerLabel(def) {
  const tags = Array.isArray(def?.tags) ? def.tags : [];
  const tier = Number(def?.tier || 0);
  if (tags.includes("rare") || tags.includes("draconic") || tags.includes("giant") || tier >= 4) return "high";
  if (tags.includes("caster") || tags.includes("venomous") || tags.includes("aberration") || tier >= 2) return "medium";
  return "low";
}

function sortByName(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""));
}

/**
 * Build display-safe monster choices. This is intentionally a main-layer DTO
 * boundary: display renders rows, while future legality/policy work can alter
 * which rows are enabled and why without importing rules into display.
 *
 * @param {{ currentDepth?: number, featuredTargets?: Array<{id:string,role?:string,note?:string}> }} [opts]
 * @returns {Array<{id:string,name:string,role:string,note:string,tier:number,sizeClass:string,danger:string,tags:string[],featured:boolean,enabled:boolean}>}
 */
export function buildMonsterChoiceOptions(opts = {}) {
  const currentDepth = Math.max(1, Number(opts.currentDepth || 1) | 0);
  const featuredTargets = Array.isArray(opts.featuredTargets) ? opts.featuredTargets : [];
  const featuredById = new Map(featuredTargets.map((entry, index) => [entry.id, { ...entry, index }]));
  const rows = [];

  for (const def of getAllMonsters()) {
    if (!def || def.disabled) continue;
    const id = String(def.id || "");
    if (!id) continue;
    const featured = featuredById.get(id) || null;
    const tags = Array.isArray(def.tags) ? def.tags.map(String) : [];
    const minDepth = Math.max(1, Number(def.minDepth || 1) | 0);
    rows.push({
      id,
      name: String(def.name || id),
      role: featured?.role || firstRoleFor(def),
      note: featured?.note || (minDepth > currentDepth ? `Usually appears from depth ${minDepth}.` : String(def.description || "")),
      tier: Math.max(0, Number(def.tier || 0) | 0),
      sizeClass: String(def.sizeClass || "?"),
      danger: dangerLabel(def),
      tags,
      featured: Boolean(featured),
      enabled: true,
      _featuredIndex: featured?.index ?? 9999,
    });
  }

  rows.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.featured && b.featured) return a._featuredIndex - b._featuredIndex;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return sortByName(a, b);
  });

  return rows.map(({ _featuredIndex, ...row }) => row);
}

/** @param {{ currentDepth?: number }} [opts] */
export function buildPolymorphTargetOptions(opts = {}) {
  return buildMonsterChoiceOptions({
    ...opts,
    featuredTargets: POLYMORPH_FEATURED_TARGETS,
  });
}

