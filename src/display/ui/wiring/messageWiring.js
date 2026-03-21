import { normalizeStatusEvent } from "../../../shared/events/statusEvent.js";

const INSTALLED = Symbol.for("jshack:display:messageWiring:installed");
const ALL_CAPS_DB_BY_SOURCE = Object.freeze({
  fountain: 84,
  shop: 78,
  home: 74,
});

const BULLETIN_OPPORTUNITY_LABELS = Object.freeze({
  smith_repairs: "smith repairs posted",
  escort_work: "escort contracts posted",
  graveyard_watch: "graveyard watch requested",
  mason_repairs: "mason repairs posted",
});

const BULLETIN_SHORTAGE_LABELS = Object.freeze({
  iron_and_lumber_short: "iron and lumber are short",
  bandages_and_stew_short: "bandages and stew are running short",
  incense_and_bandages_short: "incense and bandages are running short",
  repair_queue_growing: "the repair queue keeps growing",
  market_stalls_thinning: "market stalls are thinning out",
});

const BULLETIN_SECTOR_LABELS = Object.freeze({
  smith_repairs: "smith repairs",
  escort_work: "escort work",
  incense_trade: "incense trade",
});

const BULLETIN_RUMOR_LABELS = Object.freeze({
  the_old_crypt_is_not_quiet: "Rumor: the old crypt is not quiet.",
  watch_is_pulling_escorts_off_the_roads: "Rumor: the watch is pulling escorts off the roads.",
  smiths_are_hammering_air: "Rumor: the smiths are hammering air.",
});

/**
 * Centralized message event handling
 * @param {{
 *   world: import("../../../lib/ecs-js/index.js").World,
 *   messageLog: { log: (msg: string | {text: string, type: string}) => void },
 *   playerEntity: (world: import("../../../lib/ecs-js/index.js").World) => ({id:number,pos:{x:number,y:number}}|null),
 *   bracketizeName: (s: string) => string,
 *   getSpell: (id: string) => any,
 *   resolveItemDisplayName: (world: any, id: number) => string,
 *   isVisibleAt?: (x:number, y:number) => boolean,
 *   components: {
 *     Equipment?: any, ItemInfo?: any, NamedIdentity?: any, Owner?: any, Pet?: any,
 *     Player?: any, Position?: any, Devotion?: any, Anatomy?: any, DungeonState?: any,
 *     Status?: any,
 *   },
 *   soundApi: {
 *     evaluateSound: Function,
 *     thresholdForTier: Function,
 *     HEARING_TIERS: Record<string, string>,
 *   },
 * }} opts
 */
