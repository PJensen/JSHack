// Combat Balance Simulation v2 — uses real archetypes, real systems, real hooks
// Run: deno run --allow-read tests/combatSim.mjs

import { World } from '../src/lib/ecs-js/index.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Position } from '../src/rules/components/Position.js';
import { Stamina } from '../src/rules/components/Stamina.js';
import { BaseStats } from '../src/rules/components/BaseStats.js';
import { Player } from '../src/rules/components/Player.js';
import { AggroState, AGGRO_LEVELS } from '../src/rules/components/AggroState.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { RangedAttackIntent } from '../src/rules/components/Intents/RangedAttackIntent.js';

// Real archetypes & factories
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { spawnMonsterEntity } from '../src/rules/utils/spawnMonsterEntity.js';
import { createItemById } from '../src/rules/utils/itemFactory.js';

// Real systems
import { configureWorld } from '../src/main/scheduler.js';
import { resolveMeleeAttack } from '../src/rules/systems/combatSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { effectSystem } from '../src/rules/systems/effectSystem.js';
import { staminaRegenerationSystem } from '../src/rules/systems/staminaRegenerationSystem.js';
import { cleanupSystem } from '../src/rules/systems/cleanupSystem.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { rangedAttackSystem } from '../src/rules/systems/rangedAttackSystem.js';
import { resolveCombatSnapshot } from '../src/rules/utils/resolveCombatSnapshot.js';

// Data
import { MONSTERS, getMonster, resolveMonsterMaxHp } from '../src/rules/data/monsters.js';
import { CLASS_DEFS } from '../src/rules/data/classes.js';

// ── Helper: convert MONSTERS def → spawnMonsterEntity params ────────────

function monsterParams(monsterId, depth) {
  const def = getMonster(monsterId);
  if (!def) throw new Error(`Unknown monster: ${monsterId}`);
  const hp = resolveMonsterMaxHp(def, depth);

  // Same mapping as mutations.js / populate.js
  return {
    name: def.name,
    identity: def.id,
    maxHp: hp,
    faction: 'enemy',
    accuracyDerived: def.attack || 0,
    damagePowerDerived: def.attack || 0,
    evadeDerived: def.defense || 0,
    naturalDamageDice: def.damageDice || '1d2',
    sizeClass: def.sizeClass,
    massKg: def.massKg || 80,
    resistances: def.resistances || {},
    speed: def.speed || 1,
    learnedSpellIds: def.learnedSpellIds || [],
    maxMana: def.maxMana || 0,
    manaRegen: def.manaRegen || 0,
  };
}

// ── Simulation using real archetypes + targeted system calls ────────────

