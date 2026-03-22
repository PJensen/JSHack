// Corpse nutrition and on-eat hook data.

import {
  corpseIronStomachProgress,
  corpseDiminishResist,
  corpseDiminishDR,
  corpseProgression,
  grantElectricResist,
  corpseProcNode,
} from "./callbacks/eat.js";

/**
 * Base nutrition by monster sizeClass.
 * These values represent "hunger reduction" when the food is consumed.
 */
export const NUTRITION_BY_SIZE = {
  XS: 90,
  S: 180,
  M: 360,
  L: 600,
  XL: 900,
};

/**
 * Compute nutrition from a monster def, factoring in massKg for fine-tuning.
 * @param {{ sizeClass: string, massKg: number }} monsterDef
 * @returns {number}
 */
export function computeCorpseNutrition(monsterDef) {
  const base = NUTRITION_BY_SIZE[monsterDef.sizeClass] || 200;
  const massBonus = Math.floor((monsterDef.massKg || 0) / 10);
  return base + massBonus;
}

const EMPTY_HOOKS = Object.freeze([]);

/**
 * Corpse item definitions keyed by corpse identity.
 * The identity convention is `corpse_${monsterId}`.
 *
 * Skeletal/undead without flesh (skeleton, bone_bowman, skeletal_marksman, etc.)
 * drop bones instead of corpses — no entry needed here.
 */