export function installMessageWiring({
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
  if (!world || !messageLog || typeof playerEntity !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;
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

  /** Helper to log a message with type */
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

  /** Format helpers for message log */
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

  const ingredientLabels = Object.freeze({
    berries: "berries",
    herbs: "herbs",
    thornPods: "thorn pods",
    venomFronds: "venom fronds",
    moonleaf: "moonleaf",
    emberRoot: "ember root",
  });

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
    // Deafened status (from lightning or shock trap) overrides anatomy hearing
    const status = compGet(pe.id, Status);
    const deafened = status?.statuses?.find((s) => s.type === 'deafened');
    if (deafened) {
      // Treat the player as deaf — suppresses all hearing-dependent messages
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

  // === Ambient sound events ===
  world.on('ambient:sound', (ev) => {
    const text = resolveAmbientSoundText(ev);
    if (!text) return;
    log(text, 'ambient');
  });

  // === Item events ===
  world.on('drank', ({ actor, itemId, target, feel, identified }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target || actor);
    if (identified === false && feel) {
      if (who === 'You') {
        log(`You drink an unknown vial. ${feel}`, 'system');
      } else {
        log(`${who} drinks an unknown vial.`, 'system');
      }
      return;
    }
    const it = nameOfItem(itemId);
    if (tgt === 'You' && who === 'You') {
      log(`You drink ${it}.`, 'system');
    } else if (who === tgt) {
      log(`${who} drinks ${it}.`, 'system');
    } else {
      log(`${who} uses ${it} on ${tgt}.`, 'system');
    }
  });

  world.on('item:pickup', ({ actor, itemId, count }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== actor) {
      // Pet pickup
      const petName = nameOfEntity(actor);
      const it = nameOfItem(itemId);
      log(`${petName} picks up ${it}.`, 'system');
    }
  });

  world.on('item:transformed', ({ itemId, ownerId, scope, from, to, cause }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    if (scope !== 'inventory' || Number(ownerId || 0) !== pe.id) return;
    const fromLabel = bracketizeName(String(from?.name || nameOfItem(itemId)));
    const toLabel = bracketizeName(String(to?.name || 'something else'));
    if (String(cause || '') === 'burning') {
      log(`${fromLabel} in your pack burns into ${toLabel}.`, 'system');
      return;
    }
    log(`${fromLabel} in your pack transforms into ${toLabel}.`, 'system');
  });

  // === Spell events ===
  world.on('castSpell', ({ actor, spellId, targetId }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId || actor);
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? bracketizeName(s.name) : '[Spell]';
    if (who === 'You' && tgt === 'You') log(`You cast ${label}.`, 'system');
    else if (who === 'You') log(`You cast ${label} on ${tgt}.`, 'system');
    else if (tgt === 'You') log(`${who} casts ${label} on you.`, 'system');
    else log(`${who} casts ${label} on ${tgt}.`, 'system');
  });

  world.on('spell:not-known', ({ actor, spellId }) => {
    const who = nameOfEntity(actor);
    if (who === 'You') {
      log(`You don't know that spell${spellId ? ` [${spellId}]` : ''}.`, 'system');
      return;
    }
    log(`${who} tries to cast an unknown spell${spellId ? ` [${spellId}]` : ''}.`, 'system');
  });

  world.on('spell:unknown', ({ actor, spellId }) => {
    const who = nameOfEntity(actor);
    if (who === 'You') {
      log(`Unknown spell${spellId ? ` [${spellId}]` : ''}.`, 'system');
      return;
    }
    log(`${who} attempts an invalid spell${spellId ? ` [${spellId}]` : ''}.`, 'system');
  });

  world.on('spell:oom', ({ actor, spellId, need, have }) => {
    const who = nameOfEntity(actor);
    if (who === 'You') {
      log(`Not enough mana to cast [${String(spellId || 'spell')}] (need ${need}, have ${have}).`, 'system');
      return;
    }
    if (spellId) {
      log(`${who} lacks mana for [${String(spellId)}].`, 'system');
      return;
    }
    log(`${who} lacks mana to cast.`, 'system');
  });

  world.on('spell:fizzle', ({ actor, spellId, confused }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || 'spell')}]`;
    if (confused) {
      log(`You lose focus and ${label} fizzles.`, 'system');
      return;
    }
    log(`${label} fizzles.`, 'system');
  });

  world.on('spell:miscast', ({ actor, fromSpellId, toSpellId, confused }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const from = getSpell ? getSpell(String(fromSpellId || '')) : null;
    const to = getSpell ? getSpell(String(toSpellId || '')) : null;
    const fromLabel = from?.name ? `[${from.name}]` : `[${String(fromSpellId || 'spell')}]`;
    const toLabel = to?.name ? `[${to.name}]` : `[${String(toSpellId || 'spell')}]`;
    if (confused) {
      log(`Your confusion twists ${fromLabel} into ${toLabel}.`, 'system');
      return;
    }
    log(`${fromLabel} miscasts into ${toLabel}.`, 'system');
  });

  // === Channeling events ===
  world.on('channeling:start', ({ actor, spellId }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? bracketizeName(s.name) : '[Spell]';
    log(`You begin channeling ${label}...`, 'system');
  });

  world.on('channeling:tick', ({ actor, spellId, mode, turnsRemaining, turnsTotal }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (mode === 'sustain') return;
    const elapsed = Math.max(0, (turnsTotal || 0) - (turnsRemaining || 0));
    log(`Channeling... (${elapsed}/${turnsTotal || '?'})`, 'system');
  });

  world.on('channeling:cancelled', ({ actor, spellId, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'dead') {
      log('Channeling interrupted by death.', 'combat');
    } else if (reason === 'oom') {
      log('Your mana gives out and the channel collapses.', 'system');
    } else {
      log('Channeling interrupted.', 'system');
    }
  });

  world.on('intent:blocked', ({ actor, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'stunned') {
      log('You are stunned and can only wait.', 'system');
      return;
    }
    log('You cannot act right now.', 'system');
  });

  world.on('spell:smite', ({ actor, fizzle }) => {
    if (!fizzle) return;
    if (nameOfEntity(actor) !== 'You') return;
    log('Smite finds no target.', 'system');
  });

  world.on('spell:flash_heal', ({ actor, reason, amount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'full_health' || Number(amount || 0) <= 0) {
      log('Flash Heal has no effect; you are already at full health.', 'system');
    }
  });

  world.on('spell:heal', ({ actor, reason, amount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'full_health' || Number(amount || 0) <= 0) {
      log('Heal has no effect; target is already at full health.', 'system');
    }
  });

  world.on('spell:learned', ({ actor, spellId }) => {
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || 'spell')}]`;
    log(`You learn ${label}.`, 'system');
  });

  world.on('spell:already-known', ({ actor, spellId }) => {
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || 'spell')}]`;
    log(`You already know ${label}.`, 'system');
  });

  world.on('spell:learn-denied', ({ actor, reason, need, have, spellId }) => {
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? `[${s.name}]` : (spellId ? `[${String(spellId)}]` : 'that spell');
    let msg = `You can't learn ${label}.`;
    if (reason === 'intelligence') msg = `You need more intelligence to learn ${label} (need ${need}, have ${have}).`;
    if (reason === 'unknown-spell') msg = `This tome is inscrutable.`;
    log(msg, 'system');
  });

  world.on('spell:blink', ({ actor, randomized, randomReason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (randomized) {
      const why = randomReason === 'confused' ? 'confused' : 'hallucinating';
      log(`Your ${why} mind yanks the blink off-course.`, 'system');
      return;
    }
    log('Space folds and you blink to your mark.', 'system');
  });

  world.on('spell:blink:failed', ({ actor, reason, range }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'no_target') {
      log('Blink needs a destination tile.', 'system');
      return;
    }
    if (reason === 'out_of_range') {
      log(`Blink destination is out of range (${Number(range || 10) | 0} tiles).`, 'system');
      return;
    }
    if (reason === 'no_safe_landing') {
      log('Blink fizzles: no safe landing tile.', 'system');
      return;
    }
    log('Blink fizzles.', 'system');
  });

  world.on('spell:phase_strike', ({ actor, hits, randomized, randomReason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (randomized) {
      const why = randomReason === 'confused' ? 'confused' : 'hallucinating';
      log(`Your ${why} mind yanks the phase strike off-course.`, 'system');
      return;
    }
    const hitCount = Array.isArray(hits) ? hits.length : 0;
    if (hitCount > 0) {
      log(`You phase through your enemies, striking ${hitCount === 1 ? 'one foe' : hitCount + ' foes'}.`, 'system');
    } else {
      log('You phase strike to your mark.', 'system');
    }
  });

  world.on('spell:phase_strike:failed', ({ actor, reason, range }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'no_target') {
      log('Phase Strike needs a destination tile.', 'system');
      return;
    }
    if (reason === 'out_of_range') {
      log(`Phase Strike destination is out of range (${Number(range || 10) | 0} tiles).`, 'system');
      return;
    }
    if (reason === 'no_safe_landing') {
      log('Phase Strike fizzles: no safe landing tile.', 'system');
      return;
    }
    log('Phase Strike fizzles.', 'system');
  });

  world.on('spell:blind', ({ actor, targetId, fizzle, reason }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (fizzle) {
      if (who === 'You') {
        if (reason === 'no_los') log('Blind fizzles — no line of sight.', 'system');
        else if (reason === 'out_of_range') log('Blind fizzles — target out of range.', 'system');
        else log('Blind finds no target.', 'system');
      }
      return;
    }
    if (who === 'You') log(`You veil ${tgt}'s sight in darkness.`, 'combat');
    else if (tgt === 'You') log(`${who} veils your sight in darkness!`, 'danger');
    else log(`${who} blinds ${tgt}.`, 'combat');
  });

  world.on('spell:rampage', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You enter a blood rage!', 'combat');
  });

  world.on('spell:meteor', ({ actor, randomized, randomReason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (randomized) {
      const why = randomReason === 'confused' ? 'confused' : 'hallucinating';
      log(`Your ${why} mind drags the meteor off-course.`, 'system');
    }
  });

  world.on('spell:meteor:failed', ({ actor, reason, range }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'no_target') {
      log('Meteor needs a target tile.', 'system');
      return;
    }
    if (reason === 'out_of_range') {
      log(`Meteor target is out of range (${Number(range || 12) | 0} tiles).`, 'system');
      return;
    }
    if (reason === 'blocked_los') {
      log('Meteor target must be in line of sight.', 'system');
      return;
    }
    log('Meteor fizzles.', 'system');
  });

  function installStormFailureMessage(eventName, spellName) {
    world.on(eventName, ({ actor, reason, range }) => {
      if (nameOfEntity(actor) !== 'You') return;
      if (reason === 'no_target') {
        log(`${spellName} needs a target tile.`, 'system');
        return;
      }
      if (reason === 'out_of_range') {
        log(`${spellName} target is out of range (${Number(range || 10) | 0} tiles).`, 'system');
        return;
      }
      if (reason === 'blocked_los') {
        log(`${spellName} target must be in line of sight.`, 'system');
        return;
      }
      log(`${spellName} fizzles.`, 'system');
    });
  }

  installStormFailureMessage('spell:blizzard:failed', 'Blizzard');
  installStormFailureMessage('spell:firestorm:failed', 'Firestorm');

  world.on('monster:firebreath', ({ actor, target }) => {
    if (nameOfEntity(target) !== 'You') return;
    log(`${nameOfEntity(actor)} exhales a line of fire!`, 'combat');
  });

  // === Combat events ===
  world.on('attack:insufficient-stamina', ({ attacker, defender, weaponId, need, have }) => {
    const weaponInfo = compGet(weaponId, ItemInfo);
    const weaponName = weaponInfo ?
      (compGet(weaponId, NamedIdentity)?.name || weaponInfo.description || weaponInfo.type)
      : 'fists';
    log(`Not enough stamina to attack with ${weaponName} (need ${need}, have ${Math.floor(have)}).`, 'combat');
  });

  world.on('damaged', ({ target, amount, critical, crit, source, offhand }) => {
    const defName = nameOfEntity(target);
    const critTxt = (critical || crit) ? ' (CRIT!)' : '';
    const handTxt = offhand ? ' (off-hand)' : '';
    if (Number(source || 0)) {
      const atkName = nameOfEntity(source);
      let weaponLabel = '';
      const eq = compGet(Number(source || 0), Equipment);
      const wid = offhand ? Number(eq?.offhand || 0) : Number(eq?.weapon || 0);
      if (wid) {
        const wname = compGet(wid, NamedIdentity)?.name;
        if (wname) weaponLabel = ` with ${bracketizeName(wname)}`;
      } else if (!offhand && compHas(Number(source || 0), Player)) {
        weaponLabel = ' with bare fists';
      }
      log(`${atkName} hits ${defName}${weaponLabel} for ${amount}${critTxt}${handTxt}.`, 'combat');
    } else {
      log(`${defName} takes ${amount} damage${critTxt}${handTxt}.`, 'combat');
    }
  });

  world.on('healed', ({ id, amount }) => {
    const who = nameOfEntity(id);
    log(`${who} heals ${amount}.`, 'system');
  });

  world.on('died', ({ id, killer }) => {
    const who = nameOfEntity(id);
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    const deadId = Number(id || 0) | 0;
    const killerId = Number(killer || 0) | 0;

    if (compHas(deadId, Pet)) {
      const owner = compGet(deadId, Owner);
      const ownerId = Number(owner?.ownerId || 0) | 0;
      if (playerId > 0 && ownerId === playerId && killerId === playerId) {
        log(`You kill ${who}. The act is unforgivable.`, 'deity');
        return;
      }
    }

    log(`${who} dies.`, 'combat');
  });

  world.on('status', (payload) => {
    const { id, kind, source } = normalizeStatusEvent(payload);
    const style = (String(kind || '')).toLowerCase();
    const tgt = nameOfEntity(id);
    const src = Number(source || 0) ? nameOfEntity(source) : null;
    if (style === 'miss' && src) log(`${src} misses ${tgt}.`, 'combat');
    if (style === 'immune' && src) log(`${src} can't hurt ${tgt}.`, 'combat');
  });

  // === Ranged combat events ===
  world.on('ranged:no-ammo', ({ attacker }) => {
    const who = nameOfEntity(attacker);
    log(who === 'You' ? 'You have no arrows.' : `${who} is out of ammo.`, 'combat');
  });

  world.on('ranged:blocked', ({ attacker, target }) => {
    const who = nameOfEntity(attacker);
    log(who === 'You' ? 'Your shot is blocked.' : `${who}'s shot is blocked.`, 'combat');
  });

  world.on('ranged:out-of-range', ({ attacker, target }) => {
    const who = nameOfEntity(attacker);
    const tgt = nameOfEntity(target);
    log(who === 'You' ? `${tgt} is out of range.` : `${who}'s target is out of range.`, 'combat');
  });

  // === Prayer events ===
  world.on('prayer', ({ actor, distress }) => {
    const who = nameOfEntity(actor);
    if (distress?.desperate) {
      log(`${who} desperately prays for divine intervention!`, 'deity');
    } else if (distress?.troubled) {
      log(`${who} prays for aid...`, 'deity');
    } else {
      log(`${who} prays to the heavens...`, 'deity');
    }
  });

  world.on('prayer:insight', ({ actor, deityName, pantheon, desperate, troubled, needs }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const mode = pantheon ? 'pantheon' : 'single deity';
    const urgency = desperate ? 'desperate' : (troubled ? 'urgent' : 'steady');
    const needText = Array.isArray(needs) && needs.length ? ` Need: ${needs.join(', ')}.` : '';
    log(`${deityName || 'A deity'} hears your ${urgency} prayer (${mode}).${needText}`, 'deity');
  });

  world.on('prayer:curse-removed', ({ actor, name }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = bracketizeName(String(name || 'item'));
    log(`Divine grace lifts a curse from ${label}.`, 'deity');
  });

  world.on('deity:patronShift', ({ playerId, deityName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    log(`The pantheon shifts — ${deityName || 'a new patron'} now answers you most strongly.`, 'deity');
  });

  world.on('deity:intervention', ({ playerId, deityId, deityName, kind, effect, itemName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    if (!isFavoredDeityForPlayer(playerId, deityId)) return;
    const k = String(kind || 'intervention');
    if (k === 'miracle') return;
    if (k === 'shrine_blessing') {
      log(`${deityName || 'A deity'} answers from the shrine.`, 'deity');
      return;
    }
    if (k === 'prayer_uncurse') {
      log(`${deityName || 'A deity'} lifts the curse from ${bracketizeName(String(itemName || 'your gear'))}.`, 'deity');
      return;
    }
    if (k === 'patron_shift') {
      log(`Divine currents realign around ${deityName || 'a new patron'}.`, 'deity');
      return;
    }
    if (k === 'boon') return;
    if (k === 'wrath') {
      log(`${deityName || 'A deity'}'s intervention is wrathful.`, 'deity');
    }
  });

  world.on('deity:boon', ({ actor, deityId, message, boon, amount, removed, uncursed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (!isFavoredDeityForPlayer(actor, deityId)) return;
    const text = String(message || '').trim();
    if (text) {
      log(text, 'deity');
      return;
    }
    const b = String(boon || 'blessing');
    if (b === 'renewal') {
      log(`Divine renewal restores you (+${Math.max(0, Number(amount || 0) | 0)} HP).`, 'deity');
      return;
    }
    if (b === 'mana_surge') {
      log(`A mana surge fills you (+${Math.max(0, Number(amount || 0) | 0)} MP).`, 'deity');
      return;
    }
    if (b === 'cleanse') {
      log(`You are cleansed (${Math.max(0, Number(removed || 0) | 0)} afflictions, ${Math.max(0, Number(uncursed || 0) | 0)} curses removed).`, 'deity');
      return;
    }
    log('A divine blessing takes hold.', 'deity');
  });

  // === Pet events ===
  world.on('pet:deliver', ({ petId, actor, itemId, itemName, count }) => {
    const petName = nameOfEntity(petId);
    const label = itemName ? bracketizeName(itemName) : nameOfItem(itemId);
    log(`${petName} drops ${label} at your feet.`, 'system');
  });

  world.on('pet:state:changed', ({ petId, prevState, newState, command }) => {
    const petName = nameOfEntity(petId);
    const stateNames = {
      following: 'following you',
      staying: 'staying put',
      guarding: 'guarding',
      aggressive: 'aggressive',
      fetching: 'fetching an item',
      returning: 'returning',
      fleeing: 'fleeing',
      idle: 'idle'
    };
    log(`${petName} is now ${stateNames[newState] || newState}.`, 'system');
  });

  world.on('pet:state:auto', ({ petId, newState, reason }) => {
    const petName = nameOfEntity(petId);
    if (reason === 'low_health') {
      log(`${petName} flees to safety!`, 'system');
    } else if (reason === 'health_restored') {
      log(`${petName} returns to your side.`, 'system');
    } else if (reason === 'item_picked_up') {
      log(`${petName} has the item!`, 'system');
    }
  });

  world.on('pet:teleported', ({ petId, from, to }) => {
    const petName = nameOfEntity(petId);
    log(`${petName} teleports to your side.`, 'system');
  });

  world.on('pet:corpse-munch', ({ petId, corpseName, heal, partial, resistedToxin }) => {
    const petName = nameOfEntity(petId);
    const label = bracketizeName(String(corpseName || 'corpse'));
    const hp = Math.max(0, Number(heal || 0) | 0);
    const keptSome = partial === true;
    let msg = keptSome
      ? `${petName} takes a bite out of ${label} right off the floor. Crunch.`
      : `${petName} demolishes ${label} right off the floor. Crunch-crunch.`;
    if (hp > 0) msg += ` (+${hp} HP)`;
    if (resistedToxin === true) msg += ' Iron stomach.';
    log(msg, 'system');
  });

  world.on('corpse:desecrated', ({ actor, ownerId, corpseName }) => {
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    const actorId = Number(actor || 0) | 0;
    if (!(playerId > 0) || actorId !== playerId) return;

    const label = bracketizeName(String(corpseName || "pet corpse"));
    const desecratedOwnPet = (Number(ownerId || 0) | 0) === playerId;
    if (desecratedOwnPet) {
      log(`You consume ${label}. It is horrifying. The heavens will remember this.`, 'deity');
      return;
    }
    log(`You desecrate ${label}.`, 'deity');
  });

  world.on('corpse:trait-gained', ({ actor, trait, name }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const label = String(name || trait || 'unknown');
    const TRAIT_MESSAGES = {
      iron_stomach: `Your stomach hardens \u2014 you've developed an ${label}!`,
      serpent_blood: `Venom runs cold through your veins \u2014 you've gained ${label}!`,
      venom_tolerance: `Your body shrugs off toxins \u2014 you've gained ${label}!`,
      thick_hide: `Your skin toughens like bark \u2014 you've gained ${label}!`,
      deathless: `Undeath whispers through your bones \u2014 you are ${label}.`,
      third_eye: `A third eye opens in your mind \u2014 you sense life beyond walls.`,
      demon_fire: `Hellfire smolders in your fists \u2014 ${label} is yours.`,
      dragonheart: `Scales shimmer beneath your skin \u2014 the ${label} beats within you!`,
    };
    log(TRAIT_MESSAGES[trait] || `Something fundamental shifts \u2014 you've gained ${label}!`, 'legendary');
  });

  world.on('corpse:buff-gained', ({ actor, effect, description }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const desc = String(description || effect || 'something stirs within you');
    log(`You feel ${desc}.`, 'system');
  });

  world.on('corpse:debuff-gained', ({ actor, effect, description }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const desc = String(description || effect || 'something is wrong');
    log(`You feel ${desc}.`, 'danger');
  });

  world.on('corpse:resistance-gained', ({ actor, type }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    log(`Your body adapts \u2014 ${String(type || 'unknown')} resistance gained.`, 'legendary');
  });

  world.on('corpse:progression', ({ actor, name, count, threshold }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const label = String(name || 'unknown');
    const c = Number(count || 0);
    const t = Number(threshold || 0);
    log(`Your body adapts... (${label}: ${c}/${t})`, 'system');
  });

  // === Environment events ===
  world.on('engrave', ({ actor, text, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} engrave${who === 'You' ? '' : 's'} "${text}" on the ground.`, 'system');
  });

  world.on('engrave:scrambled', ({ actor, text, x, y }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    const ppos = compGet(pe.id, Position);
    // Only log if the player can see the tile
    if (ppos && Math.max(Math.abs(ppos.x - x), Math.abs(ppos.y - y)) <= 10) {
      const who = nameOfEntity(actor);
      log(`${who} scuff${who === 'You' ? '' : 's'} the engraving underfoot.`, 'system');
    }
  });

  world.on('interaction', ({ action, result, items: droppedIds, targetId, epitaph }) => {
    if (action === 'toggleDoor') {
      log(`The door ${result === 'opened' ? 'opens' : (result === 'closed' ? 'closes' : 'is locked')}.`, 'system');
    }
    if (action === 'toggleLantern') {
      log(result === 'lit' ? 'You light the lantern.' : 'You extinguish the lantern.', 'system');
    }
    if (action === 'openChest') {
      log('You open the chest!', 'system');
    }
    if (action === 'readTombstone') {
      if (epitaph) {
        log('--- TOMBSTONE ---', 'system');
        log(epitaph, 'system');
        log('----------------', 'system');
      } else {
        log('The tombstone inscription has faded...', 'system');
      }
    }
    if (action === 'readText') {
      const inter = compGet(Number(targetId || 0), NamedIdentity);
      if (inter?.identity === 'house_sign') {
        log('Home sweet home. Rest, gather, and prepare for another descent.', 'system');
      } else if (inter?.identity === 'smithy_sign') {
        log('The Black Smith — ore deliveries welcome.', 'system');
      } else if (inter?.identity === 'apothecary_sign') {
        log('The Apothecary — potions, salves, and remedies.', 'system');
      } else if (inter?.identity === 'gem_shop_sign') {
        log('Gem Dealer — identified stones, socketables, and fine cuts.', 'system');
      } else if (inter?.identity === 'tombstone') {
        log('The weathered inscription reads: "Rest eternal, faithful soul."', 'system');
      } else {
        log('You read the sign.', 'system');
      }
    }
  });

  world.on('bed:rested', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') {
      log('You rest in your bed and feel fully restored.', 'system');
    } else {
      log(`${nameOfEntity(actor)} rests for a while.`, 'system');
    }
  });

  world.on('town:bulletinBoard', ({ actor, districts, opportunityView, questBoard }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const payload = {
      districts: Array.isArray(districts) ? districts : [],
      opportunityView: opportunityView && typeof opportunityView === 'object' ? opportunityView : null,
      questBoard: questBoard && typeof questBoard === 'object'
        ? questBoard
        : null,
    };
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('ui:openTownBoard'));
        window.dispatchEvent(new CustomEvent('ui:townBoardData', { detail: payload }));
      } catch (e) {
        console.debug('[messageWiring] dispatch town board overlay events:', e);
      }
    }
    log('--- TOWN BOARD ---', 'system');
    const bulletins = Array.isArray(districts) ? districts : [];
    if (!bulletins.length) {
      log('The board is empty.', 'system');
      return;
    }
    for (const bulletin of bulletins.slice(0, 4)) {
      log(formatBulletinDistrictLine(bulletin), 'system');
    }
    const sectors = Array.isArray(opportunityView?.profitableSectors)
      ? opportunityView.profitableSectors
      : [];
    if (sectors.length) {
      const labels = sectors.map((sector) => BULLETIN_SECTOR_LABELS[sector] || String(sector || "").replace(/_/g, " "));
      log(`Profitable work: ${labels.join(', ')}.`, 'system');
    }
    const rumor = formatBulletinRumors(bulletins);
    if (rumor) log(rumor, 'system');
  });

  // Room feature events
  world.on('well:drink', ({ actor, amount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (amount > 0) log(`You draw cool water from the well. (+${amount} SP)`, 'system');
    else log('You draw water from the well. You feel refreshed.', 'system');
  });

  world.on('fountain:drink', ({ actor, effect, amount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (effect === 'heal') log(`You drink from the fountain and feel refreshed. (+${amount} HP)`, 'system');
    else if (effect === 'mana') log(`You drink from the fountain. Magical energy surges through you. (+${amount} MP)`, 'system');
    else if (effect === 'poison') log(`You drink from the fountain. It was contaminated! (-${amount} HP)`, 'combat');
    else log('You drink from the fountain. The water is stale.', 'system');
  });
  world.on('fountain:dry', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The fountain is dry.', 'system');
  });

  world.on('altar:pray', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You kneel at the altar and pray...', 'system');
  });

  world.on('altar:offered', ({ actor, deityName, itemName }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You place ${itemName} on the altar as an offering to ${deityName}.`, 'system');
  });

  world.on('altar:offerFailed', ({ actor, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (String(reason || '') === 'not_owned') {
      log('You are no longer carrying that offering.', 'system');
      return;
    }
    log('Your offering fails.', 'system');
  });

  world.on('bell:rung', () => {
    log('You ring the town bell \u2014 the villagers take up arms!', 'warning');
  });

  world.on('shrine:touch', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const devotion = compGet(Number(actor || 0), Devotion);
    if (devotion?.deityId) return;
    log('You touch the shrine. A faint warmth pulses through you.', 'system');
  });

  world.on('shrine:communion', ({ actor, deityName, effect, cooldownRemaining }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (effect === 'blessing') {
      log(`${deityName || 'Your deity'} acknowledges your devotion at the shrine.`, 'deity');
      return;
    }
    if (effect === 'cooldown') {
      const turns = Math.max(1, Number(cooldownRemaining || 1) | 0);
      log(`${deityName || 'Your deity'} remains silent. Commune again in ${turns} turns.`, 'deity');
      return;
    }
    log('The shrine is silent.', 'system');
  });

  world.on('mushroom:hallucinate', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The mushrooms make your head swim. The walls begin to shift... and a furious rage surges through you!', 'system');
  });

  world.on('harvest:picked', ({ actor, kind, count, itemId }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const yieldLabel = harvestYieldLabel(kind);
    const itemLabel = itemId ? nameOfItem(itemId) : bracketizeName(yieldLabel);
    const verb = isOreKind(kind) ? 'mine' : 'harvest';
    log(`You ${verb} ${count} ${yieldLabel} (${itemLabel}).`, 'system');
  });

  world.on('harvest:empty', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const nodeLabel = harvestNodeLabel(kind);
    if (isOreKind(kind)) {
      log(`The ${nodeLabel} is exhausted.`, 'system');
    } else {
      log(`The ${nodeLabel} is picked clean.`, 'system');
    }
  });

  world.on('harvest:regrown', ({ id, kind }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    const ppos = compGet(pe.id, Position);
    const pos = compGet(Number(id || 0), Position);
    if (!ppos || !pos) return;
    const dist = Math.max(Math.abs(ppos.x - pos.x), Math.abs(ppos.y - pos.y));
    if (dist > 6) return;
    const k = String(kind || "").toLowerCase();
    let what;
    if (k === "iron_ore") what = "An iron vein shimmers with fresh ore nearby.";
    else if (k === "coal_ore") what = "A coal seam darkens with fresh deposits nearby.";
    else if (k === "stone") what = "A stone outcrop juts up fresh rock nearby.";
    else if (k === "herbs") what = "A herb patch looks fresh again.";
    else if (k === "thorn_bramble") what = "A thorn bramble thickens nearby.";
    else if (k === "venom_fern") what = "A venom fern unfurls fresh fronds nearby.";
    else if (k === "wheat") what = "A wheat crop has grown back.";
    else if (k === "carrot") what = "A carrot plant sprouts anew.";
    else if (k === "corn") what = "A corn stalk shoots up nearby.";
    else if (k === "tree") what = "A tree has regrown nearby.";
    else what = "A berry bush ripens nearby.";
    log(what, 'ambient');
  });

  world.on('harvest:no_tool', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const nodeLabel = harvestNodeLabel(kind);
    log(`You need a pickaxe to mine the ${nodeLabel}.`, 'system');
  });

  world.on('harvest:no_stamina', ({ actor, kind, cost }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const nodeLabel = harvestNodeLabel(kind);
    log(`You're too exhausted to mine the ${nodeLabel}. (${cost} stamina needed)`, 'system');
  });

  world.on('harvest:danger', ({ actor, kind, effect, damage }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const n = Math.max(0, Number(damage || 0) | 0);
    if (effect === 'thorns') {
      log(`The thorn bramble bites your hands${n > 0 ? ` for ${n}` : ''}.`, 'combat');
      return;
    }
    if (effect === 'spores') {
      const dmgText = n > 0 ? ` You take ${n} poison damage.` : '';
      log(`Venom spores burst from the fern.${dmgText}`, 'combat');
    }
  });

  world.on('harvest:seed_drop', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = kind === 'wheat' ? 'wheat' : kind === 'carrot' ? 'carrot' : kind === 'corn' ? 'corn' : kind;
    log(`You find some ${label} seeds!`, 'system');
  });

  world.on('seed:planted', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = kind === 'wheat' ? 'wheat' : kind === 'carrot' ? 'carrot' : kind === 'corn' ? 'corn' : kind;
    log(`You plant ${label} seeds in the soil.`, 'system');
  });

  world.on('alchemy:open', ({ actor, ingredients }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const summary = formatIngredientBag(ingredients, { includeZero: true });
    log(`You open the alchemy bench. (${summary || "no reagents"})`, 'system');
  });

  world.on('alchemy:crafted', ({ actor, recipeLabel, outputName, outputCount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const count = Math.max(1, Number(outputCount || 1) | 0);
    const recipe = bracketizeName(String(recipeLabel || 'brew'));
    const out = bracketizeName(String(outputName || 'vial'));
    log(`You distill ${recipe} and craft ${count} ${out}.`, 'system');
  });

  world.on('alchemy:result', ({ actor, result, missing, recipeKey }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (result === 'missing_ingredients') {
      const bits = formatIngredientBag(missing);
      log(`Missing ingredients for ${recipeKey || 'that recipe'}: ${bits || "requirements not met"}.`, 'system');
      return;
    }
    if (result === 'unknown_recipe') {
      log('That alchemy recipe is unknown.', 'system');
      return;
    }
    if (result === 'no_inventory') {
      log('You need an inventory to carry brewed vials.', 'system');
      return;
    }
    if (result === 'brew_failed') {
      log('The brew collapses into sludge.', 'system');
    }
  });

  world.on('mill:milled', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You grind wheat into fresh flour at the millstone.', 'system');
  });

  world.on('mill:failed', ({ actor, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'missing_wheat') {
      log('You need wheat before the millstone can do any work.', 'system');
      return;
    }
    if (reason === 'no_inventory') {
      log('You need some way to carry the flour.', 'system');
      return;
    }
    log('The millstone grinds to a halt.', 'system');
  });

  world.on('smithy:smelted', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You fire the forge and smelt ore into a workable iron ingot.', 'system');
  });

  world.on('smithy:forged', ({ actor, outputName }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You hammer out ${bracketizeName(String(outputName || 'new tools'))} at the anvil.`, 'system');
  });

  world.on('smithy:failed', ({ actor, reason, station }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (station === 'furnace') {
      if (reason === 'missing_ore') log('You need iron ore to fire the forge.', 'system');
      else if (reason === 'missing_fuel') log('The forge needs coal before you can smelt anything.', 'system');
      else log('The forge sputters without producing anything useful.', 'system');
      return;
    }
    if (reason === 'missing_iron') log('You need smelted iron before the anvil can shape anything.', 'system');
    else if (reason === 'missing_lumber') log('You need lumber for handles and hafts before you can finish a tool.', 'system');
    else log('You study the anvil, but you lack the right materials for the next job.', 'system');
  });

  world.on('deathlog:open', () => {
    log('You open the Book of the Dead...', 'system');
    window.dispatchEvent(new CustomEvent('ui:openDeathLog'));
  });

  world.on('book:open', ({ title, text }) => {
    log(`You read ${title || 'a book'}...`, 'system');
    window.dispatchEvent(new CustomEvent('ui:openBookReader', { detail: { title, text } }));
  });

  world.on('stair:traverse', ({ actor, targetId, direction }) => {
    log(`You ${direction === 'down' ? 'descend' : 'ascend'} the stairs...`, 'system');
  });

  world.on('portal:spawned', ({ portalId, at }) => {
    log('A shimmering return portal tears open nearby.', 'system');
  });

  world.on('portal:return', ({ actor }) => {
    const who = nameOfEntity(actor);
    if (who === 'You') log('You step into the return portal.', 'system');
    else log(`${who} steps into a return portal.`, 'system');
  });

  world.on('portal:return:fragged', ({ count, at }) => {
    const n = Math.max(0, Number(count || 0) | 0);
    if (n > 0) log(`Arrival shockwave obliterates ${n} occupant${n === 1 ? '' : 's'}.`, 'system');
  });

  world.on('dungeon:teleport-depth', ({ actor, targetDepth, source }) => {
    if (Number(targetDepth) !== 0) return;
    const src = String(source || '');
    const who = nameOfEntity(actor);
    if (src === 'scroll_homecoming') {
      if (who === 'You') {
        log('The scroll turns to warm ash. A familiar pull carries you home.', 'system');
      } else {
        log(`${who} vanishes in a swirl of warm ash.`, 'system');
      }
    } else if (src === 'hearthstone') {
      if (who === 'You') {
        log('The hearthstone pulses with warmth. You are pulled home.', 'system');
      } else {
        log(`${who} vanishes in a pulse of hearthlight.`, 'system');
      }
    }
  });

  // === Dig events ===
  world.on('tile:dug', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} dig${who === 'You' ? '' : 's'} through the wall.`, 'system');
  });

  world.on('tile:chopped', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} chop${who === 'You' ? '' : 's'} down the tree.`, 'system');
  });

  // === Townfolk NPC events ===
  world.on('npc:dialogue', ({ text }) => {
    log(text, 'info');
  });

  world.on('quest:started', ({ title }) => {
    const label = String(title || 'Quest');
    log(`Quest started: ${label}.`, 'system');
  });

  world.on('quest:advanced', ({ objective }) => {
    const text = String(objective || '').trim();
    if (text) log(`Objective updated: ${text}`, 'system');
  });

  world.on('quest:completed', ({ title }) => {
    const label = String(title || 'Quest');
    log(`Quest completed: ${label}.`, 'system');
  });

  world.on('townfolk:chopped', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A woodcutter fells a tree.', 'ambient');
  });

  world.on('townfolk:repaired', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A mason repairs some damage.', 'ambient');
  });

  world.on('townfolk:mined', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A miner chips away at the rock.', 'ambient');
  });

  world.on('townfolk:harvested', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A farmer picks a ripe crop.', 'ambient');
  });

  world.on('townfolk:planted', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A farmer plants a seed.', 'ambient');
  });

  world.on('townfolk:carrying', ({ resource }) => {
    // silent — just drives state; could add visible hauling later
  });

  world.on('townfolk:delivered', () => {
    // silent — resource delivery is cosmetic
  });

  world.on('townfolk:gathered_herbs', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An herbalist gathers wild herbs.', 'ambient');
  });

  world.on('townfolk:brewed', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An alchemist brews a potion.', 'ambient');
  });

  world.on('townfolk:smelted', ({ x, y }) => {
    if (canSeeAt(x, y)) log('The smith stokes the forge and draws out fresh iron.', 'ambient');
  });

  world.on('townfolk:stocked', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An alchemist arranges potions on the shelves.', 'ambient');
  });

  world.on('townfolk:sorted_herbs', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An herbalist sorts through dried herbs.', 'ambient');
  });

  world.on('town:produced', ({ chain, itemId }) => {
    if (chain === 'mill') log('The mill turns stored grain into fresh flour.', 'ambient');
    else if (chain === 'furnace') log('The forge roars as ore melts down into iron.', 'ambient');
    else if (chain === 'smithy') log('Hammering rings out as the smith turns iron into tools.', 'ambient');
  });

  world.on('town:shortage', ({ food, materials, medicine }) => {
    if (food) log('The town is running lean on food.', 'system');
    else if (medicine) log('The apothecary stores are running low.', 'system');
    else if (materials) log('The workshops are short on raw materials.', 'system');
  });

  world.on('town:threatened', ({ threatLevel }) => {
    if (threatLevel > 0) log('The town stirs uneasily at a nearby threat.', 'system');
  });

  world.on('tile:burned', ({ actor, x, y, burnedKind }) => {
    if (!canSeeAt(x, y)) return;
    const kind = String(burnedKind || 'tree');
    if (!hasNamedEntity(actor)) {
      if (kind === 'wall') log('The wall burns open in a shower of sparks.', 'system');
      else if (kind === 'door') log('The door burns off its hinges.', 'system');
      else if (kind === 'fence') log('The fence burns away in a quick rush of flame.', 'system');
      else if (kind === 'roof') log('The roof catches and starts to burn through.', 'system');
      else log('The tree burns down to ash.', 'system');
      return;
    }

    const who = nameOfEntity(actor);
    if (kind === 'wall') log(`${who} ${burnVerb(who)} through the wall.`, 'system');
    else if (kind === 'door') log(`${who} ${burnVerb(who)} the door off its hinges.`, 'system');
    else if (kind === 'fence') log(`${who} ${burnVerb(who)} the fence down.`, 'system');
    else if (kind === 'roof') log(`${who} ${burnVerb(who)} through the roof.`, 'system');
    else log(`${who} ${burnVerb(who)} the tree to ash.`, 'system');
  });

  world.on('entity:burned', ({ actor, x, y, name, identity }) => {
    if (!canSeeAt(x, y)) return;
    const label = bracketizeName(name || identity || 'thing');
    if (!hasNamedEntity(actor)) {
      log(`${label} goes up in sparks.`, 'system');
      return;
    }
    const who = nameOfEntity(actor);
    log(`${who} ${burnVerb(who)} ${label} to cinders.`, 'system');
  });

  // === Apply events ===
  world.on('item:applied', ({ targetId, result }) => {
    if (!result) return;
    const targetName = nameOfItem(targetId);
    if (result.type === 'touchstone') {
      const touchstoneName = targetName || result.appearance || 'gem';
      if (result.hardness === 'hard') {
        log(`You rub ${touchstoneName} on the touchstone... it makes a hard white streak!`, 'system');
      } else {
        log(`You rub ${touchstoneName} on the touchstone... it leaves a dull scratch.`, 'system');
      }
    } else if (typeof result.message === 'string' && result.message.trim().length > 0) {
      // Apply hook-provided text keeps behavior hackable in content files.
      log(result.message, 'system');
    } else if (result.type === 'nothing') {
      log(`Nothing happens.`, 'system');
    } else {
      log(`A cryptic sheen crawls over ${targetName}, then vanishes.`, 'system');
    }
  });

  world.on('gem:socketed', ({ actor, weaponId, gemId }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== actor) return;
    const weaponName = nameOfItem(weaponId);
    const gName = String(gemId || '').replace(/_/g, ' ').replace(/^gem /, '');
    log(`You socket the ${gName} into ${weaponName}.`, 'system');
  });

  // === Identification events ===
  world.on('item:identified', ({ identity, name, appearance, category }) => {
    const displayName = bracketizeName(name);
    log(`You identify the ${appearance}: it's ${displayName}!`, 'system');
    // Trigger inventory refresh so names update immediately
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[messageWiring] dispatch ui:requestInventoryData:', e); }
  });

  // === Food decay events ===
  world.on('food:decayed', ({ ownerId, itemId, stage, itemName }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== ownerId) return;
    const label = bracketizeName(itemName);
    if (stage === 'off')    log(`Your ${label} smells off.`, 'system');
    if (stage === 'rancid') log(`Your ${label} reeks!`, 'system');
    if (stage === 'putrid') log(`Your ${label} is putrid!`, 'system');
  });

  // === Equipment events ===
  world.on('item:equipped', ({ actor, itemId, slot, name }) => {
    const label = name ? bracketizeName(name) : `item ${itemId}`;
    log(`You equip ${label}${slot ? ' (' + slot + ')' : ''}.`, 'system');
  });
  world.on('item:unequipped', ({ actor, itemId, slot, name }) => {
    const label = name ? bracketizeName(name) : `item ${itemId}`;
    log(`You unequip ${label}${slot ? ' (' + slot + ')' : ''}.`, 'system');
  });

  // === Urn events ===
  world.on('urn:broken', () => {
    log('The urn shatters, scattering ashes on the floor.', 'system');
  });

  // === Gaze events (Floating Eye) ===
  world.on('proc:gaze:message', ({ message }) => {
    if (typeof message === 'string') log(message, 'system');
  });
  world.on('proc:gaze:stun', () => {
    log('The Floating Eye\'s gaze locks your mind — you are stunned!', 'danger');
  });

  // === Centipede events ===
  world.on('centipede:split', () => {
    log('The centipede splits in two!', 'warning');
  });

  // === Flying events ===
  world.on('proc:fly:takeoff', ({ name, x, y }) => {
    if (!canSeeAt(x, y)) return;
    log(`The ${name || 'creature'} takes to the air!`, 'system');
  });
  world.on('proc:fly:land', ({ name, x, y }) => {
    if (!canSeeAt(x, y)) return;
    log(`The ${name || 'creature'} lands.`, 'system');
  });
  world.on('combat:target-flying', () => {
    log('Out of reach!', 'info');
  });

  // === Trap events ===
  world.on('trap:avoided', ({ victimId, trapId, type }) => {
    const trapNames = { spike: 'Spike Trap', snake: 'Snake Trap', shock: 'Shock Trap' };
    const name = trapNames[type] || 'trap';
    log(`You nimbly dodge the ${name}!`, 'info');
  });
  world.on('trap:disarmed', ({ actor, trapType }) => {
    const trapNames = { spike: 'Spike Trap', snake: 'Snake Trap', shock: 'Shock Trap' };
    const name = trapNames[trapType] || 'trap';
    log(`You carefully disarm the ${name}.`, 'info');
  });
  world.on('trap:disarm:failed', ({ actor, trapType }) => {
    const trapNames = { spike: 'Spike Trap', snake: 'Snake Trap', shock: 'Shock Trap' };
    const name = trapNames[trapType] || 'trap';
    log(`You fumble the ${name} — it triggers!`, 'danger');
  });

  // === Weather events ===
  world.on('weather:changed', ({ weather, prev }) => {
    if (weather === 'rain') {
      log('Rain begins to fall.', 'info');
    } else if (weather === 'heavy_rain') {
      log('The rain intensifies into a downpour.', 'info');
    } else if (weather === 'clear' && (prev === 'rain' || prev === 'heavy_rain')) {
      log('The rain lets up.', 'info');
    }
  });
  world.on('weather:extinguish', ({ kind }) => {
    if (kind === 'player') {
      log('The rain douses the flames on you.', 'info');
    } else if (kind === 'structure') {
      log('The rain puts out a fire.', 'ambient');
    }
  });
  world.on('weather:lightning', ({ x, y, hitTree, hitWater, hitCount, hitPlayer }) => {
    if ((hitCount | 0) > 0) {
      log('A bolt of lightning strikes!', 'danger');
    } else if (hitTree) {
      log('Lightning splinters a nearby tree!', 'system');
    } else if (hitWater) {
      log('Lightning crackles across the water!', 'system');
    } else {
      log('Lightning strikes the ground nearby!', 'system');
    }
    // Sensory overload messages when the player is directly hit
    if (hitPlayer) {
      log('*** a flash of light! ***', 'danger');
      log('*** ringing fills your ears! ***', 'danger');
    }
  });

  // Sensory overload messages for shock trap
  world.on('shock_trap:sensory', ({ target }) => {
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    if (!(playerId > 0) || (Number(target || 0) | 0) !== playerId) return;
    log('*** a flash of light! ***', 'danger');
    log('*** ringing fills your ears! ***', 'danger');
  });

  // === Calendar events ===
  world.on('calendar:newDay', ({ next }) => {
    // Quiet — day ticks are frequent, no log spam.
  });
  world.on('calendar:newMonth', ({ name }) => {
    log(`The month of ${name} begins.`, 'system');
  });
  world.on('calendar:newSeason', ({ next }) => {
    const label = next.charAt(0).toUpperCase() + next.slice(1);
    log(`${label} has arrived.`, 'system');
  });
  world.on('calendar:newYear', ({ next }) => {
    log(`A new year dawns — Year ${next}.`, 'system');
  });
}