function simulateFight(classId, monsterId, depth, numSeeds = 500, opts = {}) {
  const cls = CLASS_DEFS[classId];
  const maxTurns = 300;
  const playerAttackMode = opts.playerAttackMode === 'ranged' ? 'ranged' : 'melee';
  const overrideRangedWeaponId = typeof opts.rangedWeaponId === 'string' ? opts.rangedWeaponId : '';
  const overrideAmmoId = typeof opts.ammoId === 'string' ? opts.ammoId : '';
  const results = {
    playerHits: 0, playerMisses: 0, playerTotalDmg: 0, playerMaxDmg: 0,
    monsterHits: 0, monsterMisses: 0, monsterTotalDmg: 0,
    playerWins: 0, monsterWins: 0, totalTurns: 0, fights: 0,
    playerHpRemaining: 0,
    playerEffectsApplied: {},  // track status effects
  };

  for (let seed = 1; seed <= numSeeds; seed++) {
    const world = new World({ seed });

    // Full system configuration (installs all event listeners, virtuals, hooks)
    configureWorld(world);

    world.step = 0;

    // Track damage via real event system
    let playerId = 0, monstEid = 0;
    let playerDmgThisTurn = 0, monsterDmgThisTurn = 0;
    let playerHitThisTurn = false, monsterHitThisTurn = false;

    world.on('damaged', ({ target, amount }) => {
      if (target === monstEid) {
        playerDmgThisTurn += amount;
        playerHitThisTurn = true;
      } else if (target === playerId) {
        monsterDmgThisTurn += amount;
        monsterHitThisTurn = true;
      }
    });

    // Create player using REAL archetype (gets proper DR 4, resistances, all components)
    playerId = createPlayer(world, {
      x: 5, y: 5,
      name: cls.name,
      identity: classId,
      maxHp: cls.stats.maxHp,
      maxStamina: cls.stats.maxStamina,
      staminaRegen: cls.stats.staminaRegen || 3,
    });

    // Set BaseStats for DEX/INT (drives accuracy/evade via derivedStats pipeline)
    try {
      world.add(playerId, BaseStats, {
        dexterity: cls.stats.dexterity || 0,
        intelligence: cls.stats.intelligence || 0,
        strength: 0,
        vitality: 0,
      });
    } catch { /* might already exist from archetype */ }

    // Equip class weapon using REAL item factory
    const eq = world.get(playerId, Equipment);
    if (cls.equipment.weapon) {
      const wId = createItemById(world, cls.equipment.weapon);
      if (wId && eq) eq.weapon = wId;
    }
    if (cls.equipment.armor) {
      const aId = createItemById(world, cls.equipment.armor);
      if (aId && eq) eq.armor = aId;
    }
    if (cls.equipment.offhand) {
      const oId = createItemById(world, cls.equipment.offhand);
      if (oId && eq) eq.offhand = oId;
    }
    if (playerAttackMode === 'ranged' && eq) {
      if (overrideRangedWeaponId) {
        const rwId = createItemById(world, overrideRangedWeaponId);
        if (rwId) eq.ranged = rwId;
      }
      if (overrideAmmoId) {
        const ammoEntityId = createItemById(world, overrideAmmoId, { count: maxTurns + 25 });
        if (ammoEntityId) eq.ammo = ammoEntityId;
      }
    }

    // Create monster using REAL spawn function (gets proper Monster archetype, hooks, AggroState)
    const mp = monsterParams(monsterId, depth);
    monstEid = spawnMonsterEntity(world, { ...mp, x: 5, y: 6 });

    // Force monster into hunting state (simulates: monster has seen the player)
    const aggro = world.get(monstEid, AggroState);
    if (aggro) {
      aggro.alertLevel = AGGRO_LEVELS.hunting;
      aggro.lastKnownX = 5;
      aggro.lastKnownY = 5;
    }

    // Initial equipment resolution
    equipmentSystem(world);

    let turn = 0;

    for (turn = 1; turn <= maxTurns; turn++) {
      world.step = turn;

      // ── Player attacks monster ──
      playerDmgThisTurn = 0;
      playerHitThisTurn = false;
      let pAttempted = false;
      if (playerAttackMode === 'ranged') {
        try {
          world.add(playerId, RangedAttackIntent, { targetId: monstEid, toX: 5, toY: 6 });
        } catch {
          world.set(playerId, RangedAttackIntent, { targetId: monstEid, toX: 5, toY: 6 });
        }
        rangedAttackSystem(world);
        pAttempted = true;
      } else {
        pAttempted = resolveMeleeAttack(world, playerId, monstEid);
      }
      if (pAttempted) {
        if (playerHitThisTurn) {
          results.playerHits++;
          results.playerTotalDmg += playerDmgThisTurn;
          if (playerDmgThisTurn > results.playerMaxDmg) results.playerMaxDmg = playerDmgThisTurn;
        } else {
          results.playerMisses++;
        }
      }

      // Check monster death
      const mVit = world.get(monstEid, Vitality);
      if (!mVit || (mVit.hp | 0) <= 0) {
        results.playerWins++;
        results.playerHpRemaining += (world.get(playerId, Vitality)?.hp || 0);
        break;
      }

      // ── Monster attacks player ──
      monsterDmgThisTurn = 0;
      monsterHitThisTurn = false;
      const mAttempted = resolveMeleeAttack(world, monstEid, playerId);
      if (mAttempted) {
        if (monsterHitThisTurn) {
          results.monsterHits++;
          results.monsterTotalDmg += monsterDmgThisTurn;
        } else {
          results.monsterMisses++;
        }
      }

      // Run status effects (burn, bleed, poison, regen, etc.) — the real system
      try { effectSystem(world); } catch {}

      // Run stamina regen
      try { staminaRegenerationSystem(world); } catch {}

      // Run cleanup (death processing)
      try { cleanupSystem(world); } catch {}

      // Check player death (may have died from DoT effects)
      const pVit = world.get(playerId, Vitality);
      if (!pVit || (pVit.hp | 0) <= 0) {
        results.monsterWins++;
        break;
      }
      // Check monster death (may have died from DoT effects)
      const mVit2 = world.get(monstEid, Vitality);
      if (!mVit2 || (mVit2.hp | 0) <= 0) {
        results.playerWins++;
        results.playerHpRemaining += (pVit?.hp || 0);
        break;
      }
    }

    // Track status effects applied to player
    const pEffects = world.get(playerId, ActiveEffects);
    if (pEffects?.effects) {
      for (const e of pEffects.effects) {
        results.playerEffectsApplied[e.key] = (results.playerEffectsApplied[e.key] || 0) + 1;
      }
    }

    results.totalTurns += turn;
    results.fights++;
  }

  return results;
}

