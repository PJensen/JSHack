import { normalizeStatusEvent } from "../../../shared/events/statusEvent.js";

const INSTALLED = Symbol.for("jshack:display:messageWiring:installed");
const ALL_CAPS_DB_BY_SOURCE = Object.freeze({
  fountain: 84,
  shop: 78,
  home: 74,
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
  function nameOfEntity(id) {
    const pe = playerEntity(world);
    const playerId = pe?.id || 0;
    const n = Number(id || 0);
    if (playerId && n === playerId) return 'You';
    const ni = compGet(n, NamedIdentity);
    const label = ni?.name;
    return label ? bracketizeName(label) : `Entity ${n}`;
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
    if (k === "mushrooms") return "mushrooms";
    if (k === "iron_ore") return "iron ore";
    if (k === "coal_ore") return "coal";
    if (k === "stone") return "stone chips";
    return "berries";
  }

  function harvestNodeLabel(kind) {
    const k = String(kind || "").toLowerCase();
    if (k === "herbs") return "herb patch";
    if (k === "thorn_bramble") return "thorn bramble";
    if (k === "venom_fern") return "venom fern";
    if (k === "mushrooms") return "mushroom patch";
    if (k === "iron_ore") return "iron vein";
    if (k === "coal_ore") return "coal seam";
    if (k === "stone") return "stone outcrop";
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
    log(`You don't know that spell${spellId ? ` [${spellId}]` : ''}.`, 'system');
  });

  world.on('spell:unknown', ({ actor, spellId }) => {
    log(`Unknown spell${spellId ? ` [${spellId}]` : ''}.`, 'system');
  });

  world.on('spell:oom', ({ actor, spellId, need, have }) => {
    log(`Not enough mana to cast [${String(spellId || 'spell')}] (need ${need}, have ${have}).`, 'system');
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

  world.on('channeling:tick', ({ actor, spellId, turnsRemaining, turnsTotal }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const elapsed = Math.max(0, (turnsTotal || 0) - (turnsRemaining || 0));
    log(`Channeling... (${elapsed}/${turnsTotal || '?'})`, 'system');
  });

  world.on('channeling:cancelled', ({ actor, spellId, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'dead') {
      log('Channeling interrupted by death.', 'combat');
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

  world.on('damaged', ({ target, amount, critical, crit, source }) => {
    const defName = nameOfEntity(target);
    const critTxt = (critical || crit) ? ' (CRIT!)' : '';
    if (Number(source || 0)) {
      const atkName = nameOfEntity(source);
      let weaponLabel = '';
      const eq = compGet(Number(source || 0), Equipment);
      const wid = Number(eq?.weapon || 0);
      if (wid) {
        const wname = compGet(wid, NamedIdentity)?.name;
        if (wname) weaponLabel = ` with ${bracketizeName(wname)}`;
      } else if (compHas(Number(source || 0), Player)) {
        weaponLabel = ' with bare fists';
      }
      log(`${atkName} hits ${defName}${weaponLabel} for ${amount}${critTxt}.`, 'combat');
    } else {
      log(`${defName} takes ${amount} damage${critTxt}.`, 'combat');
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

  // Room feature events
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

  world.on('townfolk:chopped', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A woodcutter fells a tree.', 'ambient');
  });

  world.on('townfolk:repaired', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A mason repairs some damage.', 'ambient');
  });

  world.on('townfolk:mined', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A miner chips away at the rock.', 'ambient');
  });

  world.on('townfolk:carrying', ({ resource }) => {
    // silent — just drives state; could add visible hauling later
  });

  world.on('townfolk:delivered', () => {
    // silent — resource delivery is cosmetic
  });

  world.on('tile:burned', ({ actor, x, y, burnedKind }) => {
    if (!canSeeAt(x, y)) return;
    const kind = String(burnedKind || 'tree');
    if (!hasNamedEntity(actor)) {
      if (kind === 'wall') log('The wall burns open in a shower of sparks.', 'system');
      else if (kind === 'door') log('The door burns off its hinges.', 'system');
      else if (kind === 'fence') log('The fence burns away in a quick rush of flame.', 'system');
      else log('The tree burns down to ash.', 'system');
      return;
    }

    const who = nameOfEntity(actor);
    if (kind === 'wall') log(`${who} ${burnVerb(who)} through the wall.`, 'system');
    else if (kind === 'door') log(`${who} ${burnVerb(who)} the door off its hinges.`, 'system');
    else if (kind === 'fence') log(`${who} ${burnVerb(who)} the fence down.`, 'system');
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
}
