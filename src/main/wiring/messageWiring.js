import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Owner } from "../../rules/components/Owner.js";
import { Pet } from "../../rules/components/Pet.js";
import { Player } from "../../rules/components/Player.js";
import { Position } from "../../rules/components/Position.js";
import { resolveItemDisplayName } from "./itemName.js";

const INSTALLED = Symbol.for("jshack:main:messageWiring:installed");

/**
 * Centralized message event handling
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   messageLog: { log: (msg: string | {text: string, type: string}) => void },
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({id:number,pos:{x:number,y:number}}|null),
 *   bracketizeName: (s: string) => string,
 *   getSpell: (id: string) => any,
 * }} opts
 */
export function installMessageWiring({ world, messageLog, playerEntity, bracketizeName, getSpell }) {
  if (!world || !messageLog || typeof playerEntity !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  /** Helper to log a message with type */
  function log(text, type = 'default') {
    if (typeof text === 'object' && text.text) {
      messageLog.log(text);
    } else {
      messageLog.log({ text: String(text), type });
    }
  }

  /** Format helpers for message log */
  function nameOfEntity(id) {
    const pe = playerEntity(world);
    const playerId = pe?.id || 0;
    const n = Number(id || 0);
    if (playerId && n === playerId) return 'You';
    const ni = world.get(n, NamedIdentity);
    const label = ni?.name;
    return label ? bracketizeName(label) : `Entity ${n}`;
  }

  function nameOfItem(id) {
    const n = Number(id || 0);
    const label = resolveItemDisplayName(world, n);
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

  // === Ambient sound events ===
  world.on('ambient:sound', ({ text }) => {
    log(text, 'ambient');
  });

  // === Item events ===
  world.on('drank', ({ actor, itemId, target }) => {
    const who = nameOfEntity(actor);
    const it = nameOfItem(itemId);
    const tgt = nameOfEntity(target || actor);
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

  // === Combat events ===
  world.on('attack:insufficient-stamina', ({ attacker, defender, weaponId, need, have }) => {
    const weaponInfo = world.get(weaponId, ItemInfo);
    const weaponName = weaponInfo ?
      (world.get(weaponId, NamedIdentity)?.name || weaponInfo.description || weaponInfo.type)
      : 'fists';
    log(`Not enough stamina to attack with ${weaponName} (need ${need}, have ${Math.floor(have)}).`, 'combat');
  });

  world.on('damaged', ({ target, amount, critical, crit, source }) => {
    const defName = nameOfEntity(target);
    const critTxt = (critical || crit) ? ' (CRIT!)' : '';
    if (Number(source || 0)) {
      const atkName = nameOfEntity(source);
      let weaponLabel = '';
      const eq = world.get(Number(source || 0), Equipment);
      const wid = Number(eq?.weapon || 0);
      if (wid) {
        const wname = world.get(wid, NamedIdentity)?.name;
        if (wname) weaponLabel = ` with ${bracketizeName(wname)}`;
      } else if (world.has(Number(source || 0), Player)) {
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

    if (world.has(deadId, Pet)) {
      const owner = world.get(deadId, Owner);
      const ownerId = Number(owner?.ownerId || 0) | 0;
      if (playerId > 0 && ownerId === playerId && killerId === playerId) {
        log(`You kill ${who}. The act is unforgivable.`, 'deity');
        return;
      }
    }

    log(`${who} dies.`, 'combat');
  });

  world.on('status', ({ id, kind, text, source }) => {
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
    const ppos = world.get(pe.id, Position);
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
      const inter = world.get(Number(targetId || 0), NamedIdentity);
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
    log('You touch the shrine. A faint warmth pulses through you.', 'system');
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
    const ppos = world.get(pe.id, Position);
    const pos = world.get(Number(id || 0), Position);
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
    if (String(source || '') !== 'scroll_homecoming') return;
    if (Number(targetDepth) !== 0) return;
    const who = nameOfEntity(actor);
    if (who === 'You') {
      log('The scroll turns to warm ash. A familiar pull carries you home.', 'system');
    } else {
      log(`${who} vanishes in a swirl of warm ash.`, 'system');
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
}
