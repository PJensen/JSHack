/**
 * Environment, navigation, interaction, deity, pet, companion, trap, weather, calendar wiring.
 * Lines ~325-330, ~1252-1407, ~1493-1683, ~1895-2037, ~2255-2355 from original.
 */
export function installEnvironmentMessages(ctx) {
  const { world, log, nameOfEntity, nameOfItem, bracketizeName, playerEntity,
          compGet, compHas, canSeeAt, resolveAmbientSoundText,
          isFavoredDeityForPlayer, Position, Devotion, NamedIdentity } = ctx;

  // === Ambient sound ===
  world.on('ambient:sound', (ev) => {
    const text = resolveAmbientSoundText(ev);
    if (!text) return;
    log(text, 'ambient');
  });

  // === Prayer events ===
  world.on('prayer', ({ actor, distress }) => {
    const who = nameOfEntity(actor);
    if (distress?.desperate) log(`${who} desperately prays for divine intervention!`, 'deity');
    else if (distress?.troubled) log(`${who} prays for aid...`, 'deity');
    else log(`${who} prays to the heavens...`, 'deity');
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
    log(`Divine grace lifts a curse from ${bracketizeName(String(name || 'item'))}.`, 'deity');
  });

  world.on('deity:patronShift', ({ playerId, deityName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    log(`The pantheon shifts \u2014 ${deityName || 'a new patron'} now answers you most strongly.`, 'deity');
  });

  world.on('deity:intervention', ({ playerId, deityId, deityName, kind, effect, itemName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    if (!isFavoredDeityForPlayer(playerId, deityId)) return;
    const k = String(kind || 'intervention');
    if (k === 'miracle') return;
    if (k === 'shrine_blessing') { log(`${deityName || 'A deity'} answers from the shrine.`, 'deity'); return; }
    if (k === 'prayer_uncurse') { log(`${deityName || 'A deity'} lifts the curse from ${bracketizeName(String(itemName || 'your gear'))}.`, 'deity'); return; }
    if (k === 'patron_shift') { log(`Divine currents realign around ${deityName || 'a new patron'}.`, 'deity'); return; }
    if (k === 'boon') return;
    if (k === 'wrath') log(`${deityName || 'A deity'}'s intervention is wrathful.`, 'deity');
  });

  world.on('deity:boon', ({ actor, deityId, message, boon, amount, removed, uncursed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (!isFavoredDeityForPlayer(actor, deityId)) return;
    const text = String(message || '').trim();
    if (text) { log(text, 'deity'); return; }
    const b = String(boon || 'blessing');
    if (b === 'renewal') { log(`Divine renewal restores you (+${Math.max(0, Number(amount || 0) | 0)} HP).`, 'deity'); return; }
    if (b === 'mana_surge') { log(`A mana surge fills you (+${Math.max(0, Number(amount || 0) | 0)} MP).`, 'deity'); return; }
    if (b === 'cleanse') { log(`You are cleansed (${Math.max(0, Number(removed || 0) | 0)} afflictions, ${Math.max(0, Number(uncursed || 0) | 0)} curses removed).`, 'deity'); return; }
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
    const stateNames = { following: 'following you', staying: 'staying put', guarding: 'guarding', aggressive: 'aggressive', fetching: 'fetching an item', returning: 'returning', fleeing: 'fleeing', idle: 'idle' };
    log(`${petName} is now ${stateNames[newState] || newState}.`, 'system');
  });

  world.on('pet:state:auto', ({ petId, newState, reason }) => {
    const petName = nameOfEntity(petId);
    if (reason === 'low_health') log(`${petName} flees to safety!`, 'system');
    else if (reason === 'health_restored') log(`${petName} returns to your side.`, 'system');
    else if (reason === 'item_picked_up') log(`${petName} has the item!`, 'system');
  });

  world.on('pet:teleported', ({ petId, from, to }) => {
    log(`${nameOfEntity(petId)} teleports to your side.`, 'system');
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

  // === Summoned creature command events ===
  world.on('summon:state:changed', ({ id, prevState, newState, command }) => {
    const stateNames = { following: 'following you', staying: 'staying put', guarding: 'guarding', aggressive: 'aggressive', fleeing: 'fleeing', idle: 'idle' };
    log(`${nameOfEntity(id)} is now ${stateNames[newState] || newState}.`, 'system');
  });

  world.on('summon:state:auto', ({ id, newState, reason }) => {
    const name = nameOfEntity(id);
    if (reason === 'low_health') log(`${name} retreats!`, 'system');
    else if (reason === 'health_restored') log(`${name} returns to the fight.`, 'system');
  });

  world.on('summon:teleported', ({ id }) => {
    log(`${nameOfEntity(id)} reappears near you.`, 'system');
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
    if (ppos && Math.max(Math.abs(ppos.x - x), Math.abs(ppos.y - y)) <= 10) {
      const who = nameOfEntity(actor);
      log(`${who} scuff${who === 'You' ? '' : 's'} the engraving underfoot.`, 'system');
    }
  });

  world.on('interaction', ({ action, result, items: droppedIds, targetId, epitaph }) => {
    if (action === 'toggleDoor') log(`The door ${result === 'opened' ? 'opens' : (result === 'closed' ? 'closes' : 'is locked')}.`, 'system');
    if (action === 'toggleLantern') log(result === 'lit' ? 'You light the lantern.' : 'You extinguish the lantern.', 'system');
    if (action === 'openChest') log('You open the chest!', 'system');
    if (action === 'readTombstone') {
      if (epitaph) { log('--- TOMBSTONE ---', 'system'); log(epitaph, 'system'); log('----------------', 'system'); }
      else log('The tombstone inscription has faded...', 'system');
    }
    if (action === 'readText') {
      const inter = compGet(Number(targetId || 0), NamedIdentity);
      if (inter?.identity === 'house_sign') log('Home sweet home. Rest, gather, and prepare for another descent.', 'system');
      else if (inter?.identity === 'smithy_sign') log('The Black Smith \u2014 ore deliveries welcome.', 'system');
      else if (inter?.identity === 'apothecary_sign') log('The Apothecary \u2014 potions, salves, and remedies.', 'system');
      else if (inter?.identity === 'gem_shop_sign') log('Gem Dealer \u2014 identified stones, socketables, and fine cuts.', 'system');
      else if (inter?.identity === 'tombstone') log('The weathered inscription reads: "Rest eternal, faithful soul."', 'system');
      else log('You read the sign.', 'system');
    }
  });

  world.on('bed:rested', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') log('You rest in your bed and feel fully restored.', 'system');
    else log(`${nameOfEntity(actor)} rests for a while.`, 'system');
  });

  // Room feature events
  world.on('well:drink', ({ actor, amount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (amount > 0) log(`You draw cool water from the well. (+${amount} SP)`, 'system');
    else log('You draw water from the well. You feel refreshed.', 'system');
  });

  world.on('fountain:drink', (ev) => {
    const { actor, effect, amount } = ev;
    if (nameOfEntity(actor) !== 'You') return;
    if (effect === 'heal') log(`You drink from the fountain and feel refreshed. (+${amount} HP)`, 'system');
    else if (effect === 'mana') log(`You drink from the fountain. Magical energy surges through you. (+${amount} MP)`, 'system');
    else if (effect === 'buff') {
      const labels = { lucky: 'Lucky', keen_eye: 'Keen Eye', bear_vigor: "Bear's Vigor" };
      log(`You drink from the fountain. A warm tingle spreads through you. (${labels[ev.buff] || ev.buff})`, 'system');
    }
    else if (effect === 'see_invisible') log('You drink from the fountain. Your eyes tingle \u2014 you can perceive the unseen!', 'system');
    else if (effect === 'gold') log(`Gold coins bubble up from the fountain depths! (+${amount} gold)`, 'system');
    else if (effect === 'curse') {
      if (ev.cursedName) log(`You drink from the fountain. A black aura envelops your ${ev.cursedName}!`, 'danger');
      else log('You drink from the fountain. You feel a chill, but nothing happens.', 'system');
    }
    else if (effect === 'poison') log(`You drink from the fountain. It was contaminated! (-${amount} HP)`, 'combat');
    else if (effect === 'creature') {
      if (ev.spawnedName) log(`Something emerges from the fountain! A ${ev.spawnedName} appears!`, 'danger');
      else log('You drink from the fountain. The water churns ominously, then settles.', 'system');
    }
    else if (effect === 'teleport') log('You drink from the fountain. The world spins and you are elsewhere!', 'danger');
    else if (effect === 'gush') log('The fountain erupts! Water gushes everywhere as the fountain crumbles!', 'danger');
    else if (effect === 'wish') {
      if (ev.wishedItem) log(`A shimmering spirit rises from the fountain depths and grants you a boon: ${ev.wishedItem}!`, 'system');
      else log('A spirit stirs in the depths... but the waters fall still.', 'system');
    }
    else log('You drink from the fountain. The water is stale.', 'system');
  });

  world.on('fountain:destroyed', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The fountain is destroyed!', 'danger');
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
    if (String(reason || '') === 'not_owned') { log('You are no longer carrying that offering.', 'system'); return; }
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
    if (effect === 'blessing') { log(`${deityName || 'Your deity'} acknowledges your devotion at the shrine.`, 'deity'); return; }
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
      if (who === 'You') log('The scroll turns to warm ash. A familiar pull carries you home.', 'system');
      else log(`${who} vanishes in a swirl of warm ash.`, 'system');
    } else if (src === 'hearthstone') {
      if (who === 'You') log('The hearthstone pulses with warmth. You are pulled home.', 'system');
      else log(`${who} vanishes in a pulse of hearthlight.`, 'system');
    }
  });

  // Dig events
  world.on('tile:dug', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} dig${who === 'You' ? '' : 's'} through the wall.`, 'system');
  });
  world.on('tile:chopped', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} chop${who === 'You' ? '' : 's'} down the tree.`, 'system');
  });

  // NPC / quest events
  world.on('npc:dialogue', ({ text }) => { log(text, 'info'); });
  world.on('quest:started', ({ title }) => { log(`Quest started: ${String(title || 'Quest')}.`, 'system'); });
  world.on('quest:advanced', ({ objective }) => {
    const text = String(objective || '').trim();
    if (text) log(`Objective updated: ${text}`, 'system');
  });
  world.on('quest:completed', ({ title }) => { log(`Quest completed: ${String(title || 'Quest')}.`, 'system'); });

  // Burn events
  world.on('tile:burned', ({ actor, x, y, burnedKind }) => {
    if (!canSeeAt(x, y)) return;
    const kind = String(burnedKind || 'tree');
    const { hasNamedEntity, burnVerb } = ctx;
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
    const { hasNamedEntity, burnVerb } = ctx;
    if (!hasNamedEntity(actor)) { log(`${label} goes up in sparks.`, 'system'); return; }
    const who = nameOfEntity(actor);
    log(`${who} ${burnVerb(who)} ${label} to cinders.`, 'system');
  });

  // === Trap events ===
  world.on('trap:avoided', ({ victimId, trapId, type }) => {
    const trapNames = { spike: "Spike Trap", snake: "Snake Trap", shock: "Shock Trap", pit: "Pit Trap", siphon: "Siphon Trap", rust: "Rust Trap", swarm: "Swarm Trap" };
    log(`You nimbly dodge the ${trapNames[type] || 'trap'}!`, 'info');
  });
  world.on('trap:disarmed', ({ actor, trapType }) => {
    const trapNames = { spike: "Spike Trap", snake: "Snake Trap", shock: "Shock Trap", pit: "Pit Trap", siphon: "Siphon Trap", rust: "Rust Trap", swarm: "Swarm Trap" };
    log(`You carefully disarm the ${trapNames[trapType] || 'trap'}.`, 'info');
  });
  world.on('trap:disarm:failed', ({ actor, trapType }) => {
    const trapNames = { spike: "Spike Trap", snake: "Snake Trap", shock: "Shock Trap", pit: "Pit Trap", siphon: "Siphon Trap", rust: "Rust Trap", swarm: "Swarm Trap" };
    log(`You fumble the ${trapNames[trapType] || 'trap'} \u2014 it triggers!`, 'danger');
  });
  world.on('trap:gas_explosion', () => {
    log('The gas ignites \u2014 BOOM! A fiery explosion engulfs the area!', 'danger');
  });
  world.on('trap:gas', () => {
    log('A cloud of noxious gas billows from the trap!', 'warning');
  });

  // === Weather events ===
  world.on('weather:changed', ({ weather, prev }) => {
    if (weather === 'rain') log('Rain begins to fall.', 'info');
    else if (weather === 'heavy_rain') log('The rain intensifies into a downpour.', 'info');
    else if (weather === 'clear' && (prev === 'rain' || prev === 'heavy_rain')) log('The rain lets up.', 'info');
  });
  world.on('weather:extinguish', ({ kind }) => {
    if (kind === 'player') log('The rain douses the flames on you.', 'info');
    else if (kind === 'structure') log('The rain puts out a fire.', 'ambient');
  });
  world.on('weather:lightning', ({ x, y, hitTree, hitWater, hitCount, hitPlayer }) => {
    if ((hitCount | 0) > 0) log('A bolt of lightning strikes!', 'danger');
    else if (hitTree) log('Lightning splinters a nearby tree!', 'system');
    else if (hitWater) log('Lightning crackles across the water!', 'system');
    else log('Lightning strikes the ground nearby!', 'system');
    if (hitPlayer) {
      log('*** a flash of light! ***', 'danger');
      log('*** ringing fills your ears! ***', 'danger');
    }
  });
  world.on('shock_trap:sensory', ({ target }) => {
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    if (!(playerId > 0) || (Number(target || 0) | 0) !== playerId) return;
    log('*** a flash of light! ***', 'danger');
    log('*** ringing fills your ears! ***', 'danger');
  });

  // === Calendar events ===
  world.on('calendar:newDay', ({ next }) => { /* quiet */ });
  world.on('calendar:newMonth', ({ name }) => { log(`The month of ${name} begins.`, 'system'); });
  world.on('calendar:newSeason', ({ next }) => {
    const label = next.charAt(0).toUpperCase() + next.slice(1);
    log(`${label} has arrived.`, 'system');
  });
  world.on('calendar:newYear', ({ next }) => { log(`A new year dawns \u2014 Year ${next}.`, 'system'); });
}
