import { normalizeStatusEvent } from "../../../../shared/events/statusEvent.js";

const ALL_CAPS_DB_BY_SOURCE = Object.freeze({
  fountain: 84,
  shop: 78,
  home: 74,
});

export const BULLETIN_OPPORTUNITY_LABELS = Object.freeze({
  smith_repairs: "smith repairs posted",
  escort_work: "escort contracts posted",
  graveyard_watch: "graveyard watch requested",
  mason_repairs: "mason repairs posted",
});

export const BULLETIN_SHORTAGE_LABELS = Object.freeze({
  iron_and_lumber_short: "iron and lumber are short",
  bandages_and_stew_short: "bandages and stew are running short",
  incense_and_bandages_short: "incense and bandages are running short",
  repair_queue_growing: "the repair queue keeps growing",
  market_stalls_thinning: "market stalls are thinning out",
});

export const BULLETIN_SECTOR_LABELS = Object.freeze({
  smith_repairs: "smith repairs",
  escort_work: "escort work",
  incense_trade: "incense trade",
});

export const BULLETIN_RUMOR_LABELS = Object.freeze({
  the_old_crypt_is_not_quiet: "Rumor: the old crypt is not quiet.",
  watch_is_pulling_escorts_off_the_roads: "Rumor: the watch is pulling escorts off the roads.",
  smiths_are_hammering_air: "Rumor: the smiths are hammering air.",
});

const ingredientLabels = Object.freeze({
  berries: "berries",
  herbs: "herbs",
  thornPods: "thorn pods",
  venomFronds: "venom fronds",
  moonleaf: "moonleaf",
  emberRoot: "ember root",
});

export { normalizeStatusEvent };

/**
 * Build a shared context object from the installMessageWiring opts.
 * Every domain sub-installer receives this context.
 */
