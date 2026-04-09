/**
 * Combat, damage, healing, death, ranged, shield, procs, and special strike wiring.
 * Lines ~919-1249, ~1028-1249, ~1167-1249, ~1481-1491, ~2354-2430 from original.
 */
export function installCombatMessages(ctx) {
  const { world, log, nameOfEntity, bracketizeName, compGet, compHas, playerEntity,
          canSeeAt, normalizeStatusEvent, Equipment, ItemInfo, NamedIdentity, Pet, Owner, Player } = ctx;

  // === Monster ability messages ===
  world.on('monster:ability:windup', ({ actor, targetId, abilityName }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    const label = String(abilityName || "ability");
    if (tgt === 'You') { log(`${who} winds up ${label.toLowerCase()}!`, 'danger'); return; }
    log(`${who} prepares ${label.toLowerCase()}.`, 'combat');
  });

  world.on('monster:ability:cast', ({ actor, targetId, abilityName }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    const label = String(abilityName || "ability");
    if (tgt === 'You') { log(`${who} uses ${label.toLowerCase()} on you!`, 'danger'); return; }
    log(`${who} uses ${label.toLowerCase()}.`, 'combat');
  });

  world.on('monster:firebreath', ({ actor, target }) => {
    if (nameOfEntity(target) !== 'You') return;
    log(`${nameOfEntity(actor)} exhales a line of fire!`, 'combat');
  });

  world.on('spell:death_volley', ({ actor, hits }) => {
    const who = nameOfEntity(actor);
    const hitYou = Array.isArray(hits) && hits.some((hit) => nameOfEntity(hit?.id) === 'You');
    if (hitYou) { log(`${who}'s volley rains arrows across your position!`, 'danger'); return; }
    const count = Array.isArray(hits) ? hits.length : 0;
    if (count > 0) log(`${who}'s volley peppers ${count} target${count === 1 ? '' : 's'}.`, 'combat');
  });

  world.on('spell:boar_charge', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} slams into you with a charge!`, 'danger');
      else if (missed) log(`${who} barrels past, but still knocks you back!`, 'danger');
      else log(`${who} rushes you with a charge!`, 'danger');
      return;
    }
    if (hit) log(`${who} crashes into ${tgt}.`, 'combat');
  });

  world.on('spell:boar_bite', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} bites deep, leaving you weakened!`, 'danger');
      else if (missed) log(`${who} snaps at you, but misses.`, 'danger');
      return;
    }
    if (hit) log(`${who} bites ${tgt}.`, 'combat');
  });

  world.on('spell:rat_gnaw', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} gnaws at your legs, opening a bleed!`, 'danger');
      else if (missed) log(`${who} lunges for a gnaw, but misses.`, 'danger');
      return;
    }
    if (hit) log(`${who} gnaws ${tgt}.`, 'combat');
  });

  world.on('spell:goblin_dirty_trick', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} pulls a dirty trick and blinds you!`, 'danger');
      else if (missed) log(`${who} tries a dirty trick, but whiffs.`, 'danger');
      return;
    }
    if (hit) log(`${who} blinds ${tgt} with a dirty trick.`, 'combat');
  });

  world.on('spell:snake_fang', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} sinks venomous fangs into you!`, 'danger');
      else if (missed) log(`${who} strikes with its fangs, but misses.`, 'danger');
      return;
    }
    if (hit) log(`${who} bites ${tgt} with venomous fangs.`, 'combat');
  });

  world.on('spell:spider_lunge', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} lunges and staggers you!`, 'danger');
      else if (missed) log(`${who} lunges at you, but misses.`, 'danger');
      return;
    }
    if (hit) log(`${who} lunges into ${tgt}.`, 'combat');
  });

  world.on('proc:bleeding', ({ actor, target }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log(`${who} opens a bleeding wound!`, 'danger'); return; }
    if (who === 'You') { log(`You leave ${tgt} bleeding.`, 'combat'); return; }
    log(`${who} leaves ${tgt} bleeding.`, 'combat');
  });

  world.on('proc:hemorrhage', ({ actor, target }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log(`${who}'s ${bracketizeName('Hemorrhage')} tears you open!`, 'danger'); return; }
    if (who === 'You') { log(`${bracketizeName('Hemorrhage')} tears ${tgt} open.`, 'combat'); return; }
    log(`${who}'s ${bracketizeName('Hemorrhage')} tears ${tgt} open.`, 'combat');
  });

  world.on('proc:paralyzed', ({ actor, target }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log(`${who}'s strike paralyzes you!`, 'danger'); return; }
    if (who === 'You') { log(`Your strike paralyzes ${tgt}!`, 'combat'); return; }
    log(`${who}'s strike paralyzes ${tgt}!`, 'combat');
  });

  world.on('spell:wolf_howl', ({ actor, alertedIds }) => {
    const who = nameOfEntity(actor);
    const count = Array.isArray(alertedIds) ? alertedIds.length : 0;
    if (count > 0) { log(`${who} howls, rallying ${count} ${count === 1 ? 'ally' : 'allies'}!`, 'danger'); return; }
    log(`${who} lets out a hunting howl.`, 'combat');
  });

  world.on('spell:shield_bash', ({ actor, targetId, hit, missed }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} shield-bashes you and staggers your footing!`, 'danger');
      else if (missed) log(`${who} slams a shield at you, but misses.`, 'danger');
      return;
    }
    if (hit) log(`${who} bashes ${tgt} aside.`, 'combat');
  });

  // Shield / dodge / parry combat messages
  world.on('shield:guarded', ({ id, source, stacks, broken }) => {
    const who = nameOfEntity(id);
    const attacker = nameOfEntity(source);
    if (who === 'You') {
      log(broken
        ? `You block ${attacker}'s attack but your shield shatters!`
        : `You block ${attacker}'s attack with your shield. (${stacks} guard left)`, broken ? 'danger' : 'combat');
    } else {
      log(broken
        ? `${who} blocks your attack \u2014 the shield breaks!`
        : `${who} blocks with a shield.`, 'combat');
    }
  });

  world.on('combat:posture', ({ id, stance, previous, hasShield }) => {
    const who = nameOfEntity(id);
    if (who !== 'You') return;
    if (stance === 'guarded' && hasShield) log('You raise your shield.', 'combat');
    else if (previous === 'guarded' && hasShield) log('You lower your shield.', 'combat');
  });

  world.on('combat:dodge', ({ defender, attacker }) => {
    const who = nameOfEntity(defender);
    const atk = nameOfEntity(attacker);
    if (who === 'You') log(`You dodge ${atk}'s attack!`, 'combat');
    else log(`${who} dodges your attack!`, 'combat');
  });

  world.on('combat:parry', ({ defender, attacker, weaponName }) => {
    const who = nameOfEntity(defender);
    const atk = nameOfEntity(attacker);
    const wName = String(weaponName || 'weapon');
    if (who === 'You') log(`You parry ${atk}'s strike with your ${wName}!`, 'combat');
    else log(`${who} parries your attack!`, 'combat');
  });

  world.on('spell:acid_spit', ({ actor, targetId, hit }) => {
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') { log(hit ? `${who} spits acid over you!` : `${who} spits acid that hisses at your feet!`, 'danger'); return; }
    log(`${who} spits a glob of acid.`, 'combat');
  });

  world.on('monster:death:fire_puff', ({ at }) => {
    if (!at || !canSeeAt(at.x, at.y)) return;
    log('The corpse flashes into cinders.', 'combat');
  });

  world.on('monster:death:gas_spore', ({ at }) => {
    if (!at || !canSeeAt(at.x, at.y)) return;
    log('The gas spore ruptures \u2014 volatile spores billow out!', 'danger');
  });

  world.on('proc:rot_grub:burrow', ({ actor, target }) => {
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log('A rot grub burrows under your skin! You are bleeding badly!', 'danger'); return; }
    log(`A rot grub burrows into ${tgt}!`, 'combat');
  });

  // === Core combat events ===
  world.on('attack:insufficient-stamina', ({ attacker, defender, weaponId, need, have }) => {
    const weaponInfo = compGet(weaponId, ItemInfo);
    const weaponName = weaponInfo ?
      (compGet(weaponId, NamedIdentity)?.name || weaponInfo.description || weaponInfo.type)
      : 'fists';
    log(`Not enough stamina to attack with ${weaponName} (need ${need}, have ${Math.floor(have)}).`, 'combat');
  });

  world.on('damaged', ({ target, amount, critical, crit, source, offhand, cause }) => {
    const defName = nameOfEntity(target);
    const critTxt = (critical || crit) ? ' (CRIT!)' : '';
    const handTxt = offhand ? ' (off-hand)' : '';
    if (Number(source || 0)) {
      const atkName = nameOfEntity(source);
      let weaponLabel = '';
      const eq = compGet(Number(source || 0), Equipment);
      const causeKey = String(cause || '').toLowerCase();
      const usingRanged = causeKey === 'ranged';
      const wid = offhand
        ? Number(eq?.offhand || 0)
        : (usingRanged ? Number(eq?.ranged || 0) : Number(eq?.weapon || 0));
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
    log(`${nameOfEntity(id)} heals ${amount}.`, 'system');
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

  // === Battle fury / lichdom ===
  world.on('battle_fury:heal', ({ id, amount }) => {
    const pe = playerEntity(world);
    if (!pe || id !== pe.id) return;
    log(`Warchief fury surges \u2014 you recover ${amount} HP!`, 'system');
  });

  world.on('lichdom_echo:saved', ({ id }) => {
    const pe = playerEntity(world);
    if (!pe || id !== pe.id) return;
    log('The phylactery pulse shatters \u2014 death is cheated!', 'legendary');
  });

  // === Wild Interactions: blessed/holy combat ===
  world.on('combat:holy_strike', () => {
    log('Your blade blazes with holy light \u2014 the undead recoils!', 'system');
  });
  world.on('combat:blessed_strike', ({ creatureType }) => {
    const label = creatureType === 'undead' ? 'undead' : 'demon';
    log(`Your blessed weapon sears the ${label}!`, 'system');
  });
  world.on('combat:banish', () => {
    log('Your blessed weapon banishes the demon back to the abyss!', 'danger');
  });
  world.on('combat:sunblind', () => {
    log("The Sunsword's radiance burns away all sight!", 'system');
  });
  world.on('combat:shatter', ({ damageType, mult }) => {
    if (damageType === 'blunt') log('The frozen enemy shatters under the blow!', 'system');
    else log('Your weapon pierces through the brittle ice!', 'system');
  });
  world.on('combat:torch_ignite', () => {
    log('Your torch sets the enemy ablaze!', 'system');
  });
  world.on('spell:heal:undead', () => {
    log('Healing energy sears through the undead!', 'system');
  });
  world.on('spell:lightning:backlash', ({ damage }) => {
    log(`The current surges through the water beneath you! (-${damage} HP)`, 'danger');
  });
  world.on('potion:blessed_bonus', () => {
    log('The blessed potion surges with amplified power!', 'system');
  });
  world.on('scroll:wasted_blind', () => {
    log("You fumble blindly at the scroll \u2014 the words blur and fade to nothing!", 'warning');
  });
  world.on('proc:blessed_resist_rust', ({ itemName }) => {
    log(`The blessing on your ${bracketizeName(String(itemName || 'equipment'))} flares, repelling the corrosion!`, 'system');
  });
  world.on('holy_water:undead', ({ target }) => {
    const tname = nameOfEntity(target) || 'undead';
    log(`The holy water scalds ${tname}!`, 'system');
  });
  world.on('hunger:choke', () => {
    log('You wolf down the food so fast you choke! You are stunned!', 'warning');
  });
  world.on('combat:target-flying', () => {
    log('Out of reach!', 'info');
  });
}
