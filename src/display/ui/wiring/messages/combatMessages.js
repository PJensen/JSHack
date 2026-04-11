/**
 * Combat, damage, healing, death, ranged, shield, procs, and special strike wiring.
 * Lines ~919-1249, ~1028-1249, ~1167-1249, ~1481-1491, ~2354-2430 from original.
 */
export function installCombatMessages(ctx) {
  const { world, log, nameOfEntity, bracketizeName, compGet, compHas, playerEntity,
          canSeeAt, normalizeStatusEvent, Equipment, ItemInfo, NamedIdentity, Pet, Owner, Player, Position } = ctx;

  // === Monster ability messages ===
  world.on('monster:ability:windup', ({ actor, targetId, abilityName }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    const label = String(abilityName || "ability");
    if (tgt === 'You') { log(`${who} winds up ${label.toLowerCase()}!`, 'danger'); return; }
    log(`${who} prepares ${label.toLowerCase()}.`, 'combat');
  });

  world.on('monster:ability:cast', ({ actor, targetId, abilityName }) => {
    if (!_playerCanSee([actor, targetId])) return;
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

  // ── Helpers ──
  function _v(name, you, they) { return name === 'You' ? you : they; }

  /** True if the player is involved OR the event is visible to the player. */
  function _playerCanSee(ids, at) {
    const pe = playerEntity(world);
    const pid = Number(pe?.id || 0) | 0;
    for (const id of ids) {
      if (Number(id || 0) === pid) return true;
    }
    if (at && canSeeAt(at.x, at.y)) return true;
    for (const id of ids) {
      const p = compGet(Number(id || 0), Position);
      if (p && canSeeAt(p.x, p.y)) return true;
    }
    return false;
  }

  // verb pairs: [you-form, third-person-form]
  const _meleeVerbs = {
    stab:  ['stab', 'stabs'],
    slash: ['slash', 'slashes'],
    blunt: ['bash', 'bashes'],
    strike:['hit', 'hits'],
  };
  const _spellVerbs = {
    fire:      ['burn', 'burns'],
    lightning: ['shock', 'shocks'],
    electric:  ['shock', 'shocks'],
    ice:       ['freeze', 'freezes'],
    frost:     ['freeze', 'freezes'],
    cold:      ['freeze', 'freezes'],
    poison:    ['poison', 'poisons'],
    acid:      ['corrode', 'corrodes'],
    arcane:    ['blast', 'blasts'],
    plasma:    ['sear', 'sears'],
    radiation: ['irradiate', 'irradiates'],
  };
  const _critMelee = {
    stab:  ['skewer', 'skewers'],
    slash: ['cleave', 'cleaves'],
    blunt: ['crush', 'crushes'],
  };

  world.on('damaged', ({ target, amount, critical, crit, source, offhand, cause, type, impactProfile, at }) => {
    if (!_playerCanSee([target, source], at)) return;

    const defName = nameOfEntity(target);
    const isCrit = !!(critical || crit);
    const handTxt = offhand ? ' (off-hand)' : '';
    const critTxt = isCrit ? ' \u2014 CRIT!' : '';
    const causeKey = String(cause || '').toLowerCase();
    const isSpell = causeKey.startsWith('spell:') || causeKey.startsWith('affix:')
      || causeKey.startsWith('procpackage:') || causeKey.startsWith('monster:');
    const usingRanged = causeKey === 'ranged';
    const dt = String(type || '').toLowerCase();
    const attackKind = impactProfile?.attackKind || '';

    if (Number(source || 0)) {
      const atkName = nameOfEntity(source);

      if (isSpell) {
        const pair = _spellVerbs[dt] || ['hit', 'hits'];
        log(`${atkName} ${_v(atkName, pair[0], pair[1])} ${defName} for ${amount}${critTxt}.`, 'combat');
        return;
      }

      // Melee / ranged — resolve weapon
      let weaponLabel = '';
      const eq = compGet(Number(source || 0), Equipment);
      const wid = offhand
        ? Number(eq?.offhand || 0)
        : (usingRanged ? Number(eq?.ranged || 0) : Number(eq?.weapon || 0));
      if (wid) {
        const wname = compGet(wid, NamedIdentity)?.name;
        if (wname) weaponLabel = ` with ${bracketizeName(wname)}`;
      } else if (!offhand && compHas(Number(source || 0), Player)) {
        weaponLabel = ' with bare fists';
      }
      const pair = (isCrit && _critMelee[attackKind])
        || _meleeVerbs[attackKind]
        || ['hit', 'hits'];
      log(`${atkName} ${_v(atkName, pair[0], pair[1])} ${defName}${weaponLabel} for ${amount}${critTxt}${handTxt}.`, 'combat');
    } else {
      log(`${defName} ${_v(defName, 'take', 'takes')} ${amount} damage${critTxt}${handTxt}.`, 'combat');
    }
  });

  world.on('healed', ({ id, amount }) => {
    if (!_playerCanSee([id])) return;
    const who = nameOfEntity(id);
    log(`${who} ${_v(who, 'heal', 'heals')} ${amount}.`, 'system');
  });

  // ── Context-aware death messages ──
  // Keyed by: attackKind (stab/slash/blunt/strike), goreType (blood/ichor/spark/none),
  //           sizeClass (S/M/L), damageType (fire/lightning/poison/acid/etc.), critical
  const _deathByAttack = {
    stab:  [(w) => `${w} slumps off the blade.`,
            (w) => `${w} is run through.`,
            (w) => `${w} staggers and falls, pierced clean.`],
    slash: [(w) => `${w} is cut down.`,
            (w) => `${w} is cleaved apart.`,
            (w) => `${w} drops in a spray of gore.`],
    blunt: [(w) => `${w} crumples from the impact.`,
            (w) => `${w} is bludgeoned into the ground.`,
            (w) => `${w} folds like a sack of wet grain.`],
    strike:[(w) => `${w} falls.`,
            (w) => `${w} goes limp.`,
            (w) => `${w} collapses.`],
  };
  const _deathByElement = {
    fire:      [(w) => `${w} burns to cinders.`,
                (w) => `${w} is consumed by flame.`],
    cold:      [(w) => `${w} freezes solid and shatters.`,
                (w) => `${w} is flash-frozen where it stands.`],
    lightning: [(w) => `${w} is fried to a crisp.`,
                (w) => `${w} convulses and drops, smoking.`],
    poison:    [(w) => `${w} chokes on venom and expires.`,
                (w) => `${w} froths and collapses.`],
    acid:      [(w) => `${w} dissolves in a hiss of acid.`,
                (w) => `${w} melts into a puddle.`],
    plasma:    [(w) => `${w} is vaporized.`,
                (w) => `${w} disintegrates in a flash of plasma.`],
    arcane:    [(w) => `${w} unravels under the arcane force.`,
                (w) => `${w} is torn apart by raw magic.`],
    starvation:[(w) => `${w} keels over from hunger.`],
  };
  const _deathByGore = {
    spark:  [(w) => `${w} sparks violently and shuts down.`,
             (w) => `${w} detonates in a shower of sparks.`],
    ichor:  [(w) => `${w} bursts, spattering ichor across the floor.`,
             (w) => `${w} oozes apart.`],
    none:   [(w) => `${w} is destroyed.`,
             (w) => `${w} is no more.`],
  };
  const _deathCrit = {
    stab:      [(w) => `${w} is skewered \u2014 dead before hitting the floor.`],
    slash:     [(w) => `${w} is bisected in a single stroke.`],
    blunt:     [(w) => `${w} is pulverized.`],
    fire:      [(w) => `${w} explodes into a pillar of flame!`],
    cold:      [(w) => `${w} shatters into a thousand frozen pieces!`],
    lightning: [(w) => `A bolt rips through ${w} \u2014 nothing but char remains.`],
    acid:      [(w) => `${w} dissolves into nothing \u2014 not even bones remain.`],
  };
  const _deathBySize = {
    S: [(w) => `${w} pops like a grape.`,
        (w) => `${w} crumples into a tiny heap.`],
    L: [(w) => `${w} topples like a felled tree.`,
        (w) => `${w} crashes to the ground \u2014 the floor shakes.`],
  };
  const _deathFallback = [
    (w) => `${w} dies.`,
    (w) => `${w} expires.`,
    (w) => `${w} is no more.`,
    (w) => `${w} falls.`,
    (w) => `${w} collapses in a heap.`,
  ];

  function _pick(arr, step) {
    return arr[(step || 0) % arr.length];
  }

  world.on('died', (ev) => {
    const { id, killer, critical, damageType, goreType, sizeClass, impactProfile } = ev;
    if (!_playerCanSee([id, killer])) return;

    const who = nameOfEntity(id);
    const pe = playerEntity(world);
    const playerId = Number(pe?.id || 0) | 0;
    const deadId = Number(id || 0) | 0;
    const killerId = Number(killer || 0) | 0;
    const step = world.step || 0;

    if (compHas(deadId, Pet)) {
      const owner = compGet(deadId, Owner);
      const ownerId = Number(owner?.ownerId || 0) | 0;
      if (playerId > 0 && ownerId === playerId && killerId === playerId) {
        log(`You kill ${who}. The act is unforgivable.`, 'deity');
        return;
      }
    }

    const attackKind = impactProfile?.attackKind || '';
    const dt = String(damageType || '');
    const gore = String(goreType || 'blood');
    const size = String(sizeClass || 'M');

    // 1. Crit kills — most dramatic
    if (critical) {
      const pool = _deathCrit[attackKind] || _deathCrit[dt];
      if (pool) { log(_pick(pool, step)(who), 'combat'); return; }
    }
    // 2. Elemental kills
    if (_deathByElement[dt]) {
      log(_pick(_deathByElement[dt], step)(who), 'combat'); return;
    }
    // 3. Size-specific flavor for small/large
    if (_deathBySize[size] && step % 3 === 0) {
      log(_pick(_deathBySize[size], step)(who), 'combat'); return;
    }
    // 4. Attack-kind flavor (melee weapon shape)
    if (_deathByAttack[attackKind]) {
      log(_pick(_deathByAttack[attackKind], step)(who), 'combat'); return;
    }
    // 5. Gore-type flavor (non-blood creatures)
    if (gore !== 'blood' && _deathByGore[gore]) {
      log(_pick(_deathByGore[gore], step)(who), 'combat'); return;
    }
    // 6. Fallback
    log(_pick(_deathFallback, step)(who), 'combat');
  });

  const _missVerbs = {
    stab:  ['stab at', 'stabs at'],
    slash: ['swing at', 'swings at'],
    blunt: ['swing at', 'swings at'],
  };

  function _getAttackKindFor(srcId) {
    const eq = compGet(Number(srcId || 0), Equipment);
    const wid = Number(eq?.weapon || 0);
    if (!wid) return '';
    const info = compGet(wid, ItemInfo);
    const dt = String(info?.damageType || '').toLowerCase();
    if (dt === 'pierce') return 'stab';
    if (dt === 'slash') return 'slash';
    if (dt === 'blunt') return 'blunt';
    return '';
  }

  world.on('status', (payload) => {
    const { id, kind, source, at } = normalizeStatusEvent(payload);
    if (!_playerCanSee([id, source], at)) return;

    const style = (String(kind || '')).toLowerCase();
    const tgt = nameOfEntity(id);
    const srcId = Number(source || 0);
    const src = srcId ? nameOfEntity(source) : null;
    if (style === 'miss' && src) {
      const ak = _getAttackKindFor(srcId);
      const pair = _missVerbs[ak];
      if (pair) {
        log(`${src} ${_v(src, pair[0], pair[1])} ${tgt} and ${_v(src, 'miss', 'misses')}.`, 'combat');
      } else {
        log(`${src} ${_v(src, 'miss', 'misses')} ${tgt}.`, 'combat');
      }
    }
    if (style === 'immune' && src) {
      log(`${src} ${_v(src, 'attack', 'attacks')} ${tgt}. It does nothing.`, 'combat');
    }
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