// ── Snapshot dump: show what the engine actually computes for an entity ──

function dumpSnapshot(label, classId, monsterId, depth) {
  const cls = CLASS_DEFS[classId];
  const world = new World({ seed: 42 });
  configureWorld(world);

  const playerId = createPlayer(world, {
    x: 5, y: 5, name: cls.name, identity: classId,
    maxHp: cls.stats.maxHp, maxStamina: cls.stats.maxStamina,
  });
  try {
    world.add(playerId, BaseStats, {
      dexterity: cls.stats.dexterity || 0,
      intelligence: cls.stats.intelligence || 0,
    });
  } catch {}

  const eq = world.get(playerId, Equipment);
  if (cls.equipment.weapon) { const w = createItemById(world, cls.equipment.weapon); if (w && eq) eq.weapon = w; }
  if (cls.equipment.armor) { const a = createItemById(world, cls.equipment.armor); if (a && eq) eq.armor = a; }
  if (cls.equipment.offhand) { const o = createItemById(world, cls.equipment.offhand); if (o && eq) eq.offhand = o; }

  const mp = monsterParams(monsterId, depth);
  const monstEid = spawnMonsterEntity(world, { ...mp, x: 5, y: 6 });

  equipmentSystem(world);

  const pSnap = resolveCombatSnapshot(world, playerId, { mode: 'melee' });
  const mSnap = resolveCombatSnapshot(world, monstEid, { mode: 'melee' });

  console.log(`  ${label}`);
  console.log(`    Player: atkBonus=${pSnap.attackBonus} AC=${pSnap.armorClass} dmgFlat=+${pSnap.damageFlatBonus} dmgMult=${pSnap.damageMult.toFixed(2)} crit=${(pSnap.critChance*100).toFixed(1)}%`);
  console.log(`    Monster: atkBonus=${mSnap.attackBonus} AC=${mSnap.armorClass} dmgFlat=+${mSnap.damageFlatBonus} dmgMult=${mSnap.damageMult.toFixed(2)}`);
}

// ── Formatting ──────────────────────────────────────────────────────────