export const CORPSE_DEFS = Object.freeze({

  // ── Tier 0 ──────────────────────────────────────────────────────────

  // Rat: disease + iron stomach progression (existing)
  corpse_rat: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "disease", b: 20, c: 1 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "disease" }),
      }),
      corpseIronStomachProgress,
    ]),
  }),

  // Bat: disease + iron stomach progression (existing)
  corpse_bat: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "disease", b: 20, c: 1 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "disease" }),
      }),
      corpseIronStomachProgress,
    ]),
  }),

  // Goblin: 50% cunning reflex (+evasion), 50% disease — foul meat
  corpse_goblin: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.5)) {
            proc.attachTimedBuff("cunning_reflex", 60, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "cunning_reflex",
              turnsLeft: 60,
              description: "a jittery cunning sharpens your reflexes",
            });
            return;
          }
          proc.applyStatus("disease", 10, 1);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "disease" });
        },
      }),
    ]),
  }),

  // Goblin Archer: keen eyes — perception buff
  corpse_goblin_archer: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        gates: [{ kind: "eventKind", a: "eat" }],
        effects: [{ kind: "attachTimedBuff", a: "keen_eye", b: 80 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "keen_eye",
            turnsLeft: 80,
            description: "your vision sharpens to a predatory focus",
          });
        },
      }),
    ]),
  }),

  // Grid Bug: shock damage + 30% electric affinity
  corpse_grid_bug: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({ effects: [{ kind: "dealDamage", a: 3, c: "corpse" }] }),
      corpseProcNode({
        gates: [{ kind: "chance", b: 0.3 }],
        effects: [{ kind: "attachTimedBuff", a: "resist_electric", b: 120 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "resist_electric",
            turnsLeft: 120,
            description: "the current hums through you — your body adapts",
          });
        },
      }),
    ]),
  }),

  // Cave Snake: harmless + bonus nutrition + builds poison resistance
  // Each eat adds diminishing poisonResist bonus (decay 0.85, max bonus 0.6)
  corpse_cave_snake: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({ effects: [{ kind: "nutrition", a: 50 }] }),
      corpseDiminishResist("poisonResist", 0.85, 0.4, "poison", "cave_snake"),
    ]),
  }),

  // Cave Spider: 40% web immunity, otherwise nothing special
  corpse_cave_spider: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        gates: [{ kind: "chance", b: 0.4 }],
        effects: [{ kind: "attachTimedBuff", a: "web_immune", b: 100, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "web_immune",
            turnsLeft: 100,
            description: "silk threads dissolve on contact — webs cannot bind you",
          });
        },
      }),
    ]),
  }),

  // Snake: poison + builds poison resistance (risk/reward: you get poisoned but build tolerance)
  // Each eat adds diminishing poisonResist bonus (decay 0.88, max bonus 0.6)
  corpse_snake: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "poison", b: 8, c: 2 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "poison" }),
      }),
      corpseDiminishResist("poisonResist", 0.88, 0.4, "poison", "snake"),
    ]),
  }),

  // Spider: poison + 25% spider sense (trap detection buff)
  corpse_spider: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "poison", b: 8, c: 2 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "poison" }),
      }),
      corpseProcNode({
        gates: [{ kind: "chance", b: 0.25 }],
        effects: [{ kind: "attachTimedBuff", a: "spider_sense", b: 80, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "spider_sense",
            turnsLeft: 80,
            description: "alien instincts tingle — you sense hidden dangers",
          });
        },
      }),
    ]),
  }),

  // Pit Viper: 40% thermal sense, 60% nasty poison
  corpse_pit_viper: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.4)) {
            proc.attachTimedBuff("thermal_sense", 200, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "thermal_sense",
              turnsLeft: 200,
              description: "heat signatures bloom in your mind's eye",
            });
            return;
          }
          proc.applyStatus("poison", 6, 3);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "poison" });
        },
      }),
    ]),
  }),

  // Cave Bear: +2 maxHp timed buff + builds kinetic DR via stat tree
  // Each eat adds diminishing kineticDR bonus (increment 1.5, ceiling 6 total including base)
  corpse_cave_bear: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "bear_vigor", b: 150, c: 2 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "bear_vigor",
            turnsLeft: 150,
            description: "primal strength surges through your limbs",
          });
        },
      }),
      corpseDiminishDR("kineticDR", "kinetic", "DR", 1.5, 6, "toughness", "cave_bear"),
    ]),
  }),

  // Dragon Whelp: 30% fire blood (burn immunity), 70% fire damage + burn
  corpse_dragon_whelp: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.3)) {
            proc.attachTimedBuff("fire_blood", 200, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "fire_blood",
              turnsLeft: 200,
              description: "liquid fire fills your veins — flames cannot touch you",
            });
            return;
          }
          proc.dealDamage(5, "dragonblood");
          proc.applyStatus("burn", 3, 2);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "burn" });
        },
      }),
    ]),
  }),

  // Floating Eye: mindwipe (hallucination) + third_eye trait on survival
  corpse_floating_eye: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "mindwipe", b: 30, c: 2 }],
        script: (ctx, proc) => {
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "hallucination" });
          proc.setTrait("third_eye", true);
          proc.emit("corpse:trait-gained", {
            actor: ctx.actor,
            trait: "third_eye",
            name: "Third Eye",
          });
        },
      }),
    ]),
  }),

  // Kobold Shaman: 50% mana surge, 50% shock
  corpse_kobold_shaman: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.5)) {
            proc.attachTimedBuff("mana_surge", 100, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "mana_surge",
              turnsLeft: 100,
              description: "stolen thunder crackles behind your eyes",
            });
            return;
          }
          proc.applyStatus("shock", 3, 1);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "shock" });
        },
      }),
    ]),
  }),

  // ── Tier 1 ──────────────────────────────────────────────────────────

  // Orc: blood rage — +attack, -defense
  corpse_orc: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "blood_rage", b: 100, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "blood_rage",
            turnsLeft: 100,
            description: "orcish fury floods your muscles — you feel reckless and strong",
          });
        },
      }),
    ]),
  }),

  // Orc Shaman: 40% frost blood (burn resist), 60% frost
  corpse_orc_shaman: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.4)) {
            proc.attachTimedBuff("frost_blood", 150, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "frost_blood",
              turnsLeft: 150,
              description: "frost crystallizes in your veins — fire barely stings",
            });
            return;
          }
          proc.applyStatus("frost", 4, 1);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "frost" });
        },
      }),
    ]),
  }),

  // Hobgoblin: war-fed — strong attack buff
  corpse_hobgoblin: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "war_fed", b: 120, c: 2 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "war_fed",
            turnsLeft: 120,
            description: "iron-bred muscle hardens your strikes",
          });
        },
      }),
    ]),
  }),

  // Phase Spider: 25% phase shift (dodge buff), 75% poison
  corpse_phase_spider: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.25)) {
            proc.attachTimedBuff("phase_shift", 80, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "phase_shift",
              turnsLeft: 80,
              description: "reality shimmers — you flicker between planes",
            });
            return;
          }
          proc.applyStatus("poison", 6, 2);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "poison" });
        },
      }),
    ]),
  }),

  // Wight: heal 5 HP + weakened debuff + deathless progression
  corpse_wight: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "heal", a: 5 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "heal",
            description: "vitality surges through you",
          });
        },
      }),
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "weakened", b: 8, c: 1 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "weakened" }),
      }),
      corpseProgression("wightCorpsesEaten", 3, "deathless", "Deathless",
        (ctx) => {
          ctx.pushEffect({ key: "regen", turnsLeft: 9999, potency: 1, stacks: 1, sourceId: ctx.itemId });
          ctx.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "deathless_regen",
            description: "undeath seeps into your bones — your wounds slowly knit themselves",
          });
        }),
    ]),
  }),

  // ── Tier 2 ──────────────────────────────────────────────────────────

  // Troll: regeneration + ravenous hunger debuff
  corpse_troll: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "regeneration", b: 200, c: 2 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "regeneration",
            turnsLeft: 200,
            description: "troll blood knits your wounds — but the hunger is monstrous",
          });
        },
      }),
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "ravenous", b: 200, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:debuff-gained", {
            actor: ctx.actor,
            effect: "ravenous",
            turnsLeft: 200,
            description: "insatiable hunger gnaws at your belly",
          });
        },
      }),
    ]),
  }),

  // Wraith: mindwipe + 30% spectral form (kinetic resist)
  corpse_wraith: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "mindwipe", b: 15, c: 1 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "mindwipe" }),
      }),
      corpseProcNode({
        gates: [{ kind: "chance", b: 0.3 }],
        effects: [{ kind: "attachTimedBuff", a: "spectral_form", b: 60, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "spectral_form",
            turnsLeft: 60,
            description: "your flesh turns translucent — blades pass through you",
          });
        },
      }),
    ]),
  }),

  // Ogre: bulk up — maxHp, DR, but slower
  corpse_ogre: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "ogre_bulk", b: 150, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "ogre_bulk",
            turnsLeft: 150,
            description: "your frame swells with brutish mass — you lumber forward",
          });
        },
      }),
    ]),
  }),

  // Carrion Shade: 50% shadow cloak (ambush damage), 50% afflictions
  corpse_carrion_shade: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.5)) {
            proc.attachTimedBuff("shadow_cloak", 100, 3);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "shadow_cloak",
              turnsLeft: 100,
              description: "shadows coil around you — your first strike will be devastating",
            });
            return;
          }
          proc.applyStatus("weakened", 10, 2);
          proc.applyStatus("bleed", 5, 1);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "shade_taint" });
        },
      }),
    ]),
  }),

  // Dark Acolyte: dark sight (vision range) + 30% agony curse
  corpse_dark_acolyte: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "dark_sight", b: 200, c: 2 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "dark_sight",
            turnsLeft: 200,
            description: "forbidden knowledge floods in — you see further into the dark",
          });
        },
      }),
      corpseProcNode({
        gates: [{ kind: "chance", b: 0.3 }],
        effects: [{ kind: "applyStatus", a: "agony", b: 10, c: 2 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "agony" }),
      }),
    ]),
  }),

  // Orc Warchief: battle fury — on-kill heal buff
  corpse_orc_warchief: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "battle_fury", b: 150, c: 2 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "battle_fury",
            turnsLeft: 150,
            description: "the warchief's fury ignites — each kill will restore you",
          });
        },
      }),
    ]),
  }),

  // ── Tier 3 ──────────────────────────────────────────────────────────

  // Demon: 40% demon fire (permanent +1 fire damage trait), 60% hellfire
  corpse_demon: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.4)) {
            proc.setTrait("demon_fire", true);
            proc.emit("corpse:trait-gained", {
              actor: ctx.actor,
              trait: "demon_fire",
              name: "Demonic Ichor",
            });
            return;
          }
          proc.dealDamage(8, "hellfire");
          proc.applyStatus("burn", 6, 4);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "hellfire" });
        },
      }),
    ]),
  }),

  // Dragon: dragonheart trait + massive burn resist nudge — always costs fire damage
  // burnMult: decay 0.3 toward floor 0.1 (eat 1: 1.0→0.37, eat 2: →0.18)
  corpse_dragon: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [
          { kind: "dealDamage", a: 10, c: "dragonfire" },
          { kind: "applyStatus", a: "burn", b: 4, c: 3 },
        ],
        script: (ctx, proc) => {
          proc.setTrait("dragonheart", true);
          proc.emit("corpse:trait-gained", {
            actor: ctx.actor,
            trait: "dragonheart",
            name: "Dragonheart",
          });
        },
      }),
      // Big nudge — dragon is legendary. Floor 0.1 so never full immunity.
      corpseDiminishResist("fireResist", 0.3, 0.1, "fire", "dragon"),
    ]),
  }),

  // Lich: mindwipe + 20% lichdom echo (cheat death once)
  corpse_lich: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "applyStatus", a: "mindwipe", b: 15, c: 1 }],
        script: (ctx, proc) => proc.emit("hunger:sickened", { actor: ctx.actor, type: "mindwipe" }),
      }),
      corpseProcNode({
        gates: [{ kind: "chance", b: 0.2 }],
        effects: [{ kind: "attachTimedBuff", a: "lichdom_echo", b: 300, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "lichdom_echo",
            turnsLeft: 300,
            description: "a cold phylactery pulse echoes in your chest — death may spare you once",
          });
        },
      }),
    ]),
  }),

  // ── Special ─────────────────────────────────────────────────────────

  // Mimic: random effect — the protean flesh is unpredictable
  corpse_mimic: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          const roll = ctx.chance(0.25) ? 0
            : ctx.chance(0.33) ? 1
            : ctx.chance(0.5) ? 2
            : 3;
          switch (roll) {
            case 0:
              proc.attachTimedBuff("war_fed", 100, 2);
              proc.emit("corpse:buff-gained", { actor: ctx.actor, effect: "war_fed", description: "the mimic's flesh reshapes into raw strength" });
              break;
            case 1:
              proc.attachTimedBuff("ogre_bulk", 100, 1);
              proc.emit("corpse:buff-gained", { actor: ctx.actor, effect: "ogre_bulk", description: "the mimic's mass thickens your hide" });
              break;
            case 2:
              proc.addNutrition(200);
              proc.emit("corpse:buff-gained", { actor: ctx.actor, effect: "nutrition", description: "surprisingly delicious" });
              break;
            case 3:
              proc.applyStatus("disease", 15, 1);
              proc.emit("hunger:sickened", { actor: ctx.actor, type: "mimic_disease" });
              break;
          }
        },
      }),
    ]),
  }),

  // Stone Taunter: 50% stone skin (kinetic DR), 50% petrify (stun)
  corpse_stone_taunter: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.5)) {
            proc.attachTimedBuff("stone_skin", 120, 4);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "stone_skin",
              turnsLeft: 120,
              description: "your skin hardens to living granite",
            });
            return;
          }
          proc.applyStatus("stun", 8, 1);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "petrify" });
        },
      }),
    ]),
  }),

  // Eel: electric resistance (existing)
  corpse_eel: Object.freeze({
    onEat: Object.freeze([grantElectricResist]),
  }),

  // ── New monsters ────────────────────────────────────────────────────

  // Lichen: completely safe, bonus nutrition — the best early food source.
  // Never rots (handled by foodDecaySystem exception).
  corpse_lichen: Object.freeze({
    onEat: Object.freeze([corpseProcNode({ effects: [{ kind: "nutrition", a: 110 }] })]),
  }),

  // Nymph: 40% fey grace (evasion buff), 60% confusion
  corpse_nymph: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (ctx, proc) => {
          if (ctx.chance(0.4)) {
            proc.attachTimedBuff("fey_grace", 80, 1);
            proc.emit("corpse:buff-gained", {
              actor: ctx.actor,
              effect: "fey_grace",
              turnsLeft: 80,
              description: "fey lightness fills your step — you weave like wind",
            });
            return;
          }
          proc.applyStatus("confused", 10, 1);
          proc.emit("hunger:sickened", { actor: ctx.actor, type: "confused" });
        },
      }),
    ]),
  }),

  // Rust Monster: safe, builds acid resist over repeated meals
  corpse_rust_monster: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        effects: [{ kind: "attachTimedBuff", a: "resist_acid", b: 100, c: 1 }],
        script: (ctx, proc) => {
          proc.emit("corpse:buff-gained", {
            actor: ctx.actor,
            effect: "resist_acid",
            turnsLeft: 100,
            description: "the beetle's ichor coats your innards — acid cannot touch you",
          });
        },
      }),
      corpseDiminishResist("acidResist", 0.85, 0.4, "acid", "rust_monster"),
    ]),
  }),

  // Test hook
  corpse_test_cancel: Object.freeze({
    onEat: Object.freeze([
      corpseProcNode({
        script: (_ctx, proc) => {
          proc.cancel({ code: "FAIL", message: "You cannot stomach that.", consumesTurn: true });
        },
      }),
    ]),
  }),
});

/**
 * @param {string} key
 * @returns {string}
 */
function normalizeCorpseIdentity(key) {
  const normalized = String(key || "").toLowerCase().trim();
  if (!normalized) return "";
  if (normalized.startsWith("corpse_")) return normalized;
  return `corpse_${normalized}`;
}

/**
 * @param {string} key corpse identity or monster id
 * @returns {{ onEat?: Function[] }|null}
 */
export function getCorpseDef(key) {
  const identity = normalizeCorpseIdentity(key);
  return identity ? (CORPSE_DEFS[identity] || null) : null;
}

/**
 * @param {string} key corpse identity or monster id
 * @returns {Function[]}
 */
export function getCorpseEatHooks(key) {
  const hooks = getCorpseDef(key)?.onEat;
  return Array.isArray(hooks) ? hooks : EMPTY_HOOKS;
}
