/**
 * Item pickup, equip, drink, potion, scroll, wand, corpse-trait, food wiring.
 * Lines ~332-376, ~1408-1492, ~1685-1739, ~2070-2137, ~2431-2479 from original.
 */
export function installItemMessages(ctx) {
  const { world, log, nameOfEntity, nameOfItem, bracketizeName, richEntity, playerEntity,
          compGet, compHas, canSeeAt, ItemInfo, NamedIdentity, Position, Player, Pet, Owner, Devotion, Encumbrance } = ctx;

  function logPickupEvent({ actor, itemId, count }) {
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    const actorId = Number(actor || 0) | 0;

    if (playerId > 0 && actorId === playerId) {
      // Player pickup — show item with weight/encumbrance context
      const rich = richEntity ? richEntity(itemId) : null;
      const it = rich ? rich : { text: nameOfItem(itemId) };
      const info = compGet(itemId, ItemInfo);
      const w = Number(info?.weight || 0);
      const c = Math.max(1, Number(count ?? info?.count ?? 1) | 0);
      let suffix = '';
      if (w > 0) suffix = ` (${c > 1 ? w + ' kg \u00d7' + c + ' = ' + (w * c).toFixed(1) + ' kg' : w + ' kg'})`;
      const enc = Encumbrance ? compGet(playerId, Encumbrance) : null;
      let warning = '';
      if (enc?.overloaded) warning = ' You are overloaded!';
      else if (enc?.heavilyLoaded) warning = ' Your pack is getting heavy.';
      const text = `You pick up ${it.text}${suffix}.${warning}`;
      const html = it.html ? `You pick up ${it.html}${suffix}.${warning}` : undefined;
      log({ text, html, type: warning ? 'warning' : 'system' });
      return;
    }

    // Non-player pickup — only if visible
    const pos = compGet(actorId, Position);
    if (!pos || !canSeeAt(pos.x, pos.y)) return;
    const pickerName = nameOfEntity(actor);
    const it = nameOfItem(itemId);
    log(`${pickerName} picks up ${it}.`, 'system');
  }

  // === Item events ===
  world.on('drank', ({ actor, itemId, target, feel, identified }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target || actor);
    if (identified === false && feel) {
      if (who === 'You') log(`You drink an unknown vial. ${feel}`, 'system');
      else log(`${who} drinks an unknown vial.`, 'system');
      return;
    }
    const it = nameOfItem(itemId);
    if (tgt === 'You' && who === 'You') log(`You drink ${it}.`, 'system');
    else if (who === tgt) log(`${who} drinks ${it}.`, 'system');
    else log(`${who} uses ${it} on ${tgt}.`, 'system');
  });

  world.on('item:pickup', ({ actor, itemId, count }) => {
    logPickupEvent({ actor, itemId, count });
  });

  // Legacy pickup event compatibility: { id, itemId, at }
  world.on('pickup', ({ id, itemId, count }) => {
    const info = compGet(itemId, ItemInfo);
    const resolvedCount = Number(count ?? info?.count ?? 1) | 0;
    logPickupEvent({ actor: id, itemId, count: resolvedCount });
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

  world.on('item:reacted', ({ itemId, ownerId, scope, result, source }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    const playerId = Number(pe.id || 0) | 0;
    const src = Number(source || 0) | 0;
    if (scope === 'inventory' && Number(ownerId || 0) !== playerId) return;
    if (scope !== 'inventory' && src > 0 && src !== playerId) return;

    const name = bracketizeName(nameOfItem(itemId));
    const kind = String(result || "");
    if (kind === "waterlogged") {
      log(`${name} is waterlogged.`, 'warning');
    } else if (kind === "soggy") {
      log(`${name} turns soggy.`, 'warning');
    } else if (kind === "swollen") {
      log(`${name} swells from moisture.`, 'warning');
    } else if (kind === "diluted") {
      log(`${name} is diluted.`, 'warning');
    } else if (kind === "blessed") {
      log(`${name} glows with a soft golden light!`, 'system');
    } else if (kind === "uncursed") {
      log(`The black aura fades from ${name}.`, 'system');
    } else if (kind === "cursed") {
      log(`${name} is surrounded by a dark aura!`, 'danger');
    }
  });

  world.on('item:destroyed:element', ({ target, itemId, itemName, element, verb }) => {
    const pe = playerEntity(world);
    if (!pe || Number(target || 0) !== pe.id) return;
    const label = bracketizeName(String(itemName || nameOfItem(itemId)));
    log(`Your ${label} ${verb}!`, 'danger');
  });

  world.on('item:ruinedByWater', ({ actor, itemId }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== Number(pe.id || 0)) return;
    log(`${bracketizeName(nameOfItem(itemId))} disintegrates when you try to use it.`, 'danger');
  });

  world.on('item:dilutedFizzle', ({ actor, itemId }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== Number(pe.id || 0)) return;
    log(`${bracketizeName(nameOfItem(itemId))} fizzles uselessly.`, 'warning');
  });

  world.on('item:swollenMisfire', ({ actor, itemId }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== Number(pe.id || 0)) return;
    log(`${bracketizeName(nameOfItem(itemId))} sputters and misfires.`, 'warning');
  });

  world.on('item:soggyNutritionPenalty', ({ actor, itemId }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== Number(pe.id || 0)) return;
    log(`${bracketizeName(nameOfItem(itemId))} is soggy and less nourishing.`, 'system');
  });

  // === Corpse events ===
  world.on('corpse:desecrated', ({ actor, ownerId, corpseName }) => {
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    const actorId = Number(actor || 0) | 0;
    if (!(playerId > 0) || actorId !== playerId) return;
    const label = bracketizeName(String(corpseName || "pet corpse"));
    const desecratedOwnPet = (Number(ownerId || 0) | 0) === playerId;
    if (desecratedOwnPet) {
      log(`You devour ${label}. Your own companion. The heavens will remember this.`, 'deity');
      return;
    }
    log(`You tear into ${label}. It tastes exactly as bad as it looks.`, 'deity');
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

  world.on('corpse:shocked', ({ actor }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    log('The corpse crackles with static \u2014 electricity jolts through you!', 'danger');
  });

  world.on('corpse:buff-gained', ({ actor, effect, description }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const desc = String(description || effect || 'something stirring inside you');
    log(`You wipe the blood from your chin. You feel ${desc}.`, 'system');
  });

  world.on('corpse:debuff-gained', ({ actor, effect, description }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const desc = String(description || effect || 'deeply wrong');
    log(`That was a mistake. You feel ${desc}.`, 'danger');
  });

  world.on('corpse:resistance-gained', ({ actor, type }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const label = String(type || 'unknown');
    const _resistMsgs = {
      fire: `The meat burns going down. Your flesh no longer fears flame \u2014 fire resistance gained.`,
      cold: `The meat is ice-cold and numbs your throat. Cold resistance gained.`,
      poison: `The aftertaste is chemical. Your blood thickens \u2014 poison resistance gained.`,
      lightning: `Static crackles between your teeth. Lightning resistance gained.`,
      acid: `Your tongue blisters, then heals. Acid resistance gained.`,
    };
    log(_resistMsgs[label] || `Your body adapts to something fundamental \u2014 ${label} resistance gained.`, 'legendary');
  });

  world.on('corpse:resist-building', ({ actor, type, pct }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const label = String(type || 'unknown');
    const p = Number(pct || 0);
    if (p > 0) log(`Your ${label} resistance hardens \u2014 ${p}% resilient.`, 'system');
    else log(`Your body toughens against ${label}.`, 'system');
  });

  world.on('corpse:progression', ({ actor, name, count, threshold }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const c = Number(count || 0);
    const t = Number(threshold || 0);
    const label = String(name || 'unknown');
    if (c <= 1) log(`Something stirs inside you... (${label}: ${c}/${t})`, 'system');
    else if (c >= t - 1) log(`Your body is on the verge of transformation. (${label}: ${c}/${t})`, 'system');
    else log(`The change deepens. (${label}: ${c}/${t})`, 'system');
  });

  world.on('corpse:misdirect', ({ actor, identity, misdirectedCount, isUndead }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = String(identity || '').replace(/^corpse_/, '').replace(/_/g, ' ');
    if (isUndead) {
      log(`You hurl the ${label} corpse \u2014 nearby undead hesitate, recognising their own.`, 'system');
    } else if (misdirectedCount > 0) {
      log(`The ${label} corpse hits the ground with a meaty thud \u2014 ${misdirectedCount} creature${misdirectedCount !== 1 ? 's investigate' : ' investigates'} the noise!`, 'system');
    }
  });

  // === Bad potion messages ===
  world.on('potion:paralysis', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log("Your body locks up. You can't even blink.", 'danger');
  });
  world.on('potion:hallucination', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Oh wow, like, superior, man! The walls are breathing and the floor tastes purple.', 'danger');
  });
  world.on('potion:blindness', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log("A film coats your eyes. Everything goes dark!", 'danger');
  });
  world.on('potion:weakness', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Ulch! This makes you feel mediocre.', 'danger');
  });
  world.on('potion:confusion', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Huh, what? Where am I? Which way is which?', 'danger');
  });
  world.on('potion:sickness', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Gaggg... this tastes like sewage! Your stomach lurches violently.', 'danger');
  });
  world.on('potion:lethargy', ({ actorId }) => {
    if (nameOfEntity(actorId) !== 'You') return;
    log('Your limbs turn to lead. Even blinking feels like a chore.', 'danger');
  });

  // === Bad scroll messages ===
  world.on('scroll:cursing', ({ actor, count }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (count > 0) {
      log(`Dark words slither off the page. ${count} piece${count > 1 ? 's' : ''} of your equipment turn${count === 1 ? 's' : ''} black!`, 'danger');
    } else {
      log('Dark words slither off the page, but find nothing to corrupt.', 'system');
    }
  });
  world.on('scroll:summoning', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Shapes claw their way out of the parchment! Hostile creatures surround you!', 'danger');
  });
  world.on('scroll:decay', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The scroll crumbles and a wave of rot spreads through your pack!', 'danger');
  });
  world.on('scroll:aggravation', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('A terrible shriek fills the dungeon! Every monster is now alert!', 'danger');
  });
  world.on('scroll:teleportation', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Reality lurches. You blink and find yourself somewhere else entirely.', 'system');
  });

  // === Apply events ===
  world.on('item:applied', ({ targetId, result }) => {
    if (!result) return;
    const targetName = nameOfItem(targetId);
    if (result.type === 'touchstone') {
      const touchstoneName = targetName || result.appearance || 'gem';
      if (result.hardness === 'hard') log(`You rub ${touchstoneName} on the touchstone... it makes a hard white streak!`, 'system');
      else log(`You rub ${touchstoneName} on the touchstone... it leaves a dull scratch.`, 'system');
    } else if (result.type === 'water_dip') {
      const wt = String(result.waterType || 'plain');
      const waterLabel = wt === 'holy' ? 'the holy water' : wt === 'unholy' ? 'the unholy water' : 'the water';
      log(`You dip ${bracketizeName(targetName)} into ${waterLabel}.`, 'system');
    } else if (typeof result.message === 'string' && result.message.trim().length > 0) {
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

  world.on('item:identified', ({ identity, name, appearance, category }) => {
    const displayName = bracketizeName(name);
    log(`You identify the ${appearance}: it's ${displayName}!`, 'system');
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[messageWiring] dispatch ui:requestInventoryData:', e); }
  });

  world.on('food:decayed', ({ ownerId, itemId, stage, itemName }) => {
    const pe = playerEntity(world);
    if (!pe || pe.id !== ownerId) return;
    const label = bracketizeName(itemName);
    if (stage === 'off')    log(`Your ${label} smells off.`, 'system');
    if (stage === 'rancid') log(`Your ${label} reeks!`, 'system');
    if (stage === 'putrid') log(`Your ${label} is putrid!`, 'system');
  });

  world.on('item:equipped', ({ actor, itemId, slot, name }) => {
    const label = name ? bracketizeName(name) : `item ${itemId}`;
    log(`You equip ${label}${slot ? ' (' + slot + ')' : ''}.`, 'system');
    const info = compGet(itemId, ItemInfo);
    if (Array.isArray(info?.tags) && info.tags.includes('conflict')) {
      log('The dungeon erupts in discord \u2014 creatures turn on each other!', 'danger');
    }
  });
  world.on('item:unequipped', ({ actor, itemId, slot, name }) => {
    const label = name ? bracketizeName(name) : `item ${itemId}`;
    log(`You unequip ${label}${slot ? ' (' + slot + ')' : ''}.`, 'system');
  });
  world.on('item:welded', ({ actor, itemId, slot, name }) => {
    const label = name ? bracketizeName(name) : `item ${itemId}`;
    log(`You try to remove ${label}, but it is welded to you!`, 'danger');
  });

  world.on('urn:broken', () => {
    log('The urn shatters, scattering ashes on the floor.', 'system');
  });

  // === Holy water on corpse ===
  world.on('corpse:holy_water', ({ actor, corpseName }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = String(corpseName || 'corpse');
    log(`You pour holy water over the ${label} corpse. The flesh shimmers with pale light \u2014 it is sanctified.`, 'system');
  });

  // === Water splash (thrown water potion) ===
  world.on('water:splashed', ({ actor, waterType }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const wt = String(waterType || 'plain');
    if (wt === 'holy') log('The holy water shatters in a spray of blessed liquid!', 'system');
    else if (wt === 'unholy') log('The unholy water splashes outward with a foul hiss!', 'danger');
    else log('The water potion shatters and soaks the area.', 'system');
  });

  // === Curse events ===
  world.on('curse:equipment', ({ actor, itemId, source }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const name = bracketizeName(nameOfItem(itemId));
    if (source === 'scroll_cursing') return; // scroll:cursing handler covers this
    log(`A dark force settles over ${name}!`, 'danger');
  });
  world.on('curse:removed', ({ actor, itemId, name, source }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const label = bracketizeName(String(name || nameOfItem(itemId) || 'item'));
    log(`The corruption is purged from ${label}. It feels clean again.`, 'system');
  });

  // === Bad scroll messages (unhandled) ===
  world.on('scroll:amnesia', ({ actor, forgottenSpells }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const n = Array.isArray(forgottenSpells) ? forgottenSpells.length : 0;
    if (n > 0) log(`Your mind goes blank! You\u2019ve forgotten ${n} spell${n !== 1 ? 's' : ''}!`, 'danger');
    else log('Your mind goes blank! The parchment crumbles to dust.', 'danger');
  });
  world.on('scroll:fire', ({ actor, damage }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const n = Math.max(0, Number(damage || 0) | 0);
    log(`The scroll ignites the moment you read it \u2014 WHOOOM! (-${n} HP)`, 'danger');
  });
  world.on('scroll:genocide', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The parchment hums with finality. Name a creature, and it shall cease to exist.', 'legendary');
  });
  world.on('scroll:polymorph', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Reality bends at the edges. The nearest creature begins to change...', 'system');
  });
  world.on('scroll:taming', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The words sing from the parchment. Something nearby grows calm and docile.', 'system');
  });

  // === Wand messages ===
  world.on('wand:stasis', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('A cone of pale light freezes your target outside of time!', 'system');
  });

  // === Hunger / food messages ===
  world.on('hunger:ate', ({ actor, nutrition, satiation }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const s = Number(satiation || 0);
    if (s >= 0.9) log('You gorge yourself until you can barely move.', 'system');
    else if (s >= 0.7) log('You eat your fill. The hunger fades.', 'system');
    else if (s >= 0.4) log('You eat. It helps, but you could use more.', 'system');
    else log('You eat, but barely put a dent in your hunger.', 'system');
  });
  world.on('hunger:sickened', ({ actor, type }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const msgs = {
      decay:        'Ugh \u2014 that was rotten! Your stomach lurches violently.',
      disease:      'Something in that meal sits very wrong\u2026',
      poison:       'A burning sensation floods your gut!',
      hallucination:'The meal tastes\u2026 wrong. The walls melt sideways.',
      shock:        'A jolt runs through you as you swallow!',
      frost:        'Ice crystals form in your veins as you eat.',
      weakened:     'The meal drains rather than restores you.',
      mindwipe:     'A foggy numbness crawls through your thoughts\u2026',
      agony:        'Searing pain explodes in your chest!',
      hellfire:     'Hellfire scorches you from the inside out!',
      shade_taint:  'Cold shadow seeps into your soul.',
      petrify:      'Your limbs feel like stone \u2014 spreading inward!',
      mimic_disease:'That was NO normal meal. You feel very ill.',
    };
    log(msgs[type] || 'Something in that meal makes you violently ill.', 'danger');
  });

  // === Item drop messages ===
  world.on('item:dropped', ({ itemId, count, at }) => {
    // Only log when player drops (not NPC loot spawns, quest drops, etc.)
    // item:dropped is used broadly; we only want player-facing drops which
    // go through interaction, but there is no actor field to filter on.
    // Keep silent \u2014 pickup messages cover the feedback loop.
  });

  // === Wild Throw Interactions ===
  const WAND_SHATTER_MSG = Object.freeze({
    electric: 'The wand explodes in a storm of lightning!',
    fire:     'The wand detonates in a ball of flame!',
    cold:     'The wand shatters in a wave of frost!',
    holy:     'The wand bursts in a pulse of healing light!',
  });
  world.on('wand:shatter', ({ actor, element, charges, hitCount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const msg = WAND_SHATTER_MSG[element] || 'The wand shatters violently!';
    log(`${msg} (${charges} charge${charges !== 1 ? 's' : ''} released, ${hitCount} hit)`, 'legendary');
  });

  // === Water drink / dip messages ===
  world.on('water:drank', ({ actor, waterType, removedCurse, removedHallucination }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (waterType === 'holy') {
      if (removedCurse) {
        log('As the holy water passes your lips, a warm light fills your chest.', 'system');
      } else {
        log('The blessed liquid tingles as it goes down.', 'system');
      }
    } else if (waterType === 'unholy') {
      log('The foul water burns like acid going down. You gag.', 'danger');
    } else {
      if (removedHallucination) {
        log('The cold water shocks you back to clarity. Your vision snaps to normal.', 'system');
      } else {
        log('Tastes like dungeon water. But you drank it anyway.', 'system');
      }
    }
  });

  world.on('water:curse_lifted', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The darkness lifts from your soul! The curse is gone.', 'system');
  });

  world.on('water:hallucination_cleared', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You blink. The colours stop screaming. Reality reasserts itself.', 'system');
  });

  world.on('potion:speed', ({ actor, turns }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`The world snaps into sharp focus. You feel impossibly fast! (${turns} turns)`, 'system');
  });
  world.on('potion:acid_drink', ({ actor, damage }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const n = Math.max(0, Number(damage || 0) | 0);
    log(`The acid eats through your stomach lining on the way down! (-${n} HP)`, 'danger');
  });
  world.on('potion:oil_drink', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Your throat is now a fire hazard. You are burning from the inside out!', 'danger');
  });
  world.on('potion:oil_splash', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The flask shatters \u2014 burning oil spreads across the ground!', 'danger');
  });

  const SPLASH_EFFECT_MSG = Object.freeze({
    stun:           'The potion shatters \u2014 paralytic liquid drenches the area!',
    hallucinating:  'The potion shatters \u2014 iridescent fumes swirl outward!',
    blinded:        'The potion shatters \u2014 inky darkness splashes across the ground!',
    weakened:       'The potion shatters \u2014 a grey mist saps the air!',
    poison:         'The potion shatters \u2014 toxic sludge splashes everywhere!',
    confused:       'The potion shatters \u2014 disorienting vapour billows out!',
    lethargic:      'The potion shatters \u2014 a thick grey fog clings to the ground!',
    berserk:        'The potion shatters \u2014 liquid adrenaline sprays everywhere!',
    resist_fire:    'The potion shatters \u2014 a shimmering heat ward splashes outward!',
    resist_poison:  'The potion shatters \u2014 emerald tonic coats the area!',
    resist_electric:'The potion shatters \u2014 crackling energy grounds outward!',
    resist_acid:    'The potion shatters \u2014 thick amber syrup coats the area!',
    mana_drain:     'The potion shatters \u2014 arcane static crackles through the air!',
    slowed:         'The potion shatters \u2014 silver liquid slows everything it touches!',
    burning:        'The potion shatters \u2014 caustic liquid scorches everything nearby!',
    weakened:       'The potion shatters \u2014 grey vapour drains the strength of all nearby!',
    blinded:        'The potion shatters \u2014 black ichor blinds everything it touches!',
  });
  world.on('potion:splash', ({ actor, effectKey, hitCount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const msg = SPLASH_EFFECT_MSG[effectKey] || 'The potion shatters on impact!';
    const hitSuffix = hitCount > 0 ? ` (${hitCount} drenched)` : '';
    log(`${msg}${hitSuffix}`, effectKey && effectKey.startsWith('resist') ? 'system' : 'danger');
  });
  world.on('potion:splash:dud', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('The potion shatters harmlessly \u2014 the oily liquid just pools on the ground.', 'system');
  });
}
