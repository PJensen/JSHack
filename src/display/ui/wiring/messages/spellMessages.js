/**
 * Spell casting, channeling, and ability message wiring.
 * Lines ~377-918 from the original installMessageWiring.
 */
export function installSpellMessages(ctx) {
  const { world, log, nameOfEntity, bracketizeName, getSpell, compGet, NamedIdentity } = ctx;

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

  world.on('spirit:spellBoost', () => {
    log('The spirit wisp surges alongside your spell!', 'deity');
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

  world.on('spell:no-target', ({ actor, range }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(range <= 1 ? 'No enemy in melee range.' : 'No enemy in range.', 'system');
  });

  world.on('spell:oom', ({ actor, spellId, need, have, costKind }) => {
    const who = nameOfEntity(actor);
    const resource = String(costKind || 'mana');
    const label = resource === 'stamina' ? 'stamina' : resource === 'life' ? 'life' : 'mana';
    if (who === 'You') {
      log(`Not enough ${label} to cast [${String(spellId || 'spell')}] (need ${need}, have ${have}).`, 'system');
      return;
    }
    if (spellId) {
      log(`${who} lacks ${label} for [${String(spellId)}].`, 'system');
      return;
    }
    log(`${who} lacks ${label} to cast.`, 'system');
  });

  world.on('spell:on-cooldown', ({ actor, spellId }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || 'spell')}]`;
    log(`${label} is not ready yet.`, 'system');
  });

  world.on('spell:lifetap', ({ actor, hpSpent, manaGained }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You sacrifice ${hpSpent} life, gaining ${manaGained} mana.`, 'system');
  });

  world.on('spell:fizzle', ({ actor, spellId, confused, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const s = getSpell ? getSpell(String(spellId || '')) : null;
    const label = s?.name ? `[${s.name}]` : `[${String(spellId || 'spell')}]`;
    if (confused) { log(`You lose focus and ${label} fizzles.`, 'system'); return; }
    if (reason === 'silenced') { log(`You are silenced; ${label} cannot be cast.`, 'system'); return; }
    if (reason === 'asleep') { log(`You are asleep; ${label} fizzles.`, 'system'); return; }
    if (reason === 'stunned') { log(`You are stunned; ${label} fizzles.`, 'system'); return; }
    if (reason === 'mindlocked') { log(`Your mind is locked; ${label} fizzles.`, 'system'); return; }
    log(`${label} fizzles.`, 'system');
  });

  world.on('spell:miscast', ({ actor, fromSpellId, toSpellId, confused }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const from = getSpell ? getSpell(String(fromSpellId || '')) : null;
    const to = getSpell ? getSpell(String(toSpellId || '')) : null;
    const fromLabel = from?.name ? `[${from.name}]` : `[${String(fromSpellId || 'spell')}]`;
    const toLabel = to?.name ? `[${to.name}]` : `[${String(toSpellId || 'spell')}]`;
    if (confused) { log(`Your confusion twists ${fromLabel} into ${toLabel}.`, 'system'); return; }
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
    if (reason === 'dead') { log('Channeling interrupted by death.', 'combat'); }
    else if (reason === 'oom') { log('Your mana gives out and the channel collapses.', 'system'); }
    else if (reason === 'silenced') { log('You are silenced and lose the channel.', 'system'); }
    else if (reason === 'asleep') { log('You fall asleep and the channel breaks.', 'system'); }
    else if (reason === 'stunned') { log('You are stunned and lose the channel.', 'system'); }
    else if (reason === 'mindlocked') { log('Your mind locks and the channel breaks.', 'system'); }
    else if (reason === 'mana_full') { log('Your mana is fully restored.', 'system'); }
    else { log('Channeling interrupted.', 'system'); }
  });

  world.on('intent:blocked', ({ actor, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'stunned') { log('You are stunned and can only wait.', 'system'); return; }
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
    if (reason === 'no_target') { log('Blink needs a destination tile.', 'system'); return; }
    if (reason === 'out_of_range') { log(`Blink destination is out of range (${Number(range || 10) | 0} tiles).`, 'system'); return; }
    if (reason === 'no_safe_landing') { log('Blink fizzles: no safe landing tile.', 'system'); return; }
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
    if (reason === 'no_target') { log('Phase Strike needs a destination tile.', 'system'); return; }
    if (reason === 'out_of_range') { log(`Phase Strike destination is out of range (${Number(range || 10) | 0} tiles).`, 'system'); return; }
    if (reason === 'no_safe_landing') { log('Phase Strike fizzles: no safe landing tile.', 'system'); return; }
    log('Phase Strike fizzles.', 'system');
  });

  world.on('spell:blind', ({ actor, targetId, fizzle, reason }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (fizzle) {
      if (who === 'You') {
        if (reason === 'no_los') log('Blind fizzles \u2014 no line of sight.', 'system');
        else if (reason === 'out_of_range') log('Blind fizzles \u2014 target out of range.', 'system');
        else log('Blind finds no target.', 'system');
      }
      return;
    }
    if (who === 'You') {
      log(`You veil ${tgt}'s sight in darkness.`, 'combat');
      const tni = compGet(Number(targetId || 0), NamedIdentity);
      if (String(tni?.identity || '') === 'floating_eye') {
        log("The Floating Eye's gaze dims \u2014 its power broken!", 'combat');
      }
    } else if (tgt === 'You') {
      log(`${who} veils your sight in darkness!`, 'danger');
    } else {
      log(`${who} blinds ${tgt}.`, 'combat');
    }
  });

  world.on('spell:rampage', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You enter a blood rage!', 'combat');
  });

  world.on('spell:verdant_ward', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Bark and sap spiral around you in a verdant ward.', 'system');
  });

  world.on('spell:harmony_ward', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('A balanced ward settles over your skin.', 'system');
  });

  world.on('spell:shadow_veil', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Your outline thins into shadow. You are invisible.', 'system');
  });

  world.on('spell:earthshatter', ({ actor, enhanced }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (enhanced) {
      log('You slam the ground \u2014 magma seethes through the cracks!', 'danger');
    } else {
      log('You slam the ground \u2014 the earth cracks!', 'system');
    }
  });

  world.on('spell:entangle', ({ actor, targetId }) => {
    const who = nameOfEntity(actor);
    const whom = nameOfEntity(targetId);
    if (who === 'You') {
      log(`Grasping vines bind ${whom} in place!`, 'combat');
    } else if (whom === 'You') {
      log(`${who} entangles you in thorny vines!`, 'danger');
    }
  });

  world.on('spell:thorn_burst', ({ actor, impacts }) => {
    const who = nameOfEntity(actor);
    const hitCount = Array.isArray(impacts) ? impacts.length : 0;
    if (who === 'You') {
      log(`Razor thorns erupt outward${hitCount > 1 ? `, shredding ${hitCount} foes!` : hitCount === 1 ? ', shredding a foe!' : '!'}`, 'combat');
    } else {
      log(`${who} erupts in a burst of razor thorns!`, 'danger');
    }
  });

  // Generator messages
  world.on('spell:savage_strike', ({ actor, hit }) => {
    if (nameOfEntity(actor) !== 'You' || !hit) return;
    log('You land a savage strike \u2014 stamina surges!', 'combat');
  });

  world.on('spell:natures_touch', ({ actor, hit }) => {
    if (nameOfEntity(actor) !== 'You' || !hit) return;
    log('Nature replenishes your reserves.', 'system');
  });

  world.on('spell:cheap_shot', ({ actor, hit }) => {
    if (nameOfEntity(actor) !== 'You' || !hit) return;
    log('A dirty hit \u2014 mana flows back.', 'combat');
  });

  world.on('spell:arcane_bolt', ({ actor, hit }) => {
    if (nameOfEntity(actor) !== 'You' || !hit) return;
    log('Arcane energy siphons back into you.', 'system');
  });

  world.on('spell:leech_spores', ({ actor, hit }) => {
    if (nameOfEntity(actor) !== 'You' || !hit) return;
    log('Parasitic spores drain your foe \u2014 you feel renewed.', 'combat');
  });

  world.on('spell:holy_strike', ({ actor, hit }) => {
    if (nameOfEntity(actor) !== 'You' || !hit) return;
    log('Holy light renews your faith.', 'system');
  });

  // Buff / Rotation ability messages
  world.on('spell:iron_flesh', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') log('Your flesh hardens to iron!', 'system');
  });

  world.on('spell:ignite_weapons', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') log('Flames wreathe your weapons!', 'combat');
  });

  world.on('spell:barkskin', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') log('Bark grows over your skin \u2014 thorns bristle outward.', 'system');
  });

  world.on('spell:quicken', ({ actor }) => {
    if (nameOfEntity(actor) === 'You') log('Adrenaline surges through you \u2014 everything slows down.', 'system');
  });

  world.on('spell:mark_of_death', ({ actor, targetId }) => {
    const who = nameOfEntity(actor);
    const whom = nameOfEntity(targetId);
    if (who === 'You') {
      log(`A death sigil burns into ${whom} \u2014 all damage amplified!`, 'combat');
    } else if (whom === 'You') {
      log(`${who} brands you with a mark of death!`, 'danger');
    }
  });

  world.on('spell:primal_roar', ({ actor, affected }) => {
    if (nameOfEntity(actor) === 'You') {
      if (affected > 0) {
        log(`You unleash a primal roar \u2014 ${affected} ${affected > 1 ? 'enemies stagger' : 'enemy staggers'}!`, 'combat');
      } else {
        log('You unleash a primal roar \u2014 savage fury fills you!', 'system');
      }
    }
  });

  // Warden ability messages
  world.on('spell:war_cry', ({ actor, affected }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (affected > 0) {
      log(`You unleash a thundering war cry \u2014 ${affected} ${affected === 1 ? 'enemy cowers' : 'enemies cower'}!`, 'combat');
    } else {
      log('You bellow a war cry, but nothing is close enough to hear.', 'system');
    }
  });

  world.on('spell:cleave', ({ actor, hits }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (hits && hits.length > 0) {
      log(`You cleave through ${hits.length} ${hits.length === 1 ? 'foe' : 'foes'}!`, 'combat');
    } else {
      log('You sweep your weapon, but nothing is in reach.', 'system');
    }
  });

  world.on('spell:bloodthirst', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Blood-hunger surges through you \u2014 your strikes will mend your wounds.', 'combat');
  });

  world.on('proc:bloodthirst', ({ actor, healed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You drain ${healed} HP from the wound.`, 'heal');
  });

  // Cleric ability messages
  world.on('spell:purify', ({ actor, removed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (removed > 0) {
      log(`Holy light burns away ${removed} ${removed === 1 ? 'affliction' : 'afflictions'}.`, 'heal');
    } else {
      log('You invoke purification, but your body is already clean.', 'system');
    }
  });

  world.on('spell:divine_shield', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('A shell of divine light hardens around you.', 'system');
  });

  world.on('spell:consecrate', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('Holy fire sanctifies the ground beneath you.', 'system');
  });

  // Outlaw ability messages
  world.on('spell:smoke_bomb', ({ actor, affected }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (affected > 0) {
      log(`You vanish in a puff of smoke \u2014 ${affected} ${affected === 1 ? 'enemy loses' : 'enemies lose'} sight of you!`, 'combat');
    } else {
      log('You toss a smoke bomb, but nobody is around to see it.', 'system');
    }
  });

  world.on('spell:poison_blade', ({ actor, fizzle, weaponName, charges }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (fizzle) { log('You have no weapon to coat.', 'system'); }
    else { log(`You drag venom across your ${weaponName} (${charges} charges).`, 'combat'); }
  });

  world.on('spell:scorch', ({ actor, fizzle, missed, critical }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (fizzle) { log('Scorch finds no target.', 'system'); return; }
    if (missed) { log('Your scorch misses!', 'system'); return; }
    if (critical) { log('Your scorch sears the target!', 'combat'); return; }
    log('You scorch the target.', 'combat');
  });

  world.on('spell:plague_swarm', ({ actor, fizzle, missed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (fizzle) { log('The swarm finds no host.', 'system'); return; }
    if (missed) { log('Your plague swarm misses!', 'system'); return; }
    log('You unleash a plague swarm!', 'combat');
  });

  world.on('spell:plague_swarm:jump', () => {
    log('The swarm leaps to a new host!', 'combat');
  });

  world.on('spell:fireball', ({ actor, fizzle, missed }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (fizzle) { log('Fireball finds no target.', 'system'); return; }
    if (missed) { log('Your fireball misses!', 'system'); return; }
    log('You hurl a fireball!', 'combat');
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
    if (reason === 'no_target') { log('Meteor needs a target tile.', 'system'); return; }
    if (reason === 'out_of_range') { log(`Meteor target is out of range (${Number(range || 12) | 0} tiles).`, 'system'); return; }
    if (reason === 'blocked_los') { log('Meteor target must be in line of sight.', 'system'); return; }
    log('Meteor fizzles.', 'system');
  });

  function installStormFailureMessage(eventName, spellName) {
    world.on(eventName, ({ actor, reason, range }) => {
      if (nameOfEntity(actor) !== 'You') return;
      if (reason === 'no_target') { log(`${spellName} needs a target tile.`, 'system'); return; }
      if (reason === 'out_of_range') { log(`${spellName} target is out of range (${Number(range || 10) | 0} tiles).`, 'system'); return; }
      if (reason === 'blocked_los') { log(`${spellName} target must be in line of sight.`, 'system'); return; }
      log(`${spellName} fizzles.`, 'system');
    });
  }

  installStormFailureMessage('spell:blizzard:failed', 'Blizzard');
  installStormFailureMessage('spell:firestorm:failed', 'Firestorm');
}
