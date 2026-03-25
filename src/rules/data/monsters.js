// rules/data/monsters.js
// Central monster definitions. Each entry feeds into pickMonster() for spawning
// and the Monster archetype for ECS creation.
//
// All combat behavior lives here on the monster it governs — callbacks are
// plain (ctx) => void functions invoked via runCallbackList.
import {
  statusEffectOnHit,
  selfBuffOnHit,
  drainOnHit,
  bonusDamageOnBeforeHit,
  bonusDamageIfTargetAfflicted,
  healOnDamaged,
  retaliateOnDamaged,
  statusEffectOnDamaged,
  phaseOutOnDamaged,
  mindflayerBlastOnHit,
  corrodeEquipmentOnHit,
  stealAndBlinkOnHit,
} from "./callbacks/combat.js";
import { selfThrowNearTargetOnSeen, gazeOnLOS, fireBreathLineOnLOS, castSpellOnLOS } from "./callbacks/ai.js";
import { spawnPlasmaCloudOnDeath, centipedeSplitOnDeath } from "./callbacks/death.js";

export const MONSTERS = [
  // ── Tier 0 (floors 1-5) ────────────────────────────────────────────
  {
    id: 'rat',
    name: 'Rat',
    tags: ['beast', 'vermin'],
    tier: 0,
    intelligence: 2,   // basic animal instinct
    packSense: true, packRadius: 6,
    baseHp: 5,
    hpPerLevel: 1,
    attack: 0,
    defense: 0,
    damageDice: '1d3',
    sizeClass: 'S',
    massKg: 2,
    resistances: { kinetic: { DR: 0 } },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(25, 0xdead0001, { key: "disease", turnsLeft: 20, potency: 1 }, "proc:diseased")],
    },
    specials: ["Disease 25%"],
    description: 'A mangy rodent with beady eyes.',
    corpseEat: { behavior: "scavenge", hpThreshold: 0.60, cooldownTurns: 5 },
  },
  {
    id: 'goblin',
    name: 'Goblin',
    tags: ['humanoid'],
    tier: 0,
    intelligence: 4,   // pack animal — cunning enough to call for help
    packSense: true, packRadius: 8,
    baseHp: 8,
    hpPerLevel: 1.5,
    attack: 1,
    defense: 0,
    damageDice: '1d4',
    sizeClass: 'S',
    massKg: 30,
    resistances: { kinetic: { DR: 0 } },
    speed: 2,
    wielding: [
      "goblin_jagged_shiv",
      "goblin_jagged_shiv",
      "goblin_jagged_shiv",
      "goblin_jagged_shiv",
      "goblin_shiv",
    ],
    hooks: null,
    specials: ["Wields a shiv (often jagged)"],
    description: 'A sneering green-skinned runt armed with a rusty dagger.',
    lootTable: 'drop:goblin',
    corpseEat: { behavior: "scavenge", hpThreshold: 0.70, cooldownTurns: 5 },
  },
  {
    id: 'goblin_archer',
    name: 'Goblin Archer',
    tags: ['humanoid'],
    tier: 0,
    intelligence: 4,
    packSense: true, packRadius: 8,
    baseHp: 7,
    hpPerLevel: 1,
    attack: 1,
    defense: 0,
    damageDice: '1d4',
    sizeClass: 'S',
    massKg: 30,
    resistances: { kinetic: { DR: 0 } },
    speed: 2,
    equipped: [
      { slot: "ranged", itemId: "goblin_barbed_shortbow" },
      { slot: "ranged", itemId: "bow_short" },
      { slot: "ammo", itemId: "ammo_arrows" },
    ],
    hooks: null,
    specials: ["May spawn with barbed bow"],
    description: 'A goblin with a crude shortbow and a quiver of bent arrows.',
    lootTable: 'drop:goblin',
  },
  {
    id: 'bat',
    name: 'Bat',
    tags: ['beast', 'vermin'],
    lootTable: 'drop:bat',
    tier: 0,
    canFly: true,
    intelligence: 2,   // basic animal instinct
    aggro: 'passive',  // doesn't attack on sight — only when struck
    baseHp: 3,
    hpPerLevel: 0.5,
    attack: 0,
    defense: 0,
    damageDice: '1d2',
    sizeClass: 'XS',
    massKg: 1,
    resistances: { kinetic: { DR: 0 } },
    speed: 3,
    hooks: {
      onHit: [statusEffectOnHit(15, 0xdead0006, { key: "stun", turnsLeft: 1, potency: 1 }, "proc:stunned")],
    },
    specials: ["Stun 15%"],
    description: 'A leathery-winged vermin that darts erratically.',
  },

  {
    id: 'grid_bug',
    name: 'Grid Bug',
    tags: ['beast', 'vermin', 'electric'],
    tier: 0,
    intelligence: 1,   // mindless; instinct only
    baseHp: 3,
    hpPerLevel: 0.5,
    attack: 0,
    defense: 0,
    damageDice: '1d2',
    sizeClass: 'XS',
    massKg: 1,
    resistances: { kinetic: { DR: 0 }, electric: { ohms: Infinity } },
    speed: 1,
    hooks: {
      onHit: [statusEffectOnHit(30, 0xdead0010, { key: "shock", turnsLeft: 2, potency: 1 }, "proc:shocked")],
      onDeath: [spawnPlasmaCloudOnDeath({ turnsLeft: 3, radius: 1, damage: 2 })],
    },
    specials: ["Shock 30%"],
    description: 'A tiny crackling insect that moves only along the grid axes.',
  },

  {
    id: 'cave_snake',
    name: 'Cave Snake',
    tags: ['beast'],
    tier: 0,
    intelligence: 2,   // basic animal instinct
    aggro: 'passive',  // harmless unless provoked
    baseHp: 5,
    hpPerLevel: 1,
    attack: 0,
    defense: 0,
    damageDice: '1d2',
    sizeClass: 'XS',
    massKg: 2,
    resistances: { kinetic: { DR: 0 } },
    speed: 3,
    hooks: null,
    specials: [],
    description: 'A small, harmless serpent that slithers through the dark.',
  },
  {
    id: 'cave_spider',
    name: 'Cave Spider',
    tags: ['beast'],
    tier: 0,
    intelligence: 3,   // cunning predator
    packSense: true, packRadius: 5,
    baseHp: 6,
    hpPerLevel: 1,
    attack: 0,
    defense: 0,
    damageDice: '1d3',
    sizeClass: 'S',
    massKg: 8,
    resistances: { kinetic: { DR: 0 } },
    speed: 2,
    hooks: {
      onSeen: [selfThrowNearTargetOnSeen({ searchRadius: 1, fallbackSearchRadius: 2, cooldownTurns: 3, chance: 0.25 })],
    },
    specials: ["Throws web (25%)"],
    description: 'A skittish arachnid. It spins webs but lacks venom.',
  },

  {
    id: 'snake',
    name: 'Snake',
    tags: ['beast', 'venomous'],
    tier: 0,
    intelligence: 2,   // basic animal instinct
    aggro: 'passive',  // defensive — strikes only when approached
    baseHp: 6,
    hpPerLevel: 1,
    attack: 0,
    defense: 0,
    damageDice: '1d3',
    sizeClass: 'XS',
    massKg: 3,
    resistances: { kinetic: { DR: 0 }, chemical: { toxMult: 0 } },
    speed: 3,
    hooks: {
      onHit: [statusEffectOnHit(25, 0xdead000f, { key: "poison", turnsLeft: 5, potency: 1 }, "proc:poisoned")],
    },
    specials: ["Poison 25%"],
    description: 'A hissing serpent with venomous fangs.',
  },

  {
    id: 'pit_viper',
    name: 'Pit Viper',
    tags: ['beast', 'venomous', 'venom_glowing', 'rare'],
    tier: 0,
    rare: true,
    intelligence: 2,   // basic animal instinct
    baseHp: 20,
    hpPerLevel: 1.5,
    attack: 2,
    defense: 0,
    damageDice: '1d4',
    sizeClass: 'XS',
    massKg: 4,
    resistances: { kinetic: { DR: 0 }, chemical: { toxMult: 0 } },
    speed: 3,
    hooks: {
      onHit: [statusEffectOnHit(30, 0xdead0010, { key: "poison", turnsLeft: 4, potency: 1 }, "proc:poisoned")],
    },
    specials: ["Poison 30%"],
    description: 'A thick-bodied serpent with iridescent scales. Its bite delivers a potent venom.',
    lootTable: 'drop:pit_viper',
  },

  {
    id: 'cave_bear',
    name: 'Cave Bear',
    tags: ['beast', 'rare'],
    tier: 0,
    intelligence: 3,   // predatory instinct
    baseHp: 28,
    hpPerLevel: 2,
    attack: 4,
    defense: 2,
    damageDice: '2d6',
    sizeClass: 'L',
    massKg: 350,
    resistances: { kinetic: { DR: 3 } },
    speed: 1,
    hooks: {
      onHit: [statusEffectOnHit(30, 0xdead0200, { key: "stun", turnsLeft: 2, potency: 1 }, "proc:stunned")],
    },
    specials: ["Stun 30%"],
    description: 'A massive bear with matted fur and scarred hide. Its claws can split stone.',
  },
  {
    id: 'dragon_whelp',
    name: 'Dragon Whelp',
    tags: ['beast', 'draconic', 'rare', 'glowing'],
    tier: 0,
    canFly: true,
    rare: true,
    intelligence: 6,   // cunning enough to hold lanes and punish open sight lines
    visionRange: 9,
    retreatHpPct: 0.20,
    baseHp: 24,
    hpPerLevel: 2.5,
    attack: 4,
    defense: 3,
    damageDice: '1d8',
    sizeClass: 'L',
    massKg: 240,
    resistances: {
      kinetic: { DR: 5, pierceMult: 0.85 },
      thermal: { igniteC: Infinity, burnMult: 0 },
    },
    speed: 2,
    hooks: {
      whileLOS: [fireBreathLineOnLOS({
        minRange: 2,
        maxRange: 6,
        cooldownTurns: 6,
        damage: 4,
        hazardDamage: 1,
        hazardTurns: 3,
        burnTurns: 3,
        burnPotency: 2,
      })],
      onHit: [statusEffectOnHit(20, 0xdead0201, { key: "burn", turnsLeft: 3, potency: 2 }, "proc:burning")],
    },
    specials: ["Fire breath", "Burn 20%"],
    description: 'A juvenile dragon whose breath already runs hotter than a forge. Even its scales throw heat into the dark.',
    lootTable: 'drop:dragon_whelp',
  },

  {
    id: 'skeleton_archer',
    name: 'Skeleton Archer',
    tags: ['undead', 'skeletal'],
    tier: 0,
    intelligence: 5,   // humanoid dim — follows orders
    packSense: true, packRadius: 8,
    baseHp: 6,
    hpPerLevel: 1,
    attack: 2,
    defense: 0,
    damageDice: '1d4',
    sizeClass: 'M',
    massKg: 25,
    resistances: {
      kinetic: { DR: 2, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: null,
    specials: [],
    description: 'A rattling skeleton clutching a short bow.',
    equipment: { ranged: 'bow_short', ammo: 'arrows' },
  },

  {
    id: 'skeletal_shadow_caster',
    name: 'Skeletal Shadow Caster',
    tags: ['undead', 'skeletal', 'caster'],
    tier: 1,
    intelligence: 9,
    visionRange: 9,
    packSense: true, packRadius: 8,
    baseHp: 9,
    hpPerLevel: 1.4,
    attack: 1,
    defense: 1,
    damageDice: '1d4',
    sizeClass: 'M',
    massKg: 24,
    resistances: {
      kinetic: { DR: 3, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    learnedSpellIds: ['shadow_bolt'],
    maxMana: 36,
    manaRegen: 0.14,
    hooks: {
      whileLOS: [
        castSpellOnLOS({
          spellId: 'shadow_bolt',
          minRange: 2,
          maxRange: 10,
          cooldownTurns: 9,
          chance: 0.6,
        }),
      ],
    },
    specials: ['Casts Shadow Bolt'],
    description: 'A rune-etched skeleton that hurls bolts of abyssal shade from behind the line.',
  },

  {
    id: 'floating_eye',
    name: 'Floating Eye',
    tags: ['aberration', 'psychic'],
    tier: 0,
    intelligence: 2,   // dumb (≤3 triggers scurry: wanders randomly when unaware)
    visionRange: 6,
    ambush: true,
    baseHp: 14,
    hpPerLevel: 1.5,
    attack: 1,
    defense: 2,
    damageDice: '1d4',
    sizeClass: 'M',
    massKg: 40,
    resistances: {
      chemical: { toxMult: 0 },
      electric: { ohms: 30 },
    },
    speed: 1,
    hooks: {
      whileLOS: [gazeOnLOS(4, 8, 3)],
      onHit: [mindflayerBlastOnHit(10, 0xdead000e)],
    },
    description: 'A pulsing violet eye that drifts in silence. Gaze into it too long and your mind unravels.',
  },

  {
    id: 'kobold_shaman',
    name: 'Kobold Shaman',
    tags: ['humanoid', 'kobold', 'caster'],
    tier: 0,
    intelligence: 8,   // smart caster — retreats when pressured
    visionRange: 9,
    retreatHpPct: 0.30,
    baseHp: 6,
    hpPerLevel: 1,
    attack: 0,
    defense: 0,
    damageDice: '1d3',
    sizeClass: 'S',
    massKg: 25,
    resistances: { kinetic: { DR: 0 } },
    speed: 2,
    learnedSpellIds: ['lightning'],
    maxMana: 21,
    manaRegen: 0.14,
    hooks: {
      whileLOS: [
        castSpellOnLOS({
          spellId: 'lightning',
          minRange: 2,
          maxRange: 10,
          cooldownTurns: 8,
          chance: 0.65,
        }),
      ],
      onHit: [statusEffectOnHit(25, 0xdead0300, { key: "shock", turnsLeft: 2, potency: 1 }, "proc:shocked")],
    },
    specials: ['Casts Lightning', 'Shock 25%'],
    description: 'A scrawny kobold draped in fraying cloth, crackling with stolen thunder.',
  },

  // ── Tier 1 (floors 6-10) ───────────────────────────────────────────
  {
    id: 'bone_bowman',
    name: 'Bone Bowman',
    tags: ['undead', 'skeletal'],
    tier: 1,
    intelligence: 5,   // humanoid dim
    packSense: true, packRadius: 8,
    baseHp: 10,
    hpPerLevel: 1.5,
    attack: 3,
    defense: 1,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 25,
    resistances: {
      kinetic: { DR: 3, bluntMult: 1.6, pierceMult: 0.6, slashMult: 0.8 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(20, 0xdead0020, { key: "bleed", turnsLeft: 3, potency: 1 }, "proc:bleeding")],
    },
    specials: ["Bleed 20%"],
    description: 'A skeletal bowman with practiced aim. Its arrows leave jagged wounds.',
    equipment: { ranged: 'bow_short', ammo: 'arrows' },
  },
  {
    id: 'skeletal_agony_warlock',
    name: 'Skeletal Agony Warlock',
    tags: ['undead', 'skeletal', 'caster', 'warlock'],
    tier: 0,
    intelligence: 10,
    visionRange: 9,
    retreatHpPct: 0.25,
    baseHp: 13,
    hpPerLevel: 1.8,
    attack: 2,
    defense: 2,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 26,
    resistances: {
      kinetic: { DR: 2, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
      electric: { ohms: 60 },
    },
    speed: 2,
    learnedSpellIds: ['agony', 'summon_skeleton', 'shadow_bolt'],
    maxMana: 58,
    manaRegen: 0.22,
    hooks: {
      whileLOS: [
        castSpellOnLOS({
          spellId: 'summon_skeleton',
          targeting: 'self',
          cooldownTurns: 18,
          chance: 0.35,
          maxAlliesInRadius: 4,
          allyRadius: 7,
        }),
        castSpellOnLOS({
          spellId: 'agony',
          minRange: 1,
          maxRange: 8,
          cooldownTurns: 8,
          chance: 1,
        }),
        castSpellOnLOS({
          spellId: 'shadow_bolt',
          minRange: 1,
          maxRange: 10,
          cooldownTurns: 10,
          chance: 0.45,
        }),
      ],
    },
    specials: ['Casts Agony', 'Summons Skeletons', 'Casts Shadow Bolt'],
    description: 'A black-boned warlock that curses from range and drags fresh skeletons into the fight.',
  },
  {
    id: 'orc',
    name: 'Orc',
    tags: ['humanoid'],
    tier: 1,
    intelligence: 5,   // humanoid dim — brute
    packSense: true, packRadius: 8,
    baseHp: 15,
    hpPerLevel: 2,
    attack: 2,
    defense: 1,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 95,
    resistances: { kinetic: { DR: 3 } },
    speed: 2,
    hooks: {
      onBeforeHit: [bonusDamageOnBeforeHit(25, 0xdead0007, 2, "proc:rage")],
    },
    specials: ["Rage +2 dmg (25%)"],
    description: 'A thick-skulled brute with a chipped cleaver.',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    tags: ['undead', 'skeletal'],
    tier: 1,
    intelligence: 4,   // pack animal — horde behavior
    packSense: true, packRadius: 8,
    baseHp: 12,
    hpPerLevel: 1.8,
    attack: 1,
    defense: 2,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 25,
    resistances: {
      kinetic: { DR: 4, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: {
      onDamaged: [healOnDamaged(20, 0xdead0008, 2, "proc:reassemble")],
    },
    specials: ["Self-heal 2 HP (20%)"],
    description: 'Bones held together by spite. Resistant to piercing but brittle against blunt force.',
  },
  {
    id: 'orc_shaman',
    name: 'Orc Shaman',
    tags: ['humanoid', 'caster'],
    tier: 1,
    intelligence: 8,
    visionRange: 9,
    retreatHpPct: 0.30,
    packSense: true, packRadius: 8,
    baseHp: 12,
    hpPerLevel: 1.5,
    attack: 1,
    defense: 1,
    damageDice: '1d4',
    sizeClass: 'M',
    massKg: 90,
    resistances: { kinetic: { DR: 3 } },
    speed: 2,
    learnedSpellIds: ['frost', 'heal'],
    maxMana: 30,
    manaRegen: 0.16,
    hooks: {
      whileLOS: [
        castSpellOnLOS({
          spellId: 'heal',
          targeting: 'self',
          cooldownTurns: 15,
          chance: 0.40,
        }),
        castSpellOnLOS({
          spellId: 'frost',
          minRange: 2,
          maxRange: 9,
          cooldownTurns: 8,
          chance: 0.55,
        }),
      ],
      onHit: [statusEffectOnHit(20, 0xdead0401, { key: "frost", turnsLeft: 2, potency: 1 }, "proc:frozen")],
    },
    specials: ['Casts Frost', 'Self-heals', 'Frost 20%'],
    description: 'A hulking orc draped in fetish charms, breath fogging with stolen winter.',
  },
  {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    tags: ['humanoid'],
    tier: 1,
    intelligence: 6,
    packSense: true, packRadius: 8,
    baseHp: 18,
    hpPerLevel: 2,
    attack: 3,
    defense: 1,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 100,
    resistances: { kinetic: { DR: 3 } },
    speed: 2,
    wielding: [
      "hobgoblin_serrated_warblade",
      "hobgoblin_serrated_warblade",
      "hobgoblin_serrated_warblade",
      "hobgoblin_serrated_warblade",
      "hobgoblin_warblade",
    ],
    hooks: {
      onBeforeHit: [bonusDamageOnBeforeHit(20, 0xdead0402, 3, "proc:rage")],
    },
    specials: ["Rage +3 dmg (20%)", "Serrated warblade"],
    description: 'A tall, iron-jawed warrior bred for war. Stronger and meaner than any goblin.',
  },
  {
    id: 'phase_spider',
    name: 'Phase Spider',
    tags: ['beast', 'venomous'],
    tier: 1,
    intelligence: 5,
    packSense: true, packRadius: 6,
    baseHp: 14,
    hpPerLevel: 1.5,
    attack: 2,
    defense: 1,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 40,
    resistances: { kinetic: { DR: 3 }, chemical: { toxMult: 0 } },
    speed: 2,
    hooks: {
      onSeen: [selfThrowNearTargetOnSeen({ searchRadius: 1, fallbackSearchRadius: 5, cooldownTurns: 4, chance: 0.2 })],
      onHit: [statusEffectOnHit(30, 0xdead0404, { key: "poison", turnsLeft: 1, potency: 1 }, "proc:poisoned")],
      onDamaged: [phaseOutOnDamaged(20, 0xdead0405)],
    },
    specials: ["Phase teleport (50%)", "Poison 30%", "Phase out 20%"],
    description: 'A shimmering spider that blinks in and out of existence, striking from impossible angles.',
  },
  {
    id: 'wight',
    name: 'Wight',
    tags: ['undead'],
    tier: 1,
    intelligence: 6,
    packSense: true, packRadius: 8,
    baseHp: 16,
    hpPerLevel: 2,
    attack: 3,
    defense: 2,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 60,
    resistances: {
      kinetic: { DR: 3, bluntMult: 1.3, pierceMult: 0.6, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: {
      onHit: [
        drainOnHit(25, 0xdead0406, 3),
        statusEffectOnHit(20, 0xdead0407, { key: "weakened", turnsLeft: 3, potency: 1 }, "proc:weakened"),
      ],
    },
    specials: ["Drain 3 HP (25%)", "Weaken 20%"],
    description: 'A revenant in tarnished mail. Its grip saps the living of their strength.',
    lootTable: 'drop:undead',
  },
  {
    id: 'spider',
    name: 'Spider',
    tags: ['beast', 'venomous'],
    tier: 0,
    intelligence: 3,   // cunning predator
    packSense: true, packRadius: 6,
    baseHp: 8,
    hpPerLevel: 1.2,
    attack: 1,
    defense: 0,
    damageDice: '1d4',
    sizeClass: 'S',
    massKg: 15,
    resistances: { kinetic: { DR: 0 }, chemical: { toxMult: 0 } },
    speed: 3,
    hooks: {
      onSeen: [selfThrowNearTargetOnSeen({ searchRadius: 1, fallbackSearchRadius: 2, cooldownTurns: 3, chance: 0.25 })],
      onHit: [statusEffectOnHit(15, 0xdead0002, { key: "poison", turnsLeft: 3, potency: 1 }, "proc:poisoned")],
    },
    specials: ["Throws web (25%)", "Poison 15%"],
    description: 'A dog-sized arachnid with venomous fangs.',
  },

  // ── Tier 2 (floors 11-15) ──────────────────────────────────────────
  {
    id: 'skeletal_marksman',
    name: 'Skeletal Marksman',
    tags: ['undead', 'skeletal'],
    tier: 2,
    intelligence: 5,   // humanoid dim
    packSense: true, packRadius: 8,
    baseHp: 16,
    hpPerLevel: 2,
    attack: 4,
    defense: 2,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 28,
    resistances: {
      kinetic: { DR: 6, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(20, 0xdead0021, { key: "burn", turnsLeft: 3, potency: 2 }, "proc:burning")],
    },
    specials: ["Burn 20%"],
    description: 'A grim skeleton nocking arrows tipped with alchemical fire.',
    equipment: { ranged: 'bow_short', ammo: 'fire_arrows' },
  },
  {
    id: 'skeleton_sharpshooter',
    name: 'Skeleton Sharpshooter',
    tags: ['undead', 'skeletal'],
    tier: 2,
    intelligence: 5,   // humanoid dim
    packSense: true, packRadius: 8,
    baseHp: 14,
    hpPerLevel: 2,
    attack: 5,
    defense: 3,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 25,
    resistances: {
      kinetic: { DR: 6, bluntMult: 1.5, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(15, 0xdead0022, { key: "stun", turnsLeft: 1, potency: 1 }, "proc:stunned")],
    },
    specials: ["Stun 15%"],
    description: 'A headless torso that somehow never misses.',
    equipment: { ranged: 'bow_short', ammo: 'arrows' },
  },
  {
    id: 'troll',
    name: 'Troll',
    tags: ['giant', 'regenerator'],
    tier: 2,
    intelligence: 5,   // dim but relentless
    baseHp: 25,
    hpPerLevel: 3,
    attack: 3,
    defense: 1,
    damageDice: '2d6',
    sizeClass: 'L',
    massKg: 200,
    resistances: { kinetic: { DR: 10 }, thermal: { burnMult: 1.5 } },
    speed: 2,
    hooks: {
      onHit: [selfBuffOnHit({ key: "regen", turnsLeft: 3, potency: 2 })],
      onDamaged: [healOnDamaged(30, 0xdead0009, 1, "proc:regenerate")],
    },
    specials: ["Regen buff on hit", "Self-heal 1 HP (30%)"],
    description: 'A hulking regenerator. Weak to fire.',
    corpseEat: { behavior: "devour", cooldownTurns: 10 },
  },
  {
    id: 'wraith',
    name: 'Wraith',
    tags: ['undead', 'spectral'],
    tier: 2,
    intelligence: 7,   // tactical mind — fights and flees
    retreatHpPct: 0.25,
    baseHp: 18,
    hpPerLevel: 2.5,
    attack: 3,
    defense: 4,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 5,
    resistances: {
      kinetic: { DR: 2, bluntMult: 0.3, slashMult: 0.3, pierceMult: 0.3 },
      electric: { ohms: 50 },
    },
    speed: 1,
    hooks: {
      onHit: [drainOnHit(20, 0xdead0003, 3)],
    },
    specials: ["Drain 3 HP (20%)"],
    description: 'A spectral horror. Physical attacks pass through it.',
  },
  {
    id: 'ogre',
    name: 'Ogre',
    tags: ['giant', 'humanoid'],
    tier: 2,
    intelligence: 5,   // humanoid dim — sluggish aggression
    baseHp: 30,
    hpPerLevel: 2,
    attack: 4,
    defense: 1,
    damageDice: '2d8',
    sizeClass: 'L',
    massKg: 250,
    resistances: { kinetic: { DR: 6 } },
    speed: 2,
    wielding: ["ogre_crushing_club"],
    hooks: null,
    specials: ["Crushing club"],
    description: 'A lumbering slab of muscle and bad intentions.',
  },

  {
    id: 'carrion_shade',
    name: 'Carrion Shade',
    tags: ['undead', 'spectral'],
    tier: 2,
    intelligence: 7,   // tactical — lurks then retreats when cornered
    ambush: true,      // lurks until player is within 2 tiles
    retreatHpPct: 0.30,
    baseHp: 20,
    hpPerLevel: 2.5,
    attack: 3,
    defense: 3,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 8,
    resistances: {
      kinetic: { DR: 4, bluntMult: 0.5, slashMult: 0.5, pierceMult: 0.5 },
      chemical: { toxMult: 0 },
    },
    speed: 2,
    hooks: {
      onBeforeHit: [bonusDamageIfTargetAfflicted(3, ["bleed", "poison", "disease", "burn"], "proc:shade_feed")],
      onHit: [
        statusEffectOnHit(30, 0xdead0100, { key: "weakened", turnsLeft: 3, potency: 1 }, "proc:weakened"),
        statusEffectOnHit(20, 0xdead0101, { key: "bleed", turnsLeft: 3, potency: 1 }, "proc:bleeding"),
      ],
      onDamaged: [phaseOutOnDamaged(25, 0xdead0102)],
    },
    specials: ["+dmg vs afflicted", "Weaken 30%", "Bleed 20%", "Phase out 25%"],
    description: 'A shadow that coalesces around old blood. It lurks in darkness and strikes harder against the wounded.',
    lootTable: 'drop:tier2',
    corpseEat: { behavior: "devour", cooldownTurns: 8 },
  },
  {
    id: 'dark_acolyte',
    name: 'Dark Acolyte',
    tags: ['humanoid', 'caster'],
    tier: 2,
    intelligence: 9,
    visionRange: 9,
    retreatHpPct: 0.25,
    baseHp: 16,
    hpPerLevel: 1.8,
    attack: 2,
    defense: 2,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 65,
    resistances: { kinetic: { DR: 4 } },
    speed: 2,
    learnedSpellIds: ['agony', 'shadow_bolt'],
    maxMana: 45,
    manaRegen: 0.18,
    hooks: {
      whileLOS: [
        castSpellOnLOS({
          spellId: 'agony',
          minRange: 1,
          maxRange: 8,
          cooldownTurns: 10,
          chance: 0.70,
        }),
        castSpellOnLOS({
          spellId: 'shadow_bolt',
          minRange: 2,
          maxRange: 10,
          cooldownTurns: 8,
          chance: 0.50,
        }),
      ],
      onDamaged: [phaseOutOnDamaged(15, 0xdead0408)],
    },
    specials: ['Casts Agony', 'Casts Shadow Bolt', 'Phase out 15%'],
    description: 'A hooded cultist whose whispered curses blister the air itself.',
    lootTable: 'drop:caster',
  },
  {
    id: 'orc_warchief',
    name: 'Orc Warchief',
    tags: ['humanoid'],
    tier: 2,
    intelligence: 7,
    packSense: true, packRadius: 10,
    baseHp: 28,
    hpPerLevel: 2.5,
    attack: 4,
    defense: 3,
    damageDice: '2d6',
    sizeClass: 'L',
    massKg: 120,
    resistances: { kinetic: { DR: 10 } },
    speed: 2,
    wielding: ["orc_warchief_maul"],
    equipped: ["chain_armor", "helm_steel"],
    hooks: {
      onBeforeHit: [bonusDamageOnBeforeHit(30, 0xdead0409, 3, "proc:rage")],
      onDamaged: [retaliateOnDamaged(2, "proc:warcry")],
    },
    specials: ["Rage +3 dmg (30%)", "Warcry retaliation", "Warchief maul"],
    description: 'A scarred orc captain in heavy plate. Its war-cry alone can stop a heart.',
  },

  // ── Tier 3 (floors 16+) ────────────────────────────────────────────
  {
    id: 'death_archer',
    name: 'Death Archer',
    tags: ['undead', 'skeletal'],
    tier: 3,
    intelligence: 6,   // cunning hunter
    packSense: true, packRadius: 10,
    baseHp: 28,
    hpPerLevel: 3,
    attack: 5,
    defense: 4,
    damageDice: '2d6',
    sizeClass: 'M',
    massKg: 30,
    resistances: {
      kinetic: { DR: 8, pierceMult: 0.5, slashMult: 0.7 },
      chemical: { toxMult: 0 },
      electric: { ohms: 50 },
    },
    speed: 2,
    hooks: {
      onHit: [drainOnHit(20, 0xdead0023, 3)],
    },
    specials: ["Drain 3 HP (20%)"],
    description: 'An ancient undead marksman wreathed in cold flame. Its arrows sap the life from their targets.',
    equipment: { ranged: 'bow_short', ammo: 'fire_arrows' },
  },
  {
    id: 'demon',
    name: 'Demon',
    tags: ['demon', 'planar'],
    tier: 3,
    intelligence: 8,   // smart predator — proud but not suicidal
    retreatHpPct: 0.20,
    baseHp: 40,
    hpPerLevel: 4,
    attack: 5,
    defense: 4,
    damageDice: '2d8',
    sizeClass: 'L',
    massKg: 180,
    resistances: {
      kinetic: { DR: 14 },
      thermal: { igniteC: Infinity, burnMult: 0 },
    },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(30, 0xdead000b, { key: "burn", turnsLeft: 4, potency: 3 }, "proc:burning")],
      onDamaged: [retaliateOnDamaged(2, "proc:hellfire")],
    },
    specials: ["Burn 30%", "Hellfire retaliation"],
    description: 'Sulphur and malice given form. Immune to fire.',
  },
  {
    id: 'dragon',
    name: 'Dragon',
    tags: ['beast', 'draconic'],
    tier: 3,
    canFly: true,
    intelligence: 8,   // apex predator — territorial and cunning
    retreatHpPct: 0.15,
    baseHp: 50,
    hpPerLevel: 5,
    attack: 6,
    defense: 6,
    damageDice: '3d8',
    sizeClass: 'XL',
    massKg: 800,
    resistances: {
      kinetic: { DR: 18, pierceMult: 0.7 },
      thermal: { igniteC: Infinity, burnMult: 0 },
    },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(20, 0xdead0004, { key: "burn", turnsLeft: 5, potency: 4 }, "proc:burning")],
    },
    specials: ["Burn 20%"],
    description: 'Scales like hammered bronze. The apex predator of the deep.',
    lootTable: 'drop:dragon',
  },
  {
    id: 'lich',
    name: 'Lich',
    tags: ['undead', 'caster', 'humanoid'],
    tier: 3,
    intelligence: 10,  // sapient sorcerer — picks up better weapons
    retreatHpPct: 0.25,
    baseHp: 35,
    hpPerLevel: 3.5,
    attack: 4,
    defense: 5,
    damageDice: '2d6',
    sizeClass: 'M',
    massKg: 40,
    resistances: {
      kinetic: { DR: 6, bluntMult: 0.5, slashMult: 0.5, pierceMult: 0.5 },
      chemical: { toxMult: 0 },
      electric: { ohms: 200 },
    },
    speed: 2,
    hooks: {
      onHit: [drainOnHit(25, 0xdead000c, 2)],
      onDamaged: [statusEffectOnDamaged(20, 0xdead000d, { key: "regen", turnsLeft: 3, potency: 2 }, "proc:phylactery", true)],
    },
    specials: ["Drain 2 HP (25%)", "Phylactery regen (20%)"],
    description: 'An undead sorcerer sustained by a hidden phylactery.',
    lootTable: 'drop:lich',
  },
  {
    id: 'mimic',
    name: 'Mimic',
    tags: ['aberration', 'mimic'],
    tier: 99,
    intelligence: 6,   // cunning ambusher — waits for victims
    ambush: true,
    baseHp: 16,
    hpPerLevel: 1.5,
    attack: 3,
    defense: 2,
    damageDice: '1d8',
    sizeClass: 'M',
    massKg: 140,
    resistances: { kinetic: { DR: 6 } },
    speed: 2,
    hooks: {
      onHit: [statusEffectOnHit(30, 0xdead0020, { key: "stun", turnsLeft: 2, potency: 1 }, "proc:stunned")],
    },
    specials: ["Adhesive grip (stun 30%)"],
    description: 'A predatory chest-creature that waits for curious hands.',
    lootTable: 'drop:tier1',
  },
  {
    id: 'stone_taunter',
    name: 'Taunting Statue',
    tags: ['construct'],
    tier: 99,
    intelligence: 2,   // construct with scripted taunting behavior
    ambush: true,      // doesn't move; waits for targets to come close
    baseHp: 45,
    hpPerLevel: 0,
    attack: 2,
    defense: 4,
    damageDice: '1d6',
    sizeClass: 'M',
    massKg: 240,
    resistances: {
      kinetic: { DR: 14, bluntMult: 0.7, slashMult: 0.5, pierceMult: 0.4 },
      thermal: { burnMult: 0.6 },
      chemical: { toxMult: 0.2 },
      electric: { ohms: 2400 },
    },
    speed: 2,
    hooks: null,
    specials: [],
    description: 'An animated stone idol that heckles anything that breathes.',
  },
  // ── Lichen (tier 0) — sessile food source ────────────────────────────
  {
    id: 'lichen',
    name: 'Lichen',
    tags: ['plant'],
    corpseDropChance: 0.9,
    tier: 0,
    intelligence: 1,   // mindless growth — scurries randomly
    ambush: true,      // sessile; doesn't move until bumped
    baseHp: 6,
    hpPerLevel: 0.5,
    attack: 0,
    defense: 0,
    damageDice: '1d2',
    sizeClass: 'XS',
    massKg: 5,
    resistances: { kinetic: { DR: 0 }, chemical: { toxMult: 0.5 } },
    speed: 1,          // very slow (actEvery = 3)
    hooks: null,
    specials: [],
    description: 'A crusty growth clinging to the dungeon stone. Edible, if desperate.',
  },
  // ── Nymph (tier 0, minDepth 3) — item thief ───────────────────────
  {
    id: 'nymph',
    name: 'Nymph',
    tags: ['fey', 'humanoid'],
    tier: 0,
    minDepth: 3,
    intelligence: 7,   // smart enough to steal tactically
    aggro: 'passive',  // approaches to steal, not attack
    baseHp: 12,
    hpPerLevel: 1,
    attack: 1,
    defense: 1,        // elusive
    damageDice: '1d4',
    sizeClass: 'S',
    massKg: 45,
    resistances: { kinetic: { DR: 0 } },
    speed: 3,          // fast (actEvery = 1)
    retreatHpPct: 0.40,
    hooks: {
      onHit: [stealAndBlinkOnHit({ chancePct: 50, seedSalt: 0xdead0030, cooldownTurns: 8, blinkDistance: 10 })],
    },
    specials: ["Steals items", "Teleports away"],
    description: 'A mischievous forest spirit with light fingers and lighter feet.',
    lootTable: 'drop:nymph',
  },
  // ── Rust Monster (tier 0, minDepth 4) — equipment corroder ─────────
  {
    id: 'rust_monster',
    name: 'Rust Monster',
    tags: ['beast', 'aberration'],
    tier: 0,
    minDepth: 4,
    intelligence: 3,   // dumb beast — scurries
    aggro: 'passive',  // only attacks when provoked
    baseHp: 14,
    hpPerLevel: 1.5,
    attack: 1,
    defense: 1,
    damageDice: '1d4',
    sizeClass: 'M',
    massKg: 100,
    resistances: { kinetic: { DR: 4 }, chemical: { toxMult: 0 } },
    speed: 2,
    hooks: {
      onHit: [corrodeEquipmentOnHit(40, 0xdead0040)],
    },
    specials: ["Corrodes metal equipment"],
    description: 'A rust-brown beetle whose feathery antennae dissolve metal on contact.',
  },
  // ── Multi-segment centipede (tier 0) ─────────────────────────────────
  {
    id: 'centipede',
    disabled: true,
    name: 'Giant Centipede',
    tags: ['beast', 'vermin', 'long-creature'],
    tier: 0,
    intelligence: 2,
    baseHp: 4,
    hpPerLevel: 0.5,
    attack: 0,
    defense: 0,
    damageDice: '1d3',
    sizeClass: 'S',
    massKg: 5,
    resistances: { kinetic: { DR: 1 } },
    speed: 3,
    segmentCount: { min: 4, max: 7 },
    hooks: {
      onHit: [statusEffectOnHit(20, 0xdead0500, { key: "poison", turnsLeft: 3, potency: 1 }, "proc:poisoned")],
      onDeath: [centipedeSplitOnDeath()],
    },
    specials: ["Poison 20%", "Multi-segment"],
    description: 'A writhing arthropod that moves as one. Cut it and both halves keep going.',
  },
];

// Global monster vitality scalar used by all depth-scaled spawn pathways.
// Tune this to raise/lower overall monster durability without per-monster edits.
export const MONSTER_HP_SCALAR = 1.2;

/** Lookup helpers */
const _byId = new Map(MONSTERS.map(m => [m.id, m]));
const _byTier = [];
for (const m of MONSTERS) {
  if (!m.rare && !m.disabled) (_byTier[m.tier] ??= []).push(m);
}

/** Genocide registry — tracks monster IDs permanently removed from the game. */
const _genocided = new Set();

/** @param {string} id */
export function addGenocide(id) { _genocided.add(id); }

/** @param {string} id @returns {boolean} */
export function isGenocided(id) { return _genocided.has(id); }

/** @returns {string[]} */
export function getAllGenocided() { return [..._genocided]; }

export function clearGenocides() { _genocided.clear(); }

/** @param {number} tier @returns {MonsterDef[]} */
export function getMonstersByTier(tier) {
  const pool = _byTier[Math.min(tier, _byTier.length - 1)] || _byTier[_byTier.length - 1];
  if (_genocided.size === 0) return pool;
  return pool.filter(m => !_genocided.has(m.id));
}

/** @param {string} id @returns {MonsterDef|null} */
export function getMonster(id) {
  return _byId.get(id) || null;
}

/**
 * Resolve scaled monster max HP at a given dungeon depth.
 * @param {string|MonsterDef|null|undefined} monster
 * @param {number} depth
 * @returns {number}
 */
export function resolveMonsterMaxHp(monster, depth = 1) {
  const def = typeof monster === "string" ? getMonster(monster) : (monster || null);
  if (!def) return 1;
  const d = Math.max(1, Number(depth || 1) | 0);
  const baseHp = Number(def.baseHp || 1);
  const hpPerLevel = Number(def.hpPerLevel || 0);
  const unscaled = baseHp + d * hpPerLevel;
  return Math.max(1, Math.floor(unscaled * MONSTER_HP_SCALAR));
}

/** @returns {string[]} */
export function listAllMonsterIds() {
  return MONSTERS.map((monster) => monster.id).slice().sort();
}

/** @param {MonsterDef} def @returns {string} loot table ID */
export function getMonsterLootTable(def) {
  if (def.lootTable) return def.lootTable;
  const tags = def.tags || [];
  // Tag priority: caster > beast > humanoid > undead > tier fallback
  if (tags.includes('caster'))   return 'drop:caster';
  if (tags.includes('beast'))    return 'drop:beast';
  if (tags.includes('humanoid')) return 'drop:humanoid';
  if (tags.includes('undead'))   return 'drop:undead';
  return `drop:tier${def.tier}`;
}

/**
 * Check whether a monster (by id) carries a given tag.
 * @param {string} monsterId
 * @param {string} tag
 * @returns {boolean}
 */
export function monsterHasTag(monsterId, tag) {
  const def = _byId.get(monsterId);
  if (!def || !Array.isArray(def.tags)) return false;
  return def.tags.includes(tag);
}

/**
 * Return all tags for a monster id, or empty array.
 * @param {string} monsterId
 * @returns {string[]}
 */
export function getMonsterTags(monsterId) {
  const def = _byId.get(monsterId);
  return Array.isArray(def?.tags) ? def.tags : [];
}

/** @typedef {{ id:string, name:string, tags?:string[], tier:number, intelligence?:number, visionRange?:number, baseHp:number, hpPerLevel:number, attack:number, defense:number, damageDice:string, sizeClass:string, massKg:number, resistances:Object, speed:number, hooks?:Record<string, Function[]>|null, specials?:string[], description:string, lootTable?:string, corpseDropChance?:number, equipment?:{ranged?:string, ammo?:string}|null, wielding?:Array<string|{itemId?:string,id?:string,affixes?:string[],count?:number,slot?:string}>, equipped?:Array<string|{itemId?:string,id?:string,affixes?:string[],count?:number,slot?:string}>, inventory?:Array<string|{itemId?:string,id?:string,affixes?:string[],count?:number,slot?:string}>, learnedSpellIds?:string[], maxMana?:number, manaRegen?:number }} MonsterDef */