export function createMessageContext({
  world,
  messageLog,
  playerEntity,
  bracketizeName,
  getSpell,
  resolveItemDisplayName,
  isVisibleAt,
  components = {},
  soundApi = {},
}) {
  const {
    Equipment,
    ItemInfo,
    NamedIdentity,
    Owner,
    Pet,
    Player,
    Position,
    Devotion,
    Anatomy,
    DungeonState,
    Status,
  } = components || {};
  const evaluateSound = typeof soundApi.evaluateSound === "function" ? soundApi.evaluateSound : () => ({ audible: false, clarity: "barely", perceivedDb: -Infinity });
  const thresholdForTier = typeof soundApi.thresholdForTier === "function" ? soundApi.thresholdForTier : () => Number.POSITIVE_INFINITY;
  const HEARING_TIERS = (soundApi.HEARING_TIERS && typeof soundApi.HEARING_TIERS === "object")
    ? soundApi.HEARING_TIERS
    : { super: "super" };

  function log(text, type = 'default') {
    if (typeof text === 'object' && text.text) {
      messageLog.log(text);
    } else {
      messageLog.log({ text: String(text), type });
    }
  }

  const compGet = (id, comp) => (comp ? world.get(Number(id || 0), comp) : null);
  const compHas = (id, comp) => (comp ? world.has(Number(id || 0), comp) : false);
  const canSeeAt = (x, y) => (
    Number.isFinite(Number(x))
    && Number.isFinite(Number(y))
    && (typeof isVisibleAt !== "function" || !!isVisibleAt(Number(x), Number(y)))
  );

  function formatBulletinDistrictLine(bulletin) {
    const label = String(bulletin?.label || "District");
    const fragments = [];
    for (const tag of bulletin?.opportunities || []) {
      if (BULLETIN_OPPORTUNITY_LABELS[tag]) fragments.push(BULLETIN_OPPORTUNITY_LABELS[tag]);
    }
    for (const tag of bulletin?.shortages || []) {
      if (BULLETIN_SHORTAGE_LABELS[tag]) fragments.push(BULLETIN_SHORTAGE_LABELS[tag]);
    }
    if (!fragments.length) return `${label}: quiet for now.`;
    return `${label}: ${fragments.join("; ")}.`;
  }

  function formatBulletinRumors(districts) {
    for (const bulletin of Array.isArray(districts) ? districts : []) {
      for (const rumor of bulletin?.rumors || []) {
        if (BULLETIN_RUMOR_LABELS[rumor]) return BULLETIN_RUMOR_LABELS[rumor];
      }
    }
    return "";
  }

  // ── Rarity / tier colors for rich text ──
  const _rarityColors = {
    common: '#ddd', uncommon: '#1eff00', rare: '#55aaff',
    magic: '#55aaff', epic: '#c47bff', legendary: '#ff9f3b',
  };
  const _monsterColors = { rare: '#ff9f3b', elite: '#c47bff' };
  const _spellColor = '#79c0ff';

  /**
   * Format an entity (item OR monster) as rich { text, html } with color + tooltip hook.
   * Falls back to plain bracketized name if no special data found.
   */
  function richEntity(id) {
    const n = Number(id || 0);
    if (!(n > 0)) return null;
    const ni = compGet(n, NamedIdentity);
    const name = ni?.name;
    if (!name) return null;
    const text = bracketizeName(name);

    // Item path — has ItemInfo with rarity
    const info = ItemInfo ? compGet(n, ItemInfo) : null;
    if (info) {
      const rn = String(info.rarityName || 'common').toLowerCase();
      const color = _rarityColors[rn] || '#ddd';
      const html = `<b style="color:${color}" data-entity-id="${n}" data-tip="item">${text}</b>`;
      return { text, html };
    }

    // Monster / creature path — check identity for rare tag
    const identity = String(ni?.identity || '');
    const isRare = identity && (ni?.tags?.includes?.('rare') || ni?.tags?.includes?.('elite'));
    if (isRare) {
      const color = ni?.tags?.includes?.('elite') ? _monsterColors.elite : _monsterColors.rare;
      const html = `<b style="color:${color}" data-entity-id="${n}" data-tip="monster">${text}</b>`;
      return { text, html };
    }

    // Default entity — white bold with tooltip hook
    const html = `<b data-entity-id="${n}" data-tip="entity">${text}</b>`;
    return { text, html };
  }

  /**
   * Format a spell/ability name as rich { text, html }.
   */
  function richSpell(spellId) {
    const label = spellLabel(spellId);
    const text = bracketizeName(label);
    const html = `<b style="color:${_spellColor}" data-tip="spell" data-spell-id="${String(spellId || '')}">${text}</b>`;
    return { text, html };
  }

  /**
   * Format a named label (affix, gear proc, etc.) with a specific color.
   */
  function richLabel(name, color) {
    const text = bracketizeName(name);
    const html = `<b style="color:${color || '#ddd'}">${text}</b>`;
    return { text, html };
  }

  function nameOfEntity(id) {
    const pe = playerEntity(world);
    const playerId = pe?.id || 0;
    const n = Number(id || 0);
    if (playerId && n === playerId) return 'You';
    const ni = compGet(n, NamedIdentity);
    const label = ni?.name;
    return label ? bracketizeName(label) : `Entity ${n}`;
  }

  function favoredDeityIdForPlayer(playerId) {
    const actorId = Number(playerId || 0) | 0;
    if (!(actorId > 0) || !Devotion) return "";
    const dev = compGet(actorId, Devotion);
    return String(dev?.deityId || "");
  }

  function isFavoredDeityForPlayer(playerId, deityId) {
    const did = String(deityId || "");
    if (!did) return true;
    const favored = favoredDeityIdForPlayer(playerId);
    if (!favored) return true;
    return favored === did;
  }

  function hasNamedEntity(id) {
    const n = Number(id || 0);
    if (!(n > 0)) return false;
    if (compHas(n, Player)) return true;
    const ni = compGet(n, NamedIdentity);
    return !!(ni?.name || ni?.identity);
  }

  function burnVerb(who) {
    return who === 'You' ? 'burn' : 'burns';
  }

  function nameOfItem(id) {
    const n = Number(id || 0);
    const label = typeof resolveItemDisplayName === "function"
      ? resolveItemDisplayName(world, n)
      : "";
    return label ? bracketizeName(label) : `item ${n}`;
  }

  function spellLabel(spellId) {
    const id = String(spellId || "").trim();
    if (!id) return "spell";
    const spell = typeof getSpell === "function" ? getSpell(id) : null;
    if (spell?.name) return String(spell.name);
    return id.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function formatIngredientBag(rec, { includeZero = false } = {}) {
    const src = (rec && typeof rec === "object") ? rec : {};
    const parts = [];
    for (const key of Object.keys(ingredientLabels)) {
      const n = Math.max(0, Number(src[key] || 0) | 0);
      if (!includeZero && n <= 0) continue;
      parts.push(`${n} ${ingredientLabels[key]}`);
    }
    return parts.join(", ");
  }

  function harvestYieldLabel(kind) {
    const k = String(kind || "").toLowerCase();
    if (k === "herbs") return "herbs";
    if (k === "thorn_bramble") return "thorn pods";
    if (k === "venom_fern") return "venom fronds";
    if (k === "moonleaf") return "moonleaf";
    if (k === "ember_root") return "ember roots";
    if (k === "mushrooms") return "mushrooms";
    if (k === "iron_ore") return "iron ore";
    if (k === "coal_ore") return "coal";
    if (k === "stone") return "stone chips";
    if (k === "wheat") return "wheat";
    if (k === "carrot") return "carrots";
    if (k === "corn") return "corn";
    if (k === "tree") return "wood";
    return "berries";
  }

  function harvestNodeLabel(kind) {
    const k = String(kind || "").toLowerCase();
    if (k === "herbs") return "herb patch";
    if (k === "thorn_bramble") return "thorn bramble";
    if (k === "venom_fern") return "venom fern";
    if (k === "moonleaf") return "moonleaf cluster";
    if (k === "ember_root") return "ember root patch";
    if (k === "mushrooms") return "mushroom patch";
    if (k === "iron_ore") return "iron vein";
    if (k === "coal_ore") return "coal seam";
    if (k === "stone") return "stone outcrop";
    if (k === "wheat") return "wheat";
    if (k === "carrot") return "carrot plant";
    if (k === "corn") return "corn stalk";
    if (k === "tree") return "tree";
    return "berry bush";
  }

  function isOreKind(kind) {
    const k = String(kind || "").toLowerCase();
    return k === "iron_ore" || k === "coal_ore" || k === "stone";
  }

  function currentDepth() {
    if (!DungeonState) return 0;
    for (const [, ds] of world.query(DungeonState)) {
      const depth = Number(ds?.currentDepth);
      return Number.isFinite(depth) ? (depth | 0) : 0;
    }
    return 0;
  }

  function currentHearingThreshold() {
    const pe = playerEntity(world);
    if (!pe?.id) return thresholdForTier(HEARING_TIERS.super);
    const status = compGet(pe.id, Status);
    const deafened = status?.statuses?.find((s) => s.type === 'deafened');
    if (deafened) {
      try { return thresholdForTier(HEARING_TIERS.deaf || 'deaf'); } catch { return Number.POSITIVE_INFINITY; }
    }
    const anatomy = compGet(pe.id, Anatomy);
    const tier = String(anatomy?.hearing || HEARING_TIERS.super).toLowerCase();
    try {
      return thresholdForTier(tier);
    } catch (_err) {
      return thresholdForTier(HEARING_TIERS.super);
    }
  }

  function pickFirstString(rec, keys) {
    if (!rec || typeof rec !== "object") return "";
    for (const key of keys) {
      const value = rec[key];
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return "";
  }

  function textForClarity(rec, clarity) {
    if (clarity === "crystal") return pickFirstString(rec, ["near", "crystal", "mid", "clear", "far", "faint", "barely"]);
    if (clarity === "clear") return pickFirstString(rec, ["mid", "clear", "near", "crystal", "far", "faint", "barely"]);
    if (clarity === "faint") return pickFirstString(rec, ["far", "faint", "mid", "clear", "near", "crystal", "barely"]);
    if (clarity === "barely") return pickFirstString(rec, ["far", "barely", "faint", "mid", "clear", "near", "crystal"]);
    return "";
  }

  function resolveAmbientSoundText(ev) {
    const pe = playerEntity(world);
    if (!pe?.pos) return null;

    const soundDepth = Number(ev?.depth);
    if (!Number.isFinite(soundDepth) || (soundDepth | 0) !== currentDepth()) return null;

    const at = ev?.at;
    if (!at || !Number.isFinite(Number(at.x)) || !Number.isFinite(Number(at.y))) return null;

    const sourceDbAt1Tile = Number(ev?.sourceDbAt1Tile);
    if (!Number.isFinite(sourceDbAt1Tile)) return null;

    const hearingThresholdDbHL = currentHearingThreshold();
    const evalResult = evaluateSound({
      origin: { x: pe.pos.x, y: pe.pos.y },
      source: { x: Number(at.x) | 0, y: Number(at.y) | 0 },
      sourceDbAt1Tile,
      hearingThresholdDbHL,
    });
    if (!evalResult.audible) return null;

    const text = textForClarity(ev?.clarity, evalResult.clarity);
    if (!text) return null;

    const source = String(ev?.source || "").toLowerCase();
    const allCapsAtDb = Number(ALL_CAPS_DB_BY_SOURCE[source]);
    if (Number.isFinite(allCapsAtDb) && evalResult.perceivedDb >= allCapsAtDb) {
      return text.toUpperCase();
    }
    return text;
  }

  return {
    world,
    messageLog,
    playerEntity,
    bracketizeName,
    getSpell,
    resolveItemDisplayName,
    log,
    compGet,
    compHas,
    canSeeAt,
    nameOfEntity,
    nameOfItem,
    richEntity,
    richSpell,
    richLabel,
    spellLabel,
    hasNamedEntity,
    burnVerb,
    favoredDeityIdForPlayer,
    isFavoredDeityForPlayer,
    formatBulletinDistrictLine,
    formatBulletinRumors,
    formatIngredientBag,
    harvestYieldLabel,
    harvestNodeLabel,
    isOreKind,
    resolveAmbientSoundText,
    normalizeStatusEvent,
    // Constants exposed for domain installers
    BULLETIN_SECTOR_LABELS,
    // Components exposed for domain installers that need them
    Equipment,
    ItemInfo,
    NamedIdentity,
    Owner,
    Pet,
    Player,
    Position,
    Devotion,
    Status,
  };
}
