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
    if (tgt === 'You') { log(`${who} rears back \u2014 ${label.toLowerCase()} incoming!`, 'danger'); return; }
    log(`${who} prepares ${label.toLowerCase()}.`, 'combat');
  });

  world.on('monster:ability:cast', ({ actor, targetId, abilityName }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    const label = String(abilityName || "ability");
    if (tgt === 'You') { log(`${who} unleashes ${label.toLowerCase()} on you!`, 'danger'); return; }
    log(`${who} unleashes ${label.toLowerCase()}.`, 'combat');
  });

  world.on('monster:firebreath', ({ actor, target, tiles }) => {
    if (!_playerCanSee([actor, target])) return;
    const who = nameOfEntity(actor);
    const len = Array.isArray(tiles) ? tiles.length : 0;
    const tgt = nameOfEntity(target);
    if (tgt === 'You') {
      log(`${who} opens its jaws \u2014 a torrent of fire roars toward you!`, 'danger');
    } else if (len > 3) {
      log(`${who} rears back and bathes the corridor in dragonfire!`, 'combat');
    } else {
      log(`${who} spews a gout of flame!`, 'combat');
    }
  });

  world.on('spell:death_volley', ({ actor, hits }) => {
    if (!_playerCanSee([actor])) return;
    const who = nameOfEntity(actor);
    const hitYou = Array.isArray(hits) && hits.some((hit) => nameOfEntity(hit?.id) === 'You');
    if (hitYou) { log(`${who}'s volley rains arrows across your position!`, 'danger'); return; }
    const count = Array.isArray(hits) ? hits.length : 0;
    if (count > 0) log(`${who}'s volley peppers ${count} target${count === 1 ? '' : 's'}.`, 'combat');
  });

  world.on('spell:boar_charge', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} slams into you like a battering ram! The ground shakes.`, 'danger');
      else if (missed) log(`${who} thunders past \u2014 the wind alone knocks you back!`, 'danger');
      else log(`${who} lowers its head and charges straight at you!`, 'danger');
      return;
    }
    if (hit) log(`${who} tramples ${tgt}.`, 'combat');
  });

  world.on('spell:boar_bite', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} clamps down on your arm \u2014 you feel bone grind!`, 'danger');
      else if (missed) log(`${who} snaps its jaws shut on empty air.`, 'combat');
      return;
    }
    if (hit) log(`${who} sinks its teeth into ${tgt}.`, 'combat');
  });

  world.on('spell:rat_gnaw', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} gnaws through your boot leather \u2014 blood wells up!`, 'danger');
      else if (missed) log(`${who} lunges for your ankle and misses.`, 'combat');
      return;
    }
    if (hit) log(`${who} gnaws into ${tgt}.`, 'combat');
  });

  world.on('spell:goblin_dirty_trick', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} hurls dirt in your eyes! You can't see!`, 'danger');
      else if (missed) log(`${who} tries to throw dirt in your eyes, but you flinch away.`, 'combat');
      return;
    }
    if (hit) log(`${who} blinds ${tgt} with a fistful of dirt.`, 'combat');
  });

  world.on('spell:snake_fang', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} buries its fangs in your flesh \u2014 venom burns through your veins!`, 'danger');
      else if (missed) log(`${who} strikes \u2014 fangs flash past your skin, barely missing.`, 'combat');
      return;
    }
    if (hit) log(`${who} sinks venomous fangs into ${tgt}.`, 'combat');
  });

  world.on('spell:spider_lunge', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} launches itself at your face! Legs everywhere!`, 'danger');
      else if (missed) log(`${who} pounces \u2014 you twist aside just in time.`, 'combat');
      return;
    }
    if (hit) log(`${who} pounces on ${tgt}.`, 'combat');
  });

  world.on('proc:bleeding', ({ actor, target }) => {
    if (!_playerCanSee([actor, target])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log(`Blood \u2014 yours \u2014 hits the floor. ${who} opened a wound.`, 'danger'); return; }
    if (who === 'You') { log(`You open a vein. ${tgt} starts to bleed.`, 'combat'); return; }
    log(`${who} opens a wound on ${tgt}.`, 'combat');
  });

  world.on('proc:hemorrhage', ({ actor, target }) => {
    if (!_playerCanSee([actor, target])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log(`The wound tears wider \u2014 blood pours freely!`, 'danger'); return; }
    if (who === 'You') { log(`${tgt}'s wound rips open. Blood everywhere.`, 'combat'); return; }
    log(`${who} tears ${tgt}'s wound wider.`, 'combat');
  });

  world.on('proc:paralyzed', ({ actor, target }) => {
    if (!_playerCanSee([actor, target])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log(`Your muscles lock up \u2014 you can't move!`, 'danger'); return; }
    if (who === 'You') { log(`Your blow locks ${tgt}'s joints solid!`, 'combat'); return; }
    log(`${who}'s strike paralyzes ${tgt}!`, 'combat');
  });

  world.on('spell:wolf_howl', ({ actor, alertedIds }) => {
    if (!_playerCanSee([actor])) return;
    const who = nameOfEntity(actor);
    const count = Array.isArray(alertedIds) ? alertedIds.length : 0;
    if (count > 0) { log(`${who} throws back its head and howls \u2014 ${count} more ${count === 1 ? 'answers' : 'answer'} from the dark!`, 'danger'); return; }
    log(`${who} howls. The sound echoes and dies.`, 'combat');
  });

  world.on('spell:shield_bash', ({ actor, targetId, hit, missed }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      if (hit) log(`${who} drives a shield into your chest \u2014 your ribs creak!`, 'danger');
      else if (missed) log(`${who} swings a shield at your head \u2014 you duck!`, 'combat');
      return;
    }
    if (hit) log(`${who} smashes a shield into ${tgt}.`, 'combat');
  });

  // Shield / dodge / parry combat messages
  world.on('shield:guarded', ({ id, source, stacks, broken }) => {
    if (!_playerCanSee([id, source])) return;
    const who = nameOfEntity(id);
    const attacker = nameOfEntity(source);
    if (who === 'You') {
      log(broken
        ? `Your shield catches the blow \u2014 and shatters!`
        : `Your shield catches ${attacker}'s blow. (${stacks} guard left)`, broken ? 'danger' : 'combat');
    } else {
      log(broken
        ? `${who}'s shield splinters under your attack!`
        : `${who} catches your blow on a shield.`, 'combat');
    }
  });

  world.on('combat:posture', ({ id, stance, previous, hasShield }) => {
    const who = nameOfEntity(id);
    if (who !== 'You') return;
    if (stance === 'guarded' && hasShield) log('You raise your shield.', 'combat');
    else if (previous === 'guarded' && hasShield) log('You lower your shield.', 'combat');
  });

  world.on('combat:dodge', ({ defender, attacker }) => {
    if (!_playerCanSee([defender, attacker])) return;
    const who = nameOfEntity(defender);
    const atk = nameOfEntity(attacker);
    if (who === 'You') log(`You twist aside \u2014 ${atk}'s attack sails past!`, 'combat');
    else log(`${who} sidesteps your attack!`, 'combat');
  });

  world.on('combat:parry', ({ defender, attacker, weaponName }) => {
    if (!_playerCanSee([defender, attacker])) return;
    const who = nameOfEntity(defender);
    const atk = nameOfEntity(attacker);
    const wName = String(weaponName || 'weapon');
    if (who === 'You') log(`Steel meets steel \u2014 you deflect ${atk}'s strike with your ${wName}!`, 'combat');
    else log(`${who} deflects your attack with a ringing parry!`, 'combat');
  });

  world.on('spell:acid_spit', ({ actor, targetId, hit }) => {
    if (!_playerCanSee([actor, targetId])) return;
    const who = nameOfEntity(actor);
    const tgt = nameOfEntity(targetId);
    if (tgt === 'You') {
      log(hit
        ? `${who} rears back and spits \u2014 acid sizzles across your skin!`
        : `${who} spits acid that spatters at your feet, hissing on the stone!`, 'danger');
      return;
    }
    log(`${who} hawks a glob of acid at ${tgt}.`, 'combat');
  });

  world.on('monster:death:fire_puff', ({ at }) => {
    if (!at || !canSeeAt(at.x, at.y)) return;
    log('The creature bursts \u2014 a flash of heat, then nothing but ash.', 'combat');
  });

  world.on('monster:death:gas_spore', ({ at }) => {
    if (!at || !canSeeAt(at.x, at.y)) return;
    log('The gas spore ruptures with a wet pop \u2014 toxic clouds billow outward!', 'danger');
  });

  world.on('proc:rot_grub:burrow', ({ actor, target }) => {
    if (!_playerCanSee([actor, target])) return;
    const tgt = nameOfEntity(target);
    if (tgt === 'You') { log('Something wriggles under your skin \u2014 a rot grub! You are bleeding badly!', 'danger'); return; }
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

  // ── Rarity colors for weapon names in combat log ──
  const _rarityColors = {
    common: '#ffffff', uncommon: '#1eff00', rare: '#55aaff',
    magic: '#55aaff', epic: '#c47bff', legendary: '#ff9f3b',
  };
  function _weaponHtml(wid) {
    const wname = compGet(wid, NamedIdentity)?.name;
    if (!wname) return '';
    const info = compGet(wid, ItemInfo);
    const rn = String(info?.rarityName || 'common').toLowerCase();
    const color = _rarityColors[rn] || '#ffffff';
    return ` with <b style="color:${color}" data-entity-id="${wid}" data-tip="item">[${wname}]</b>`;
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
    shadow:    ['torment', 'torments'],
    nature:    ['ravage', 'ravages'],
    generic:   ['wound', 'wounds'],
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
    const usingRanged = causeKey === 'ranged';
    const isMelee = causeKey === 'melee' || causeKey === 'retaliation' || !!impactProfile;
    const isWeaponHit = isMelee || usingRanged;
    const dt = String(type || '').toLowerCase();
    const attackKind = impactProfile?.attackKind || '';

    if (Number(source || 0)) {
      const atkName = nameOfEntity(source);

      if (!isWeaponHit) {
        const pair = _spellVerbs[dt] || ['hit', 'hits'];
        log(`${atkName} ${_v(atkName, pair[0], pair[1])} ${defName} for ${amount}${critTxt}.`, 'combat');
        return;
      }

      // Melee / ranged — resolve weapon
      let weaponPlain = '';
      let weaponRich = '';
      const eq = compGet(Number(source || 0), Equipment);
      const wid = offhand
        ? Number(eq?.offhand || 0)
        : (usingRanged ? Number(eq?.ranged || 0) : Number(eq?.weapon || 0));
      if (wid) {
        weaponRich = _weaponHtml(wid);
        const wname = compGet(wid, NamedIdentity)?.name;
        if (wname) weaponPlain = ` with ${bracketizeName(wname)}`;
      } else if (!offhand && compHas(Number(source || 0), Player)) {
        weaponPlain = ' with bare fists';
        weaponRich = ' with bare fists';
      }
      const pair = (isCrit && _critMelee[attackKind])
        || _meleeVerbs[attackKind]
        || ['hit', 'hits'];
      const verb = _v(atkName, pair[0], pair[1]);
      const text = `${atkName} ${verb} ${defName}${weaponPlain} for ${amount}${critTxt}${handTxt}.`;
      const html = weaponRich
        ? `${atkName} ${verb} ${defName}${weaponRich} for ${amount}${critTxt}${handTxt}.`
        : undefined;
      log({ text, html, type: 'combat' });
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