function formatResults(label, r) {
  const pHitRate = r.playerHits + r.playerMisses > 0
    ? ((r.playerHits / (r.playerHits + r.playerMisses)) * 100).toFixed(1) : '0.0';
  const pAvgDmg = r.playerHits > 0
    ? (r.playerTotalDmg / r.playerHits).toFixed(1) : '0.0';
  const mHitRate = r.monsterHits + r.monsterMisses > 0
    ? ((r.monsterHits / (r.monsterHits + r.monsterMisses)) * 100).toFixed(1) : '0.0';
  const mAvgDmg = r.monsterHits > 0
    ? (r.monsterTotalDmg / r.monsterHits).toFixed(1) : '0.0';
  const avgTurns = r.fights > 0 ? (r.totalTurns / r.fights).toFixed(1) : '0.0';
  const winRate = r.fights > 0 ? ((r.playerWins / r.fights) * 100).toFixed(1) : '0.0';
  const avgHpLeft = r.playerWins > 0 ? (r.playerHpRemaining / r.playerWins).toFixed(1) : '0.0';
  const effects = Object.entries(r.playerEffectsApplied || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .slice(0, 3)
    .join(' ');

  return { label, pHitRate: pHitRate + '%', pAvgDmg, pMaxDmg: String(r.playerMaxDmg),
    mHitRate: mHitRate + '%', mAvgDmg, avgTurns, winRate: winRate + '%', avgHpLeft, effects };
}

// ── Scenarios ───────────────────────────────────────────────────────────

const SCENARIOS = [
  { label: 'Warden vs Goblin (d1)',       classId: 'warden',      monster: 'goblin',   depth: 1 },
  { label: 'Outlaw vs Goblin (d1)',        classId: 'outlaw',      monster: 'goblin',   depth: 1 },
  { label: 'Druid vs Goblin (d1)',         classId: 'druid',       monster: 'goblin',   depth: 1 },
  { label: 'Cleric vs Goblin (d1)',        classId: 'cleric',      monster: 'goblin',   depth: 1 },
  { label: 'Archeologist vs Goblin (d1)',  classId: 'archeologist', monster: 'goblin',   depth: 1 },
  { label: 'Warlock vs Goblin (d1)',       classId: 'warlock',     monster: 'goblin',   depth: 1 },
  { label: '---', sep: true },
  { label: 'Warden vs Rat (d1)',           classId: 'warden',      monster: 'rat',      depth: 1 },
  { label: 'Warden vs Goblin Archer (d2)', classId: 'warden',      monster: 'goblin_archer', depth: 2 },
  { label: 'Warden vs Goblin (d3)',        classId: 'warden',      monster: 'goblin',   depth: 3 },
  { label: 'Warden vs Spider (d4)',        classId: 'warden',      monster: 'spider',   depth: 4 },
  { label: 'Warden vs Orc (d6)',           classId: 'warden',      monster: 'orc',      depth: 6 },
  { label: 'Warden vs Skeleton (d6)',      classId: 'warden',      monster: 'skeleton', depth: 6 },
  {
    label: 'Warden (Bow+Bodkin) vs Skeleton (d6)',
    classId: 'warden',
    monster: 'skeleton',
    depth: 6,
    opts: { playerAttackMode: 'ranged', rangedWeaponId: 'bow_short', ammoId: 'ammo_bodkin_arrows' },
  },
  { label: 'Warden vs Hobgoblin (d8)',     classId: 'warden',      monster: 'hobgoblin', depth: 8 },
  { label: 'Outlaw vs Skeleton (d6)',      classId: 'outlaw',      monster: 'skeleton', depth: 6 },
  { label: 'Cleric vs Skeleton (d6)',      classId: 'cleric',      monster: 'skeleton', depth: 6 },
];

// ── Run ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════════════════════════');
console.log('  COMBAT SIM v2 — tier 0/1 baseline + ranged probe, real archetypes/hooks/effects (500 seeds/scenario)');
console.log('  Player DR=4 (from PlayerArchetype), Monster hooks active (bleed/stun/disease/etc)');
console.log('══════════════════════════════════════════════════════════════════════════════════════\n');

// Dump real combat snapshots first
console.log('Resolved Combat Snapshots (what the engine actually computes):');
console.log('─'.repeat(80));
dumpSnapshot('Warden vs Goblin d1', 'warden', 'goblin', 1);
dumpSnapshot('Outlaw vs Goblin d1', 'outlaw', 'goblin', 1);
dumpSnapshot('Warden vs Orc d6', 'warden', 'orc', 6);
dumpSnapshot('Warden vs Hobgoblin d8', 'warden', 'hobgoblin', 8);
console.log('');

const header = [
  'Scenario'.padEnd(36),
  'P.Hit%'.padStart(7),
  'P.AvgDmg'.padStart(9),
  'P.MaxDmg'.padStart(9),
  'M.Hit%'.padStart(7),
  'M.AvgDmg'.padStart(9),
  'AvgTurns'.padStart(9),
  'P.Win%'.padStart(7),
  'AvgHPLeft'.padStart(10),
  'Effects on Player'.padStart(20),
].join(' │ ');

console.log(header);
console.log('─'.repeat(header.length));

for (const sc of SCENARIOS) {
  if (sc.sep) {
    console.log('─'.repeat(header.length));
    continue;
  }

  const r = simulateFight(sc.classId, sc.monster, sc.depth, 500, sc.opts || {});
  const f = formatResults(sc.label, r);

  const row = [
    f.label.padEnd(36),
    f.pHitRate.padStart(7),
    f.pAvgDmg.padStart(9),
    f.pMaxDmg.padStart(9),
    f.mHitRate.padStart(7),
    f.mAvgDmg.padStart(9),
    f.avgTurns.padStart(9),
    f.winRate.padStart(7),
    f.avgHpLeft.padStart(10),
    (f.effects || '').padStart(20),
  ].join(' │ ');
  console.log(row);
}

console.log('\n');
