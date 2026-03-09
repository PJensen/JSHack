# Scripting & Content Creation Guide

A technical reference for adding monsters, items, spells, and affixes.

---

## Table of Contents

1. [Monster Scripting](#1-monster-scripting)
2. [Item Creation](#2-item-creation)
3. [Spell Creation](#3-spell-creation)
4. [Affix Creation](#4-affix-creation)

---

## 1. Monster Scripting

**File:** `src/rules/data/monsters.js`

Monsters are plain objects in the exported `MONSTERS` array. The engine picks them for spawning, builds ECS entities from them, and invokes their `hooks` callbacks during combat. All combat behavior lives on the monster definition — there is no separate AI file to touch.

### 1.1 Minimal definition

```js
{
  id: 'my_monster',       // Unique string key. Used internally and in loot tables.
  name: 'My Monster',     // Display name.
  tier: 1,                // 0=floors 1-5, 1=6-10, 2=11-15, 3=16+
  glyph: 'm',             // Single character drawn on the map.
  fg: '#cc8844',          // Foreground color (hex string).
  glow: '#aa6622',        // Glow/halo color (hex string).
  baseHp: 12,             // Starting HP at dungeon level 1.
  hpPerLevel: 2,          // HP added per dungeon level.
  attack: 1,              // Flat attack bonus (adds to hit roll).
  defense: 0,             // Flat defense (reduces incoming damage).
  damageDice: '1d6',      // Damage expression. Supports NdS notation.
  sizeClass: 'M',         // XS, S, M, L, XL — affects nutrition and loot.
  massKg: 80,             // Body mass. Used by frost scaling and nutrition.
  resistances: { kinetic: { DR: 2 } },  // See §1.3.
  speed: 2,               // Action points per turn (1 = slow, 3 = fast).
  hooks: {},              // Combat callbacks. See §1.2.
  description: 'A monster.', // Flavor text shown in inspect panel.
}
```

Add the object to the `MONSTERS` array and it will automatically appear in the spawn pool for its tier. No registration call is needed.

To give the monster a custom loot table instead of the default tier table add:
```js
lootTable: 'drop:my_monster',   // Must match a key in lootTables.js
```

---

### 1.2 Combat hooks

All behavior fires through `hooks`. The four keys are:

| Key | Fires when |
|---|---|
| `onBeforeHit` | Before damage is calculated — modify `ctx.damage` here |
| `onHit` | After the monster successfully hits something |
| `onDamaged` | After the monster takes damage |
| `onDeath` | When the monster dies |

Each value is an **array** of callback functions. Callbacks are called left-to-right and receive a single `ctx` (`CombatCallbackContext`) argument.

```js
hooks: {
  onBeforeHit: [ /* callbacks */ ],
  onHit:       [ /* callbacks */ ],
  onDamaged:   [ /* callbacks */ ],
  onDeath:     [ /* callbacks */ ],
}
```

You almost never write raw callbacks — import the factory functions instead.

---

### 1.3 Built-in callback factories

Import from `./callbacks/combat.js` and `./callbacks/death.js`.

#### `statusEffectOnHit(chancePct, seedSalt, effect, emitEvent)`
Roll a chance, then apply a status effect to the target.

```js
import { statusEffectOnHit } from "./callbacks/combat.js";

// 25% chance to disease the target for 20 turns
statusEffectOnHit(25, 0xdead0001, { key: "disease", turnsLeft: 20, potency: 1 }, "proc:diseased")
```

- `chancePct` — integer 0–100
- `seedSalt` — a unique hex constant that makes the roll deterministic. **Use a different salt for every callback across the whole codebase.**
- `effect` — `{ key, turnsLeft, potency }` — the status to push. See §1.5 for valid keys.
- `emitEvent` — semantic event name emitted on proc (used for display, can be `null`)

#### `selfBuffOnHit(effect)`
Always push a status effect onto the monster itself when it hits. No roll, no seed needed.

```js
// Troll gains regen every time it hits
selfBuffOnHit({ key: "regen", turnsLeft: 3, potency: 2 })
```

#### `drainOnHit(chancePct, seedSalt, divisor)`
Roll a chance, then heal the monster by `floor(damage / divisor)`.

```js
// Wraith: 20% chance to drain damage/3 HP
drainOnHit(20, 0xdead0003, 3)
```

#### `bonusDamageOnBeforeHit(chancePct, seedSalt, bonusDmg, emitEvent)`
Roll a chance, then add flat damage to the current hit. Use in `onBeforeHit`.

```js
// Orc: 25% rage — +2 damage
bonusDamageOnBeforeHit(25, 0xdead0007, 2, "proc:rage")
```

#### `bonusDamageIfTargetAfflicted(bonusDmg, effectKeys, emitEvent)`
Always fires. Add flat damage if the target currently has any of the listed status effects. No roll needed.

```js
// Carrion shade: +3 damage if target is bleeding, poisoned, or diseased
bonusDamageIfTargetAfflicted(3, ["bleed", "poison", "disease"], "proc:shade_feed")
```

#### `healOnDamaged(chancePct, seedSalt, amount, emitEvent)`
Roll a chance, then heal the monster for a flat amount when it takes damage. Use in `onDamaged`.

```js
// Skeleton: 20% chance to reassemble for 2 HP when hit
healOnDamaged(20, 0xdead0008, 2, "proc:reassemble")
```

#### `retaliateOnDamaged(amount, emitEvent)`
Always fires. Deal flat damage back to whoever hit the monster. No roll.

```js
// Demon: always retaliates for 2 damage
retaliateOnDamaged(2, "proc:hellfire")
```

#### `statusEffectOnDamaged(chancePct, seedSalt, effect, emitEvent)`
Roll a chance, then apply a status to the monster itself when it takes damage.

```js
// Lich: 20% chance to gain regen when hit (phylactery)
statusEffectOnDamaged(20, 0xdead000d, { key: "regen", turnsLeft: 3, potency: 2 }, "proc:phylactery")
```

#### `phaseOutOnDamaged(chancePct, seedSalt)`
Roll a chance on damage: heal the incoming damage back, gain 1 turn of invulnerability, and cancel the rest of the `onDamaged` list.

```js
// Carrion shade: 25% chance to phase through a hit entirely
phaseOutOnDamaged(25, 0xdead0102)
```

#### `mindflayerBlastOnHit(chancePct, seedSalt)`
Roll a chance: clear the target's learned spells, degrade 30% of floor memory, and apply `mindwipe` for 2 turns.

```js
mindflayerBlastOnHit(20, 0xdead000e)
```

#### `spawnPlasmaCloudOnDeath(opts)` — from `callbacks/death.js`
Spawn a plasma cloud hazard when the monster dies.

```js
import { spawnPlasmaCloudOnDeath } from "./callbacks/death.js";

spawnPlasmaCloudOnDeath({ turnsLeft: 3, radius: 1, damage: 2 })
```

---

### 1.4 The `ctx` object (CombatCallbackContext)

If you need to write a raw callback instead of using a factory:

```js
hooks: {
  onHit: [
    (ctx) => {
      // Read
      ctx.attacker   // entity ID of the attacker
      ctx.defender   // entity ID of the defender (usually the player)
      ctx.damage     // current damage value (readable/writable in onBeforeHit)

      // Roll deterministically
      if (!ctx.roll(30, 0xMYSEED)) return;  // 30% chance

      // Apply status effect to an entity
      ctx.pushEffect(ctx.defender, { key: "stun", turnsLeft: 2, potency: 1 });

      // Heal the attacker (monster)
      ctx.healAttacker(3);

      // Heal any entity
      ctx.heal(ctx.defender, 2);

      // Reflect damage back to the attacker
      ctx.retaliate(4);

      // Emit a semantic event for display/sound
      ctx.emit("proc:my_proc", { actor: ctx.attacker, target: ctx.defender });

      // Stop processing further callbacks in this list
      ctx.cancel("MY_REASON");
    }
  ],
}
```

**`ctx.damage` is only writable in `onBeforeHit`.** Reading it in other hooks gives you the final applied value.

---

### 1.5 Resistances reference

```js
resistances: {
  kinetic: {
    DR: 6,            // Flat damage reduction applied before multipliers
    pierceMult: 0.5,  // Piercing damage is multiplied by this (0.5 = half)
    slashMult: 0.7,   // Slashing damage multiplier
    bluntMult: 0.3,   // Blunt damage multiplier
  },
  thermal: {
    burnMult: 0,      // 0 = immune to fire, 1.5 = 50% more fire damage
  },
  electric: {
    ohms: Infinity,   // Infinity = immune to electric, higher = more resistant
  },
  chemical: {
    toxMult: 0,       // 0 = poison immune
  },
}
```

Omit any sub-key you don't need. At minimum every monster should have `kinetic: { DR: N }`.

---

### 1.6 Status effect keys (for `pushEffect`)

| Key | Effect |
|---|---|
| `disease` | Ongoing damage over time |
| `bleed` | Damage over time |
| `poison` | Damage over time |
| `burn` | Fire damage over time |
| `shock` | Interrupt/stun variant |
| `stun` | Lose next action |
| `regen` | Heal each turn |
| `weakened` | Reduced attack |
| `mindwipe` | Confused/hallucinating |
| `stoneskin` | Armor buff |
| `frost` | Slowed (speed reduced) |
| `invulnerable` | Ignore damage for duration |
| `thorns` | Visual proc marker |

---

### 1.7 Full example

```js
import {
  statusEffectOnHit,
  bonusDamageOnBeforeHit,
  drainOnHit,
  retaliateOnDamaged,
} from "./callbacks/combat.js";

// Add to the MONSTERS array in monsters.js
{
  id: 'blood_knight',
  name: 'Blood Knight',
  tier: 2,
  glyph: 'K',
  fg: '#cc2222',
  glow: '#881111',
  baseHp: 28,
  hpPerLevel: 3,
  attack: 4,
  defense: 3,
  damageDice: '2d6',
  sizeClass: 'M',
  massKg: 110,
  resistances: {
    kinetic: { DR: 8, bluntMult: 0.5 },
    chemical: { toxMult: 0 },
  },
  speed: 2,
  hooks: {
    onBeforeHit: [
      bonusDamageOnBeforeHit(30, 0xdead1001, 3, "proc:bloodlust"),
    ],
    onHit: [
      statusEffectOnHit(25, 0xdead1002, { key: "bleed", turnsLeft: 4, potency: 2 }, "proc:bleeding"),
      drainOnHit(40, 0xdead1003, 2),
    ],
    onDamaged: [
      retaliateOnDamaged(1, "proc:thorns"),
    ],
  },
  description: 'A warrior consumed by battle-rage. Grows stronger as it spills blood.',
}
```

---

## 2. Item Creation

**File:** `src/rules/data/itemCatalog.js`

All items live in the `ITEM_CATALOG` object keyed by their `id`. There are two families distinguished by `catalogKind`:

- `"equipment"` — things that occupy an equipment slot
- `"magic"` / `"food"` — consumables, tools, books, scrolls, wands

---

### 2.1 Equipment

```js
my_sword: {
  id: "my_sword",
  catalogKind: "equipment",
  name: "My Sword",
  type: "equip",            // Always "equip" for equipment
  slot: "weapon",           // weapon | armor | ring | offhand
  material: "steel",        // Visual/mechanical flavoring
  rarity: 2,                // 1=common, 2=magic, 3=rare, 4=legendary
  rarityName: "magic",      // "common" | "magic" | "rare" | "legendary"
  bonuses: {                // Stat bonuses while equipped — any stat name
    attack: 2,
    critChance: 0.05,
  },
  damageDice: "1d8",        // Weapons only. NdS notation.
  staminaCost: 10,          // Stamina consumed per attack.
  affixes: ["caustic1"],    // Optional: hardcoded affixes. Must exist in AFFIX_DEFS.
  description: "...",       // Optional flavor text.
}
```

**Valid slots:** `weapon`, `armor`, `ring`, `offhand`

**Bonus stat names:**

| Stat | Effect |
|---|---|
| `attack` | Flat hit/damage bonus |
| `defense` | Flat damage reduction |
| `maxHp` | Increases HP cap |
| `maxStamina` | Increases stamina cap |
| `staminaRegen` | Stamina regen per turn |
| `manaRegen` | Mana regen per turn |
| `critChance` | Added to crit probability (0.05 = +5%) |
| `critMult` | Added to crit damage multiplier |
| `fireResist` | Fire resistance 0–1 |
| `poisonResist` | Poison resistance 0–1 |
| `electricOhms` | Added electrical resistance |
| `kineticDR` | Added kinetic damage reduction |
| `slashResist` | Slash resistance 0–1 |
| `pierceResist` | Pierce resistance 0–1 |
| `bluntResist` | Blunt resistance 0–1 |
| `acidResist` | Acid resistance 0–1 |
| `dig` | Allows digging walls |
| `range` | Projectile range (bows) |

For bows, also set `subtype: "bow"` and `range: N`.

---

### 2.2 Magic items and consumables

```js
my_potion: {
  id: "my_potion",
  catalogKind: "magic",     // "magic" or "food"
  name: "Potion of X",
  type: "potion",           // See type reference below
  slot: "bag",              // Always "bag" for carried items
  material: "glass",        // Material string (visual only)
  rarity: 2,
  rarityName: "magic",
  value: 50,                // Sell/buy value
  weight: 10,               // Carry weight
  description: "...",
  hooks: {                  // See §2.3
    on_drink: (ctx, state) => { ... },
  },
}
```

**Item types:**

| Type | Description |
|---|---|
| `potion` | Drinkable or throwable |
| `tool` | Dippable multi-use tool |
| `scroll` | Single-use cast item |
| `wand` | Charged cast item |
| `learn` | Spellbook — teaches a spell |
| `book` | Flavor/lore book |
| `food` | Edible item |

---

### 2.3 Item hooks

Hooks are functions on the `hooks` object. Each receives `(ctx, state)` and returns a result object.

#### `on_drink` — Potions
Called when the player drinks the item.

```js
on_drink: (ctx, state) => {
  const actorId = Number(state?.actor || ctx.actor || 0) | 0;

  // Apply an effect
  ctx.helpers.addEffect(actorId, {
    key: "regen",
    potency: 3,
    turnsLeft: 10,
    onsetLeft: 0,
    peakLeft: 0,
    stack: "refresh",
    maxStacks: 1,
  });

  // Emit a status notification
  ctx.io.emit("status", { id: actorId, kind: "buff", text: "REGENERATING", source: actorId });

  return { consumed: true };   // consumed: true removes the item from inventory
},
```

#### `on_throw` — Potions
Called when the player throws the item.

```js
on_throw: (ctx, state) => {
  const actorId = Number(state?.actor || ctx.actor || 0) | 0;
  const spawnAt = ctx.helpers.adjacentPoint(actorId);

  ctx.helpers.spawnMonster("my_monster_id", spawnAt, {
    name: "Summoned Thing",
    faction: "enemy",
  });

  ctx.io.emit("item:thrown", {
    actor: actorId,
    itemId: Number(state?.itemId || ctx.primary || 0) | 0,
    at: spawnAt,
    result: { type: "spawned" },
  });

  return { consumed: true, spawned: "my_monster_id", at: spawnAt };
},
```

#### `on_dip` — Tools and potions
Called when something is dipped into this item (or this item into something else).

```js
// Optional gate — return true if the dip is valid for this target
can_dip_target: (state) => {
  return String(state?.targetInfo?.type || "") === "equip";
},

on_dip: (ctx, state) => {
  const targetId = Number(state?.targetId || 0) | 0;

  // Modify the target item's info
  ctx.helpers.patchItemInfo(targetId, {
    bonuses: { ...existingBonuses, attack: 1 },
  });

  ctx.io.emit("item:applied", {
    actor: state.actor,
    toolId: state.toolId,
    targetId,
    result: { type: "my_result" },
  });

  return { applied: true, consumedTool: true, resultType: "my_result" };
},
```

#### `on_use` — Scrolls, wands, books, spellbooks
Called when the player uses the item.

**Spellbook pattern** — teaches a spell whose ID is derived from the item ID:
```js
// Item id "book_lightning" → strips "book_" prefix → teaches spell "lightning"
on_use: createLearnSpellFromIdentityHook({
  identityPrefix: "book_",
  consumeOnSuccess: true,
}),
```

**Scroll/wand pattern** — casts a spell immediately without teaching it:
```js
// Item id "scroll_blastwave" → casts spell "blastwave"
on_use: createCastSpellFromIdentityHook({
  identityPrefix: "scroll_",
  targetMode: "self",        // "self" or "intentTarget"
  consumeOnSuccess: true,
}),
```

**Custom use:**
```js
on_use: (ctx, state) => {
  const actor = Number(state?.actor || ctx.actor || 0) | 0;
  ctx.io.emit("my:event", { actor });
  return { consumed: false };  // false = item stays in inventory
},
```

---

### 2.4 `ctx` reference (inside item hooks)

| Method | Description |
|---|---|
| `ctx.helpers.addEffect(entityId, effect)` | Add a status effect |
| `ctx.helpers.patchItemInfo(entityId, patch)` | Merge patch into item info |
| `ctx.helpers.setMaterial(entityId, material)` | Change item material |
| `ctx.helpers.spawnMonster(id, pos, overrides)` | Spawn a monster entity |
| `ctx.helpers.hazardSpawn(spec, pos)` | Spawn a hazard entity |
| `ctx.helpers.adjacentPoint(actorId)` | Get a walkable tile adjacent to actor |
| `ctx.helpers.int(min, max)` | Random integer in range |
| `ctx.helpers.pick(array, fallback)` | Pick random element |
| `ctx.io.emit(event, payload)` | Emit a display/sound event |
| `ctx.query.brain(actorId)` | Get actor's Brain component |
| `ctx.query.alive(entityId)` | Check if entity is alive |
| `ctx.query.itemInfo(entityId)` | Get item's info record |
| `ctx.mutate.learnSpell(actorId, spellId)` | Teach a spell to an actor |
| `ctx.rules.runSpell(actorId, spell, intent)` | Cast a spell immediately |
| `ctx.rules.resolveTarget(actorId)` | Get the actor's current combat target |

---

### 2.5 Full equipment example

```js
frostbrand_sword: {
  id: "frostbrand_sword",
  catalogKind: "equipment",
  name: "Frostbrand",
  type: "equip",
  slot: "weapon",
  material: "steel",
  rarity: 3,
  rarityName: "rare",
  bonuses: { attack: 3, coldResist: 0.2 },
  damageDice: "1d8",
  staminaCost: 9,
  affixes: ["fierce"],
  description: "A blade sheathed in permanent frost. Hits with a chill that lingers.",
},
```

### 2.6 Full consumable example

```js
potion_haste: {
  id: "potion_haste",
  catalogKind: "magic",
  name: "Potion of Haste",
  type: "potion",
  slot: "bag",
  material: "glass",
  rarity: 2,
  rarityName: "magic",
  value: 80,
  description: "Doubles your speed for a short time.",
  hooks: {
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      ctx.helpers.addEffect(actorId, {
        key: "haste",
        potency: 2,
        turnsLeft: 8,
        onsetLeft: 0,
        peakLeft: 0,
        stack: "refresh",
        maxStacks: 1,
      });
      ctx.io.emit("status", { id: actorId, kind: "buff", text: "HASTE", source: actorId });
      return { consumed: true };
    },
  },
},
```

---

## 3. Spell Creation

**Step 1:** Add a definition to `SPELL_DEFS` in `src/rules/data/spells.js`.
**Step 2:** Register a script handler in `src/rules/scripts/spells.js`.
**Step 3 (optional):** Add a spellbook, scroll, or wand to `itemCatalog.js`.

---

### 3.1 Spell definition

```js
// In SPELL_DEFS in src/rules/data/spells.js
my_spell: {
  id: 'my_spell',
  name: 'My Spell',
  manaCost: 8,
  minIntelligence: 0,   // Optional. Minimum INT to cast (0 = any).
  range: 10,            // Optional. Used by the targeting UI and your script.
  script: 'my_spell',   // Must match the key you register in scripts/spells.js.
},
```

That's the entire definition. All logic lives in the script.

---

### 3.2 Spell script

Register your handler in `src/rules/scripts/spells.js` using `registerSpellScript`:

```js
// At the bottom of src/rules/scripts/spells.js
registerSpellScript('my_spell', function mySpellScript(world, actor, spell, intent) {
  // world  — the ECS world
  // actor  — entity ID of the caster
  // spell  — the spell definition object from SPELL_DEFS
  // intent — { x, y, targetId, ... } from the input system

  const apos = world.get(actor, Position);
  if (!apos) return;

  // ... spell logic ...
});
```

---

### 3.3 Common patterns

#### Single-target damage (aimed at a tile)
```js
registerSpellScript('my_bolt', function(world, actor, spell, intent) {
  const apos = world.get(actor, Position);
  if (!apos) return;

  const tx = intent?.x != null ? intent.x | 0 : null;
  const ty = intent?.y != null ? intent.y | 0 : null;
  if (tx == null) return;

  // Find enemy at target tile
  let targetId = 0;
  for (const [id, pos] of world.query(Position)) {
    if ((pos.x | 0) === tx && (pos.y | 0) === ty) {
      const vit = world.get(id, Vitality);
      if (vit && (vit.hp | 0) > 0) { targetId = id; break; }
    }
  }
  if (!targetId) return;

  dealDamage(world, {
    target: targetId,
    amount: 8,
    source: actor,
    type: 'fire',           // fire | electric | cold | acid | physical | kinetic
    cause: 'spell:my_bolt',
    at: { x: tx, y: ty },
  });

  try { world.emit('spell:bolt', { actor, targetId, spellId: spell.id, from: { x: apos.x, y: apos.y }, to: { x: tx, y: ty }, chainIndex: 0 }); } catch {}
});
```

#### Auto-target nearest enemy in LOS
```js
const MAX_R = 10;
const d2 = (x0,y0,x1,y1) => { const dx=x1-x0, dy=y1-y0; return dx*dx+dy*dy; };

const candidates = [];
for (const [id, pos] of world.query(Position)) {
  if (id === actor) continue;
  const fac = world.get(id, Faction);
  if (!fac || fac.key !== 'enemy') continue;
  const vit = world.get(id, Vitality);
  if (!vit || (vit.hp | 0) <= 0) continue;
  if (d2(apos.x, apos.y, pos.x, pos.y) <= MAX_R * MAX_R)
    candidates.push({ id, x: pos.x, y: pos.y });
}
candidates.sort((a, b) => d2(apos.x, apos.y, a.x, a.y) - d2(apos.x, apos.y, b.x, b.y));

let target = null;
for (const c of candidates) {
  if (hasLOS(apos.x | 0, apos.y | 0, c.x | 0, c.y | 0, isOpaque)) { target = c; break; }
}
if (!target) return;
```

#### AoE in a radius
```js
const RADIUS = 2;
const BASE_DMG = 10;
const ox = intent.x | 0, oy = intent.y | 0;

for (const [id, pos] of world.query(Position)) {
  const vit = world.get(id, Vitality);
  if (!vit || (vit.hp | 0) <= 0) continue;
  // Chebyshev distance for square AoE
  const dist = Math.max(Math.abs((pos.x | 0) - ox), Math.abs((pos.y | 0) - oy));
  if (dist > RADIUS) continue;
  const dmg = dist <= 1 ? BASE_DMG : Math.max(1, Math.floor(BASE_DMG / 2));
  dealDamage(world, { target: id, amount: dmg, source: actor, type: 'fire', cause: 'spell:my_aoe' });
}
```

#### Apply a status effect to a target
```js
const ae = world.get(targetId, ActiveEffects);
const effect = { key: 'burn', turnsLeft: 4, potency: 2, stacks: 1 };
if (ae && Array.isArray(ae.effects)) {
  const existing = ae.effects.find(e => e.key === 'burn');
  if (existing) {
    existing.stacks = (existing.stacks || 1) + 1;
    existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft);
  } else {
    ae.effects.push(effect);
  }
} else {
  try { world.add(targetId, ActiveEffects, { effects: [effect] }); } catch {}
}
```

#### Teleport the caster
```js
const landing = { x: tx | 0, y: ty | 0 };
world.set(actor, Position, { x: landing.x, y: landing.y });
try { world.emit('moved', { id: actor, from: { x: apos.x, y: apos.y }, to: landing }); } catch {}
```

---

### 3.4 `dealDamage` reference

```js
dealDamage(world, {
  target: targetId,     // Entity ID to damage
  amount: 10,           // Raw damage before resistances
  source: actor,        // Entity ID of the caster (for attribution)
  type: 'electric',     // fire | electric | cold | acid | physical | kinetic
  cause: 'spell:foo',   // String tag — shows in the log
  at: { x, y },         // Optional: position hint for VFX
  noTrigger: true,      // Optional: skip secondary on-hit callbacks
})
// Returns { applied: boolean, amount: number, killed: boolean }
```

---

### 3.5 Emit conventions

Every spell should emit at least one semantic event so the display layer can show VFX. Always wrap in `try { } catch {}` so a bad event can never crash the rules layer.

```js
// Single bolt
try { world.emit('spell:bolt', { actor, targetId, spellId: spell.id, from, to, chainIndex: 0 }); } catch {}

// AoE at origin
try { world.emit('spell:meteor', { actor, origin: { x, y }, radius, randomized: false }); } catch {}

// Status proc
try { world.emit('proc:burning', { actor, target: targetId }); } catch {}

// Teleport
try { world.emit('spell:blink', { actor, spellId: spell.id, from, to, randomized: false }); } catch {}

// Failure
try { world.emit('spell:my_spell:failed', { actor, spellId: spell.id, reason: 'no_target' }); } catch {}
```

---

### 3.6 Connecting to items (spellbook / scroll / wand)

Naming convention is what connects an item to its spell. The item's ID must be `{prefix}{spellId}`.

**Spellbook** — teaches the spell, consumed on success:
```js
book_my_spell: {
  id: "book_my_spell",           // "book_" + spellId
  catalogKind: "magic",
  name: "Spellbook of My Spell",
  type: "learn",
  slot: "bag",
  material: "paper",
  rarity: 2,
  rarityName: "magic",
  description: "Teaches you My Spell.",
  hooks: {
    on_use: createLearnSpellFromIdentityHook({
      identityPrefix: "book_",
      consumeOnSuccess: true,
    }),
  },
},
```

**Scroll** — casts immediately, no learning, consumed on use:
```js
scroll_my_spell: {
  id: "scroll_my_spell",         // "scroll_" + spellId
  catalogKind: "magic",
  name: "Scroll of My Spell",
  type: "scroll",
  slot: "bag",
  material: "paper",
  rarity: 2,
  rarityName: "rare",
  description: "Casts My Spell once.",
  hooks: {
    on_use: createCastSpellFromIdentityHook({
      identityPrefix: "scroll_",
      targetMode: "self",          // "intentTarget" if the spell needs a tile target
      consumeOnSuccess: true,
    }),
  },
},
```

**Wand** — charged, targeted:
```js
wand_my_spell: {
  id: "wand_my_spell",
  catalogKind: "magic",
  name: "Wand of My Spell",
  type: "wand",
  slot: "bag",
  material: "wood",
  charges: 3,
  rarity: 2,
  rarityName: "rare",
  description: "3 charges of My Spell.",
  hooks: {
    on_use: createCastSpellFromIdentityHook({
      identityPrefix: "wand_",
      targetMode: "intentTarget",
      castEventSource: "wand",
      consumeOnSuccess: true,
    }),
  },
},
```

---

### 3.7 Full example — Chain Frost

```js
// --- src/rules/data/spells.js: add to SPELL_DEFS ---
chain_frost: {
  id: 'chain_frost',
  name: 'Chain Frost',
  manaCost: 10,
  minIntelligence: 0,
  script: 'chain_frost',
},

// --- src/rules/scripts/spells.js: register the handler ---
REGISTRY['chain_frost'] = function chainFrostScript(world, actor, spell, intent) {
  const apos = world.get(actor, Position);
  if (!apos) return;

  const MAX_R = 10, CHAIN_MAX = 2, BASE_DMG = 5;
  const d2 = (x0,y0,x1,y1) => { const dx=x1-x0,dy=y1-y0; return dx*dx+dy*dy; };

  const candidates = [];
  for (const [id, p] of world.query(Position)) {
    if (id === actor) continue;
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== 'enemy') continue;
    const vit = world.get(id, Vitality);
    if (!vit || (vit.hp|0) <= 0) continue;
    if (d2(apos.x,apos.y,p.x,p.y) <= MAX_R*MAX_R) candidates.push({ id, x:p.x, y:p.y });
  }
  candidates.sort((a,b) => d2(apos.x,apos.y,a.x,a.y) - d2(apos.x,apos.y,b.x,b.y));

  let first = null;
  for (const c of candidates) {
    if (hasLOS(apos.x|0, apos.y|0, c.x|0, c.y|0, isOpaque)) { first = c; break; }
  }
  if (!first) return;

  const chain = [first];
  const used = new Set([first.id]);
  while (chain.length < CHAIN_MAX) {
    const last = chain[chain.length-1];
    let best = null, bestD = Infinity;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      const dist = d2(last.x,last.y,c.x,c.y);
      if (dist <= 64 && dist < bestD) { best = c; bestD = dist; }
    }
    if (!best) break;
    used.add(best.id); chain.push(best);
  }

  for (let i = 0; i < chain.length; i++) {
    const t = chain[i];
    const dmg = Math.max(1, Math.round(BASE_DMG * Math.pow(0.6, i)));
    dealDamage(world, { target: t.id, amount: dmg, source: actor, type: 'cold', cause: 'spell:chain_frost' });

    // Apply frost slow
    let ae = world.get(t.id, ActiveEffects);
    if (!ae) { try { world.add(t.id, ActiveEffects, { effects: [] }); } catch {} ae = world.get(t.id, ActiveEffects); }
    if (ae && Array.isArray(ae.effects)) {
      const ex = ae.effects.find(e => e.key === 'frost');
      if (ex) { ex.turnsLeft = Math.max(ex.turnsLeft, 4); }
      else { ae.effects.push({ key: 'frost', turnsLeft: 4, potency: 1, stacks: 1 }); }
    }

    const from = i === 0 ? { x: apos.x, y: apos.y } : { x: chain[i-1].x, y: chain[i-1].y };
    try { world.emit('spell:bolt', { actor, targetId: t.id, spellId: spell.id, from, to: { x: t.x, y: t.y }, chainIndex: i }); } catch {}
  }
};
```

---

## 4. Affix Creation

**File:** `src/rules/data/affixes.js`

Affixes are enchantments that items carry — either hardcoded via the item's `affixes: [...]` array, or rolled randomly by the loot system. They are registered as named scripts and declared in `AFFIX_DEFS`.

---

### 4.1 Affix definition

```js
// Add to AFFIX_DEFS at the bottom of affixes.js
my_affix: {
  name: "My Affix",         // Display name shown on the item
  slots: ["weapon"],        // Which slots can roll this: weapon | armor | ring | offhand
  triggers: ["onHit"],      // When the script fires. Empty array for passive-only.
  script: AFFIX_MY_AFFIX,   // The registered script key constant (see §4.2)
  weight: 20,               // Drop weight. Higher = more common. ~15–30 is typical.
},
```

For passive (always-on stat) affixes use `passive` instead of `script` and leave `triggers` empty:

```js
my_passive_affix: {
  name: "My Passive",
  slots: ["ring", "armor"],
  triggers: [],
  passive: AFFIX_MY_PASSIVE,
  weight: 18,
},
```

**An affix must have either `script` or `passive`, never both.**

---

### 4.2 Registering the script

Declare a key constant near the top of `affixes.js`:

```js
const AFFIX_MY_AFFIX = "affix:my_affix";
```

Then call `registerScript` before `AFFIX_DEFS`:

```js
registerScript(AFFIX_MY_AFFIX, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    // your logic
  },
});
```

For passives:
```js
registerScript(AFFIX_MY_PASSIVE, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("defense", 2);
  },
});
```

---

### 4.3 ScriptVerb reference

| Verb constant | Fires when |
|---|---|
| `ScriptVerb.AffixOnBeforeHit` | Before damage is applied — modify `ctx.damage` here |
| `ScriptVerb.AffixOnHit` | After a hit connects |
| `ScriptVerb.AffixOnDamaged` | When the item's wearer takes damage |
| `ScriptVerb.AffixPassive` | On stat recalculation (equip / every turn) |

---

### 4.4 The affix `ctx` object

```js
(world, ctx) => {
  // Entities
  ctx.attacker   // entity ID of the attacker
  ctx.defender   // entity ID of the defender

  // Damage (writable in AffixOnBeforeHit)
  ctx.damage

  // Deterministic proc roll
  if (!procRoll(world, ctx.attacker, ctx.defender, 0xMYSEED, 25)) return;

  // Healing / retaliation
  ctx.healAttacker(amount);
  ctx.retaliate(amount);

  // Passive stat bonuses (AffixPassive only)
  ctx.addBonus("defense", 2);
  ctx.addBonus("maxHp", 10);
  ctx.addBonus("manaRegen", 0.5);
  ctx.addBonus("fireResist", 0.2);
  ctx.addBonus("electricOhms", 600);
  ctx.addBonus("kineticDR", 3);
  ctx.addBonus("poisonResist", 0.15);

  // Status effects
  upsertEffect(world, ctx.defender, { key: "burn", turnsLeft: 3, potency: 1, stacks: 1 });
  upsertEffect(world, ctx.attacker, { key: "regen", turnsLeft: 5, potency: 2, stacks: 1 });

  // Typed bonus damage chip (non-lethal, respects resistances)
  const dealt = applyNonLethalTypedChip(world, ctx, "acid", 1, "affix:my_affix");

  // Events
  try { world.emit && world.emit("proc:my_affix", { actor: ctx.attacker, target: ctx.defender }); } catch {}
}
```

`procRoll`, `upsertEffect`, and `applyNonLethalTypedChip` are all already defined as local helpers inside `affixes.js`.

---

### 4.5 Trigger vs. passive cheat sheet

| You want to... | Use | ScriptVerb |
|---|---|---|
| Deal bonus damage on hit | `script` + `triggers: ["onHit"]` | `AffixOnHit` |
| Modify damage before it lands | `script` + `triggers: ["onBeforeHit"]` | `AffixOnBeforeHit` |
| React when the wearer is hit | `script` + `triggers: ["onDamaged"]` | `AffixOnDamaged` |
| Apply a status to the target on hit | `script` + `triggers: ["onHit"]` | `AffixOnHit` |
| Lifesteal on hit | `script` + `triggers: ["onHit"]` | `AffixOnHit` |
| Add a flat stat bonus | `passive` + `triggers: []` | `AffixPassive` |
| Add resistance | `passive` + `triggers: []` | `AffixPassive` |

---

### 4.6 Full trigger affix example

A weapon affix that always deals +1 electric chip damage and has a 30% chance to apply `bleed`.

```js
const AFFIX_SERRATED = "affix:serrated1";

registerScript(AFFIX_SERRATED, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    // Always: deal 1 electric chip (non-lethal, respects resistances)
    applyNonLethalTypedChip(world, ctx, "electric", 1, "affix:serrated");

    // 30% chance: apply bleed
    if (!procRoll(world, ctx.attacker, ctx.defender, 0xc0ffee10, 30)) return;
    upsertEffect(world, ctx.defender, { key: "bleed", turnsLeft: 4, potency: 1, stacks: 1 });
    try { world.emit && world.emit("proc:serrated", { actor: ctx.attacker, target: ctx.defender }); } catch {}
  },
});

// Add to AFFIX_DEFS
serrated1: {
  name: "Serrated",
  slots: ["weapon"],
  triggers: ["onHit"],
  script: AFFIX_SERRATED,
  weight: 18,
},
```

---

### 4.7 Full passive affix example

An armor/offhand affix that grants +3 defense and near-immunity to shock.

```js
const AFFIX_GROUNDED = "affix:grounded1";

registerScript(AFFIX_GROUNDED, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("defense", 3);
    ctx.addBonus("electricOhms", 9999);
  },
});

// Add to AFFIX_DEFS
grounded1: {
  name: "Grounded",
  slots: ["armor", "offhand"],
  triggers: [],
  passive: AFFIX_GROUNDED,
  weight: 12,
},
```

---

### 4.8 Hardcoding an affix onto an item

To force a specific item to always carry an affix, add its ID to the item's `affixes` array in `itemCatalog.js`:

```js
my_special_sword: {
  id: "my_special_sword",
  ...
  affixes: ["serrated1"],        // Must be a key in AFFIX_DEFS
},

// Multiple affixes are fine
another_sword: {
  ...
  affixes: ["fierce", "vamp1"],
},
```

---

### 4.9 Seed salt discipline

Every `procRoll` call needs a unique `salt` constant. Reusing a salt causes two different procs to always fire or not fire in lockstep on the same combat step, which produces weird behavior that is hard to diagnose.

Convention used in this codebase: hex literals like `0xc0ffee01`, incrementing per call site. Before adding a new one, search for `0xc0ffee` in `affixes.js` to find the highest existing value and count up from there.
