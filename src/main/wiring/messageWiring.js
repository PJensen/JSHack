import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
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

  world.on('died', ({ id }) => {
    const who = nameOfEntity(id);
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

  world.on('harvest:picked', ({ actor, kind, count, itemId }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const nodeLabel = String(kind || '') === 'herbs' ? 'herbs' : 'berries';
    const itemLabel = itemId ? nameOfItem(itemId) : bracketizeName(nodeLabel);
    log(`You harvest ${count} ${nodeLabel} (${itemLabel}).`, 'system');
  });

  world.on('harvest:empty', ({ actor, kind, regrowCountdown }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const nodeLabel = String(kind || '') === 'herbs' ? 'herb patch' : 'berry bush';
    const left = Math.max(0, Number(regrowCountdown || 0) | 0);
    if (left > 0) log(`The ${nodeLabel} is picked clean. (${left} turns to regrow)`, 'system');
    else log(`The ${nodeLabel} has nothing ready right now.`, 'system');
  });

  world.on('harvest:regrown', ({ id, kind }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    const ppos = world.get(pe.id, Position);
    const pos = world.get(Number(id || 0), Position);
    if (!ppos || !pos) return;
    const dist = Math.max(Math.abs(ppos.x - pos.x), Math.abs(ppos.y - pos.y));
    if (dist > 6) return;
    const what = String(kind || '') === 'herbs' ? 'A herb patch looks fresh again.' : 'A berry bush ripens nearby.';
    log(what, 'ambient');
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

  // === Dig events ===
  world.on('tile:dug', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} dig${who === 'You' ? '' : 's'} through the wall.`, 'system');
  });

  // === Apply events ===
  world.on('item:applied', ({ targetId, result }) => {
    if (!result) return;
    if (result.type === 'touchstone') {
      const targetName = nameOfItem(targetId) || result.appearance || 'gem';
      if (result.hardness === 'hard') {
        log(`You rub ${targetName} on the touchstone... it makes a hard white streak!`, 'system');
      } else {
        log(`You rub ${targetName} on the touchstone... it leaves a dull scratch.`, 'system');
      }
    } else if (result.type === 'nothing') {
      log(`Nothing happens.`, 'system');
    }
  });

  // === Identification events ===
  world.on('item:identified', ({ identity, name, appearance, category }) => {
    const displayName = bracketizeName(name);
    log(`You identify the ${appearance}: it's ${displayName}!`, 'system');
    // Trigger inventory refresh so names update immediately
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
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
}
