/**
 * Environment, navigation, interaction, deity, pet, companion, trap, weather, calendar wiring.
 * Lines ~325-330, ~1252-1407, ~1493-1683, ~1895-2037, ~2255-2355 from original.
 */
export function installEnvironmentMessages(ctx) {
  const { world, log, nameOfEntity, nameOfItem, bracketizeName, playerEntity,
          compGet, compHas, canSeeAt, resolveAmbientSoundText,
          isFavoredDeityForPlayer, Position, Devotion, NamedIdentity, Status } = ctx;

  function _playerHas(statusType) {
    const pe = playerEntity(world);
    if (!pe?.id || !Status) return false;
    const st = compGet(pe.id, Status);
    return Array.isArray(st?.statuses) && st.statuses.some((s) => s.type === statusType && (Number(s.duration || 0) | 0) > 0);
  }

  // === Ambient sound ===
  world.on('ambient:sound', (ev) => {
    const text = resolveAmbientSoundText(ev);
    if (!text) return;
    log(text, 'ambient');
  });

  // === Prayer events ===
  world.on('prayer', ({ actor, distress }) => {
    const who = nameOfEntity(actor);
    if (distress?.desperate) log(`${who} ${who === 'You' ? 'fall' : 'falls'} to ${who === 'You' ? 'your' : 'their'} knees and ${who === 'You' ? 'beg' : 'begs'} the heavens for mercy!`, 'deity');
    else if (distress?.troubled) log(`${who} ${who === 'You' ? 'clasp your' : 'clasps their'} hands and ${who === 'You' ? 'pray' : 'prays'} for aid...`, 'deity');
    else log(`${who} ${who === 'You' ? 'close your' : 'closes their'} eyes and ${who === 'You' ? 'whisper' : 'whispers'} a prayer.`, 'deity');
  });

  world.on('prayer:insight', ({ actor, deityName, pantheon, desperate, troubled, needs }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const urgency = desperate ? 'desperate' : (troubled ? 'urgent' : 'steady');
    const needText = Array.isArray(needs) && needs.length ? ` Need: ${needs.join(', ')}.` : '';
    log(`${deityName || 'A voice from above'} hears your ${urgency} plea.${needText}`, 'deity');
  });

  world.on('prayer:curse-removed', ({ actor, name }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`Warmth floods through ${bracketizeName(String(name || 'item'))} \u2014 the curse lifts like smoke.`, 'deity');
  });

  world.on('deity:patronShift', ({ playerId, deityName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    log(`The stars shift. ${deityName || 'A new patron'} turns their gaze upon you.`, 'deity');
  });

  world.on('deity:intervention', ({ playerId, deityId, deityName, kind, effect, itemName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    if (!isFavoredDeityForPlayer(playerId, deityId)) return;
    const k = String(kind || 'intervention');
    if (k === 'miracle') return;
    if (k === 'shrine_blessing') { log(`${deityName || 'A presence'} stirs within the shrine and answers.`, 'deity'); return; }
    if (k === 'prayer_uncurse') { log(`${deityName || 'A deity'} reaches down and tears the curse from ${bracketizeName(String(itemName || 'your gear'))}.`, 'deity'); return; }
    if (k === 'patron_shift') { log(`The divine currents shift. ${deityName || 'A new patron'} claims you.`, 'deity'); return; }
    if (k === 'boon') return;
    if (k === 'wrath') log(`${deityName || 'A deity'}'s wrath descends upon you!`, 'deity');
  });

  world.on('deity:boon', ({ actor, deityId, message, boon, amount, removed, uncursed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (!isFavoredDeityForPlayer(actor, deityId)) return;
    const text = String(message || '').trim();
    if (text) { log(text, 'deity'); return; }
    const b = String(boon || 'blessing');
    if (b === 'renewal') { log(`Divine light knits your wounds. (+${Math.max(0, Number(amount || 0) | 0)} HP)`, 'deity'); return; }
    if (b === 'mana_surge') { log(`Power crackles through your veins \u2014 mana restored! (+${Math.max(0, Number(amount || 0) | 0)} MP)`, 'deity'); return; }
    if (b === 'cleanse') { log(`Holy fire scours your body clean. (${Math.max(0, Number(removed || 0) | 0)} afflictions purged, ${Math.max(0, Number(uncursed || 0) | 0)} curses broken)`, 'deity'); return; }
    log('A divine blessing settles over you like warm rain.', 'deity');
  });

  world.on('shrine:combat:scaling', ({ attacker, label, mult, delta }) => {
    if (nameOfEntity(attacker) !== 'You') return;
    const isBoon = mult > 1;
    const pct = Math.abs(Math.round((mult - 1) * 100));
    if (isBoon) {
      log(`The shrine's aura empowers your strike. (+${pct}% damage)`, 'deity');
    } else {
      log(`The shrine's presence saps your strength. (-${pct}% damage)`, 'deity');
    }
  });

  // === Pet events ===
  world.on('pet:deliver', ({ petId, actor, itemId, itemName, count }) => {
    const petName = nameOfEntity(petId);
    const label = itemName ? bracketizeName(itemName) : nameOfItem(itemId);
    log(`${petName} trots up and drops ${label} at your feet. Good ${petName.toLowerCase().includes('wolf') ? 'boy' : 'pet'}.`, 'system');
  });

  world.on('pet:state:changed', ({ petId, prevState, newState, command }) => {
    const petName = nameOfEntity(petId);
    const stateFlav = {
      following: `${petName} falls into step beside you.`,
      staying: `${petName} sits and stays.`,
      guarding: `${petName} plants itself and growls at the shadows.`,
      aggressive: `${petName}'s hackles rise. It's hunting.`,
      fetching: `${petName} darts off after something.`,
      returning: `${petName} turns back toward you.`,
      fleeing: `${petName} tucks tail and bolts!`,
      idle: `${petName} yawns and settles down.`,
    };
    log(stateFlav[newState] || `${petName} is now ${newState}.`, 'system');
  });

  world.on('pet:state:auto', ({ petId, newState, reason }) => {
    const petName = nameOfEntity(petId);
    if (reason === 'low_health') log(`${petName} whimpers and flees to safety!`, 'system');
    else if (reason === 'health_restored') log(`${petName} perks up and returns to your side.`, 'system');
    else if (reason === 'item_picked_up') log(`${petName} has the item! Tail wagging.`, 'system');
  });

  world.on('pet:teleported', ({ petId, from, to }) => {
    log(`${nameOfEntity(petId)} materializes next to you in a flash of light.`, 'system');
  });

  world.on('pet:corpse-munch', ({ petId, corpseName, heal, partial, resistedToxin }) => {
    const petName = nameOfEntity(petId);
    const label = bracketizeName(String(corpseName || 'corpse'));
    const hp = Math.max(0, Number(heal || 0) | 0);
    const keptSome = partial === true;
    let msg = keptSome
      ? `${petName} tears a chunk from ${label}. Crunch.`
      : `${petName} wolfs down ${label} whole. Crunch-crunch.`;
    if (hp > 0) msg += ` (+${hp} HP)`;
    if (resistedToxin === true) msg += ' Iron stomach.';
    log(msg, 'system');
  });

  // === Summoned creature command events ===
  world.on('summon:state:changed', ({ id, prevState, newState, command }) => {
    const name = nameOfEntity(id);
    const stateFlav = {
      following: `${name} drifts after you.`,
      staying: `${name} holds position.`,
      guarding: `${name} stands watch.`,
      aggressive: `${name} surges forward, eager for blood.`,
      fleeing: `${name} retreats to lick its wounds.`,
      idle: `${name} waits.`,
    };
    log(stateFlav[newState] || `${name} is now ${newState}.`, 'system');
  });

  world.on('summon:state:auto', ({ id, newState, reason }) => {
    const name = nameOfEntity(id);
    if (reason === 'low_health') log(`${name} staggers back, badly wounded.`, 'system');
    else if (reason === 'health_restored') log(`${name} recovers and rejoins the fight.`, 'system');
  });

  world.on('summon:teleported', ({ id }) => {
    log(`${nameOfEntity(id)} flickers and reappears at your side.`, 'system');
  });

  // === Environment events ===
  world.on('engrave', ({ actor, text, x, y }) => {
    const who = nameOfEntity(actor);
    if (who === 'You' && _playerHas('blinded')) log(`You scratch something into the stone by feel. You hope it says "${text}".`, 'system');
    else if (who === 'You' && _playerHas('confused')) log(`You scratch "${text}" into the stone. The letters swim before your eyes.`, 'system');
    else log(`${who} scratch${who === 'You' ? '' : 'es'} "${text}" into the stone floor.`, 'system');
  });

  world.on('engrave:scrambled', ({ actor, text, x, y }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    const ppos = compGet(pe.id, Position);
    if (ppos && Math.max(Math.abs(ppos.x - x), Math.abs(ppos.y - y)) <= 10) {
      const who = nameOfEntity(actor);
      log(`${who} scuff${who === 'You' ? '' : 's'} the engraving with ${who === 'You' ? 'your' : 'their'} boot. The words smear.`, 'system');
    }
  });

  world.on('interaction', ({ actor, action, result, items: droppedIds, targetId, epitaph }) => {
    if (action === 'toggleDoor') {
      const actorIsPlayer = nameOfEntity(actor) === 'You';
      const doorPos = compGet(Number(targetId || 0), Position);
      const canPerceiveDoor = !!(doorPos && canSeeAt(doorPos.x, doorPos.y));
      if (!actorIsPlayer && !canPerceiveDoor) return;
      if (result === 'opened') {
        if (_playerHas('blinded')) log('You find the handle by touch. The door creaks open.', 'system');
        else if (_playerHas('confused')) log('You fumble with the door. It creaks open \u2014 you think.', 'system');
        else log('The door creaks open.', 'system');
      }
      else if (result === 'closed') {
        if (_playerHas('blinded')) log('You push the door shut. It clicks. Probably.', 'system');
        else log('The door swings shut with a thud.', 'system');
      }
      else log('The door is locked. It doesn\u2019t budge.', 'system');
    }
    if (action === 'toggleLantern') log(result === 'lit' ? 'You strike the lantern. Warm light spills out.' : 'You snuff the lantern. Darkness closes in.', 'system');
    if (action === 'openChest') log('The lid groans open. Dust rises. Let\u2019s see what\u2019s inside...', 'system');
    if (action === 'readTombstone') {
      if (epitaph) { log('--- TOMBSTONE ---', 'system'); log(epitaph, 'system'); log('----------------', 'system'); }
      else log('Time has worn the inscription smooth. Whatever was written here is gone.', 'system');
    }
    if (action === 'readText') {
      const inter = compGet(Number(targetId || 0), NamedIdentity);
      if (inter?.identity === 'house_sign') log('"Home." You\u2019ve earned the rest. Resupply and prepare for the next descent.', 'system');
      else if (inter?.identity === 'smithy_sign') log('A soot-stained sign reads: "THE BLACK SMITH \u2014 Ore In, Steel Out."', 'system');
      else if (inter?.identity === 'apothecary_sign') log('Neat lettering on glass: "The Apothecary \u2014 Cures, Salves & Things Best Not Named."', 'system');
      else if (inter?.identity === 'gem_shop_sign') log('A polished sign gleams: "Gem Dealer \u2014 Cuts, Settings & Appraisals."', 'system');
      else if (inter?.identity === 'tombstone') log('The weathered stone reads: "Rest eternal, faithful soul."', 'system');
      else log('You squint at the sign and read it.', 'system');
    }
  });

  world.on('bed:rested', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') {
      if (_playerHas('burning')) log('You throw yourself into bed and smother the flames in linen. The aches drain away. Fully restored.', 'system');
      else if (_playerHas('poisoned')) log('You collapse into bed, shivering and sick. Sleep takes you anyway. Fully restored.', 'system');
      else if (_playerHas('confused')) log('You fall into bed \u2014 or the bed falls into you. Either way, rest comes. Fully restored.', 'system');
      else if (_playerHas('bleeding')) log('You collapse into bed. Blood soaks the sheets. Sleep takes you all the same. Fully restored.', 'system');
      else log('You collapse into bed. The aches drain away. Fully restored.', 'system');
    }
    else log(`${nameOfEntity(actor)} stretches out and rests.`, 'system');
  });

  // Room feature events
  world.on('well:drink', ({ actor, amount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (amount > 0) {
      if (_playerHas('burning')) log(`You thrust your hands into the well. Water sizzles against your scorched skin. (+${amount} SP)`, 'system');
      else if (_playerHas('poisoned')) log(`You drink greedily, hoping the clean water will settle your stomach. (+${amount} SP)`, 'system');
      else log(`You cup your hands and drink deep. The water is cold and clean. (+${amount} SP)`, 'system');
    }
    else log('You cup your hands and drink. The water is cold and clean.', 'system');
  });

  world.on('fountain:drink', (ev) => {
    const { actor, effect, amount } = ev;
    if (nameOfEntity(actor) !== 'You') return;
    if (effect === 'heal') {
      if (_playerHas('burning')) log(`You plunge your face into the water. Steam hisses off your skin. (+${amount} HP)`, 'system');
      else if (_playerHas('poisoned')) log(`You drink deep, desperate. The water fights the venom in your gut. (+${amount} HP)`, 'system');
      else log(`You take a sip and feel vigour course through you. (+${amount} HP)`, 'system');
    }
    else if (effect === 'mana') log(`The water tastes faintly of ozone. Magical energy surges into you. (+${amount} MP)`, 'system');
    else if (effect === 'buff') {
      const labels = { lucky: 'Lucky', keen_eye: 'Keen Eye', bear_vigor: "Bear's Vigor" };
      log(`A warm tingle spreads from your stomach to your fingertips. (${labels[ev.buff] || ev.buff})`, 'system');
    }
    else if (effect === 'see_invisible') log('Your eyes sting. The air shimmers. You can see things that aren\u2019t entirely there.', 'system');
    else if (effect === 'gold') log(`Gold coins bubble up from the depths! You fish them out greedily. (+${amount} gold)`, 'system');
    else if (effect === 'curse') {
      if (ev.cursedName) log(`The water is ice-cold. A black aura crawls over your ${ev.cursedName}!`, 'danger');
      else log('The water is ice-cold. You shiver, but nothing else happens.', 'system');
    }
    else if (effect === 'poison') log(`Gah \u2014 the water is foul! You gag and spit. (-${amount} HP)`, 'combat');
    else if (effect === 'creature') {
      if (ev.spawnedName) log(`Something grabs your hand from below! A ${ev.spawnedName} surges out of the fountain!`, 'danger');
      else log('The water churns ominously. Bubbles rise, then stop. Just bubbles. Probably.', 'system');
    }
    else if (effect === 'teleport') log('The water tastes like static. The world lurches and you are elsewhere!', 'danger');
    else if (effect === 'gush') log('The fountain erupts! Water gushes everywhere and the basin crumbles to rubble!', 'danger');
    else if (effect === 'wish') {
      if (ev.wishedItem) log(`A shimmering spirit rises from the depths and presses something into your hands: ${ev.wishedItem}!`, 'system');
      else log('A spirit stirs in the depths... regards you... and sinks back without a word.', 'system');
    }
    else log('You take a sip. The water is stale and tastes faintly of copper.', 'system');
  });

  world.on('fountain:destroyed', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The fountain cracks apart! Water spills across the floor and drains away.', 'danger');
  });
  world.on('fountain:dry', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You bend over the fountain. Dry as bone. Not a drop left.', 'system');
  });

  world.on('fountain:dip', (ev) => {
    const { actor, effect, itemName } = ev;
    if (nameOfEntity(actor) !== 'You') return;
    const name = itemName || 'the item';
    if (effect === 'uncurse') {
      log(`You dip ${name} into the fountain. The dark aura around ${name} lifts \u2014 it glows softly, then the water clears.`, 'system');
    } else if (effect === 'bless') {
      log(`You dip ${name} into the fountain. A warm light rises from the depths and envelops ${name}. It feels hallowed.`, 'system');
    } else if (effect === 'curse') {
      log(`You dip ${name} into the fountain. The water turns dark and cold around ${name}. A malign energy clings to it.`, 'danger');
    } else if (effect === 'rust') {
      const stacks = Number(ev.stacks || 0);
      if (stacks >= 3) log(`You dip ${name} into the fountain. Reddish flakes cloud the water \u2014 ${name} is badly corroded!`, 'danger');
      else log(`You dip ${name} into the fountain. Reddish flakes cloud the water \u2014 ${name} is corroding!`, 'danger');
    } else if (effect === 'blessedResist') {
      log(`You dip ${name} into the fountain. ${name} shimmers with protective light, repelling the water \u2014 but the blessing fades.`, 'system');
    } else if (effect === 'resist') {
      log(`You dip ${name} into the fountain. The water beads off ${name} harmlessly.`, 'system');
    } else if (effect === 'waterlogged') {
      if (ev.ruined) log(`You dip ${name} into the fountain. The ink runs and the pages blur into mush.`, 'danger');
      else log(`You dip ${name} into the fountain. It comes out waterlogged and blotchy.`, 'warning');
    } else if (effect === 'soggy') {
      log(`You dip ${name} into the fountain. It turns soggy and unpleasant.`, 'warning');
    } else if (effect === 'swollen') {
      log(`You dip ${name} into the fountain. The wood swells from absorbed water.`, 'warning');
    } else if (effect === 'diluted') {
      log(`You dip ${name} into the fountain. Its contents look thinned and cloudy.`, 'warning');
    } else if (effect === 'mud') {
      log(`You dip ${name} into the fountain. It slumps into a clump of wet mud.`, 'warning');
    } else if (effect === 'wet') {
      log(`You dip ${name} into the fountain. ${name} comes out dripping wet, but otherwise fine.`, 'system');
    } else if (effect === 'creature') {
      if (ev.spawnedName) {
        log(`You dip ${name} into the fountain. The water churns \u2014 something rises from the depths!`, 'danger');
      } else {
        log(`You dip ${name} into the fountain. Bubbles surge up, then subside.`, 'system');
      }
    } else {
      log(`You dip ${name} into the fountain. The water ripples around ${name}, but nothing happens.`, 'system');
    }
  });

  world.on('altar:pray', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (_playerHas('burning')) log('You drop to your knees, flames still licking your skin, and pray through gritted teeth.', 'deity');
    else if (_playerHas('poisoned')) log('You kneel on cold stone, shaking with fever, and beg the heavens for relief.', 'deity');
    else if (_playerHas('blinded')) log('You kneel on cold stone. Blind, you bow your head and pray by feel alone.', 'deity');
    else if (_playerHas('confused')) log('You kneel \u2014 at least you think you kneel \u2014 and mumble a prayer.', 'deity');
    else log('You kneel on cold stone, bow your head, and pray.', 'deity');
  });
  world.on('altar:offered', ({ actor, deityName, itemName }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You place ${itemName} upon the altar. It shimmers and is consumed by ${deityName}'s light.`, 'deity');
  });
  world.on('altar:offerFailed', ({ actor, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (String(reason || '') === 'not_owned') { log('Your hands are empty. You have nothing to offer.', 'system'); return; }
    log('The altar rejects your offering. The item clatters to the floor.', 'system');
  });

  world.on('bell:rung', () => {
    log('The bell\u2019s iron voice rings across the town \u2014 villagers grab whatever\u2019s sharp and rally!', 'warning');
  });

  world.on('shrine:touch', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const devotion = compGet(Number(actor || 0), Devotion);
    if (devotion?.deityId) return;
    log('You press your palm to the shrine. Stone hums under your fingers \u2014 faint, but alive.', 'system');
  });

  world.on('shrine:communion', ({ actor, deityName, effect, cooldownRemaining }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (effect === 'blessing') { log(`${deityName || 'The deity'} stirs within the shrine. You feel seen. A blessing settles over you.`, 'deity'); return; }
    if (effect === 'cooldown') {
      const turns = Math.max(1, Number(cooldownRemaining || 1) | 0);
      log(`${deityName || 'The deity'} is distant. The shrine is cool to the touch. (${turns} turns)`, 'deity');
      return;
    }
    log('The shrine is cold. Silent. No one answers.', 'system');
  });

  world.on('deity:gift:fluorite', ({ playerId, deityName }) => {
    if (nameOfEntity(playerId) !== 'You') return;
    log(`${deityName || 'A divine presence'} is pleased. A phosphorescent stone materializes at your feet.`, 'deity');
  });

  world.on('mushroom:hallucinate', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (_playerHas('hallucinating')) log('Another mushroom. The walls were already breathing \u2014 now they\u2019re screaming.', 'danger');
    else if (_playerHas('confused')) log('The mushroom cap tastes like... what was it? The walls are doing something. Rage fills you. Maybe.', 'danger');
    else log('The mushroom cap tastes like wet dirt and lightning. The walls start breathing. Rage fills you.', 'danger');
  });

  world.on('deathlog:open', () => {
    log('You crack open the Book of the Dead. The pages are warm to the touch.', 'system');
    window.dispatchEvent(new CustomEvent('ui:openDeathLog'));
  });

  world.on('book:open', ({ title, text }) => {
    log(`You open ${title || 'a book'} and begin to read...`, 'system');
    window.dispatchEvent(new CustomEvent('ui:openBookReader', { detail: { title, text } }));
  });

  world.on('stair:traverse', ({ actor, targetId, direction }) => {
    if (direction === 'down') {
      if (_playerHas('blinded')) log('You feel for the edge with your boot and descend, step by careful step.', 'system');
      else if (_playerHas('confused')) log('You stumble down the stairs. Was it up you wanted? Too late now.', 'system');
      else if (_playerHas('burning')) log('You hurl yourself down the stairs, trailing smoke and embers.', 'system');
      else if (_playerHas('poisoned')) log('You descend, one hand on the wall, stomach churning with every step.', 'system');
      else log('You descend. The air grows colder. The dark grows thicker.', 'system');
    } else {
      if (_playerHas('blinded')) log('You grope upward, counting steps by feel. Light means nothing to you now.', 'system');
      else if (_playerHas('confused')) log('You stagger upward. The stairs seem to twist under your feet.', 'system');
      else if (_playerHas('burning')) log('You scramble up the stairs, desperate for open air. Smoke trails behind you.', 'system');
      else if (_playerHas('poisoned')) log('You drag yourself upward, pausing twice to retch against the wall.', 'system');
      else log('You climb the stairs. Light and warmth beckon above.', 'system');
    }
  });

  world.on('portal:spawned', ({ portalId, at }) => {
    log('The air tears open in a ring of blue light \u2014 a return portal!', 'system');
  });
  world.on('portal:return', ({ actor }) => {
    const who = nameOfEntity(actor);
    if (who === 'You') {
      if (_playerHas('blinded')) log('You step forward into something that isn\u2019t air. Reality folds around you.', 'system');
      else if (_playerHas('confused')) log('You lurch into the portal \u2014 or it lurches into you. Reality folds.', 'system');
      else log('You step into the portal. Reality folds around you.', 'system');
    }
    else log(`${who} steps into the portal and vanishes.`, 'system');
  });
  world.on('portal:return:fragged', ({ count, at }) => {
    const n = Math.max(0, Number(count || 0) | 0);
    if (n > 0) log(`The arrival shockwave tears through ${n} ${n === 1 ? 'creature' : 'creatures'} that were standing in the spot!`, 'combat');
  });

  world.on('dungeon:teleport-depth', ({ actor, targetDepth, source }) => {
    if (Number(targetDepth) !== 0) return;
    const src = String(source || '');
    const who = nameOfEntity(actor);
    if (src === 'scroll_homecoming') {
      if (who === 'You') log('The scroll crumbles to warm ash in your hands. The dungeon melts away \u2014 you\u2019re going home.', 'system');
      else log(`${who} vanishes in a swirl of warm ash.`, 'system');
    } else if (src === 'hearthstone') {
      if (who === 'You') log('The hearthstone pulses against your chest. The world blurs. You\u2019re pulled home.', 'system');
      else log(`${who} vanishes in a pulse of hearthlight.`, 'system');
    }
  });

  // Dig events
  world.on('tile:dug', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} ${who === 'You' ? 'swing your' : 'swings a'} pickaxe into the wall \u2014 stone crumbles!`, 'system');
  });
  world.on('tile:chopped', ({ actor, x, y }) => {
    const who = nameOfEntity(actor);
    log(`${who} ${who === 'You' ? 'bury your' : 'buries an'} axe into the trunk. The tree groans and falls.`, 'system');
  });

  // NPC / quest events
  world.on('npc:dialogue', ({ text }) => { log(text, 'info'); });
  world.on('quest:started', ({ title }) => { log(`New quest: "${String(title || 'Quest')}."`, 'system'); });
  world.on('quest:advanced', ({ objective }) => {
    const text = String(objective || '').trim();
    if (text) log(`Objective: ${text}`, 'system');
  });
  world.on('quest:completed', ({ title }) => { log(`Quest complete: "${String(title || 'Quest')}." Well done.`, 'system'); });

  // Burn events
  world.on('tile:burned', ({ actor, x, y, burnedKind }) => {
    if (!canSeeAt(x, y)) return;
    const kind = String(burnedKind || 'tree');
    const { hasNamedEntity, burnVerb } = ctx;
    if (!hasNamedEntity(actor)) {
      if (kind === 'wall') log('The wall catches \u2014 mortar cracks, stones split, and the whole section burns open.', 'system');
      else if (kind === 'door') log('The door catches fire and burns off its hinges in seconds.', 'system');
      else if (kind === 'fence') log('Dry fence posts go up like kindling.', 'system');
      else if (kind === 'roof') log('Sparks catch the roofing \u2014 flames eat through the thatch.', 'system');
      else log('The tree catches fire. Bark peels back, branches crack, and it collapses to ash.', 'system');
      return;
    }
    const who = nameOfEntity(actor);
    if (kind === 'wall') log(`${who} ${burnVerb(who)} a hole clean through the wall.`, 'system');
    else if (kind === 'door') log(`${who} ${burnVerb(who)} the door off its hinges.`, 'system');
    else if (kind === 'fence') log(`${who} ${burnVerb(who)} the fence to charcoal.`, 'system');
    else if (kind === 'roof') log(`${who} ${burnVerb(who)} through the roof above.`, 'system');
    else log(`${who} ${burnVerb(who)} the tree. It collapses in a shower of embers.`, 'system');
  });

  world.on('entity:burned', ({ actor, x, y, name, identity }) => {
    if (!canSeeAt(x, y)) return;
    const label = bracketizeName(name || identity || 'thing');
    const { hasNamedEntity, burnVerb } = ctx;
    if (!hasNamedEntity(actor)) { log(`${label} catches fire and goes up in seconds.`, 'system'); return; }
    const who = nameOfEntity(actor);
    log(`${who} ${burnVerb(who)} ${label} to cinders.`, 'system');
  });

  // === Trap events ===
  world.on('trap:avoided', ({ victimId, trapId, type }) => {
    const trapFlav = {
      spike: 'You see the spikes just in time \u2014 you leap clear!',
      snake: 'A serpent lunges from a hidden pit \u2014 you jerk your foot back!',
      shock: 'Sparks crackle underfoot \u2014 you jump away before the circuit closes!',
      pit: 'The floor gives way \u2014 you catch the edge and haul yourself back!',
      siphon: 'A chill pulls at your soul \u2014 you wrench free before it takes hold!',
      rust: 'Orange dust puffs from a hidden plate \u2014 you shield your gear just in time!',
      swarm: 'Insects boil from a cracked tile \u2014 you stomp backward before they reach you!',
    };
    if (_playerHas('blinded')) log('Something feels wrong underfoot \u2014 you throw yourself sideways on instinct!', 'info');
    else log(trapFlav[type] || 'You spot the trap and nimbly dodge it!', 'info');
  });
  world.on('trap:disarmed', ({ actor, trapType }) => {
    const trapFlav = {
      spike: 'You wedge the spike mechanism open. It won\u2019t fire again.',
      snake: 'You pin the serpent with a boot and snap the trigger.',
      shock: 'You ground the electrodes. The sparking stops.',
      pit: 'You jam the trapdoor shut with a rock.',
      siphon: 'You crack the sigil stone. The siphon goes dark.',
      rust: 'You scrape the corrosive powder into a harmless pile.',
      swarm: 'You crush the nest before anything hatches.',
    };
    log(trapFlav[trapType] || 'You carefully disarm the trap.', 'info');
  });
  world.on('trap:disarm:failed', ({ actor, trapType }) => {
    const trapNames = { spike: "Spike Trap", snake: "Snake Trap", shock: "Shock Trap", pit: "Pit Trap", siphon: "Siphon Trap", rust: "Rust Trap", swarm: "Swarm Trap" };
    log(`Your fingers slip on the ${trapNames[trapType] || 'trap'} mechanism \u2014 CLICK! It triggers!`, 'danger');
  });
  world.on('trap:pit:fall', ({ targetId }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== (Number(targetId) | 0)) return;
    log('The floor gives way \u2014 you plunge into darkness!', 'danger');
  });
  world.on('trap:gas_explosion', () => {
    log('The gas pocket ignites \u2014 BOOM! A fireball fills the corridor!', 'danger');
  });
  world.on('trap:gas', () => {
    log('Noxious green gas hisses from the trap and fills the air!', 'warning');
  });

  // === Weather events ===
  world.on('weather:changed', ({ weather, prev }) => {
    const blind = _playerHas('blinded');
    const deaf = _playerHas('deafened');
    if (weather === 'rain') {
      if (blind && deaf) log('Cold drops strike your face. Something has changed in the air.', 'ambient');
      else if (blind) log('Cold drops strike your face. The sound of rain rises around you.', 'ambient');
      else if (deaf) log('Dark clouds roll in. Rain begins to fall, though you hear nothing.', 'ambient');
      else log('Dark clouds roll in. Rain begins to fall, pattering against stone.', 'ambient');
    }
    else if (weather === 'heavy_rain') {
      if (blind) log('The rain hammers your skin now. The world is nothing but cold water and noise.', 'ambient');
      else if (deaf) log('The sky opens up. Rain hammers down in sheets \u2014 you feel the impacts but hear nothing.', 'ambient');
      else log('The sky opens up. Rain hammers down in sheets \u2014 you can barely see.', 'ambient');
    }
    else if (weather === 'clear' && (prev === 'rain' || prev === 'heavy_rain')) {
      if (blind) log('The rain stops. Your skin dries in what might be sunlight.', 'ambient');
      else log('The rain eases. Puddles glint in the returning light.', 'ambient');
    }
  });
  world.on('weather:extinguish', ({ kind }) => {
    if (kind === 'player') log('The downpour douses the flames on you. Steam rises from your scorched skin.', 'info');
    else if (kind === 'structure') log('Rain snuffs out a nearby fire. Smoke curls upward.', 'ambient');
  });
  world.on('weather:lightning', ({ x, y, hitTree, hitWater, hitCount, hitPlayer }) => {
    const blind = _playerHas('blinded');
    const deaf = _playerHas('deafened');
    if ((hitCount | 0) > 0) {
      if (blind && deaf) log('Heat sears the air beside you \u2014 something struck close!', 'danger');
      else if (blind) log('CRACK! Thunder splits the air \u2014 something was hit!', 'danger');
      else if (deaf) log('A bolt of lightning hammers down! You feel the impact through the ground.', 'danger');
      else log('CRACK! A bolt of lightning hammers down!', 'danger');
    }
    else if (hitTree) {
      if (blind) log('You hear wood splinter and crash \u2014 a tree struck by lightning!', 'system');
      else log('Lightning forks down and splits a tree in two!', 'system');
    }
    else if (hitWater) {
      if (blind) log('A sharp hiss of steam \u2014 lightning hit water somewhere close.', 'system');
      else log('Lightning strikes the water \u2014 the surface flashes white!', 'system');
    }
    else {
      if (blind && deaf) log('The hair on your arms stands up. The air smells of ozone.', 'system');
      else if (blind) log('Thunder cracks nearby. The smell of scorched earth fills the air.', 'system');
      else if (deaf) log('Lightning stabs the ground nearby. You feel the vibration in your bones.', 'system');
      else log('Lightning stabs the ground nearby. Thunder rolls.', 'system');
    }
    if (hitPlayer) {
      if (blind) { log('*** HEAT LIKE A FORGE ***', 'danger'); log('*** your whole body seizes ***', 'danger'); }
      else { log('*** BLINDING WHITE ***', 'danger'); log('*** your ears ring like a struck bell ***', 'danger'); }
    }
  });
  world.on('shock_trap:sensory', ({ target }) => {
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    if (!(playerId > 0) || (Number(target || 0) | 0) !== playerId) return;
    log('*** BLINDING WHITE ***', 'danger');
    log('*** your ears ring like a struck bell ***', 'danger');
  });

  // === Calendar events ===
  world.on('calendar:newDay', ({ next }) => { /* quiet */ });
  world.on('calendar:newMonth', ({ name }) => { log(`The month turns. ${name} begins.`, 'ambient'); });
  world.on('calendar:newSeason', ({ next }) => {
    const label = next.charAt(0).toUpperCase() + next.slice(1);
    const flavors = { Spring: 'The air softens. Buds appear.', Summer: 'Heat settles over the land.', Autumn: 'Leaves turn. The wind carries a chill.', Winter: 'Frost creeps across every surface.' };
    log(`${label} has arrived. ${flavors[label] || ''}`, 'ambient');
  });
  world.on('calendar:newYear', ({ next }) => { log(`A new year dawns \u2014 Year ${next}. The world turns.`, 'ambient'); });
}
