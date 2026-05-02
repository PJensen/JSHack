# Content Migration Roadmap

Goal: all authored content (items, monsters, spells, affixes, NPCs) lives in
`src/content/`. `src/rules/data/` becomes pure engine config — no hand-authored
game content.

---

## Status

| Phase | Target | Lines | DSL | Status |
|---|---|---|---|---|
| A | `itemCatalogEquipment.js` + `itemCatalogMagic.js` | ~6800 | `defineItem()` | **DONE** |
| B | `monsters.js` + `townfolk.js` | ~2327 | `defineMonster()` / `defineNPC()` | not started |
| C | `spells.js` | ~1331 | `defineSpell()` (needs design) | not started |
| D | `affixes.js` | ~826 | `defineAffix()` (needs design) | not started |

---

## Phase A — Items (complete)

All equipment and magic items migrated to `src/content/items/`.
`MAGIC_ITEMS` and `EQUIPMENT_ITEMS` are now empty stubs.
Single entry point: `src/content/items/index.js`.

See [CONTENT-AUTHORING.md](CONTENT-AUTHORING.md) for the full authoring guide.

---

## Phase B — Monsters + NPCs

### What moves

- `src/rules/data/monsters.js` → `src/content/monsters/`
- `src/rules/data/townfolk.js` → `src/content/npcs/`

### DSL readiness

`defineMonster()` already exists in `src/content/define.js` and is battle-tested
on `barrowWight.js`. Migration is a straight conversion — same playbook as Phase A.

`defineTownfolk()` (or `defineNPC()`) does not exist yet. It needs to compile
`TownfolkJob` fields (`role`, `schedule`, `deliverX/Y`, etc.) alongside the palette
and name registration. Small surface area — 10 NPCs, 125 lines.

### Suggested file layout

```
src/content/monsters/
  index.js          ← barrel import
  tier0.js          ← rats, bats, snakes (floor 1-5)
  tier1.js          ← goblins, skeletons (floor 6-10)
  tier2.js          ← trolls, wights (floor 11-15)
  tier3.js          ← liches, elementals (floor 16+)
  barrowWight.js    ← already exists (scripted unique)

src/content/npcs/
  index.js
  townfolk.js       ← all 10 villagers
```

### Risk: callback arrays vs DSL hooks

Existing monsters use raw callback arrays: `hooks: { onHit: [fn1, fn2] }`.
`defineMonster()` handles this via `_compileMonsterDslHooks` — both styles
coexist. No engine changes needed.

### Acceptance

- `src/rules/data/monsters.js` → `export const MONSTERS = []`
- `src/rules/data/townfolk.js` → `export const TOWNFOLK = []`
- All existing monster/townfolk tests green

---

## Phase C — Spells

### What moves

- `src/rules/data/spells.js` (~1331 lines) → `src/content/spells/`

### DSL design needed

`defineSpell()` does not exist. Before migration, it needs to handle:

- **Targeting**: `'self' | 'enemy' | 'tile' | 'direction' | 'aoe'`
- **Resource costs**: mana, stamina, charges
- **VFX wiring**: spell identity → VFX emitter bridge (currently in `vfxWiring.js`)
- **Area effects**: radius, shape (circle, cone, line)
- **Channel/cast time**: instant vs channeled
- **Learned vs innate**: player-learnable vs monster-only
- **Hooks**: `onCast`, `onImpact`, `onChannel`, `onFizzle`

The VFX wiring is the hard part — spells drive particle emitters, screen shakes,
and projectile animations. `defineSpell()` needs a `vfx` field that the bridge
layer reads, rather than baking VFX logic into spell hooks.

### Suggested file layout

```
src/content/spells/
  index.js
  offensive.js      ← fireball, lightning bolt, magic missile
  utility.js        ← blink, identify, light
  healing.js        ← cure wounds, restoration
  curses.js         ← hex, agony, wither
  summons.js        ← animate skeleton, call familiar
```

---

## Phase D — Affixes

### What moves

- `src/rules/data/affixes.js` (~826 lines) → `src/content/affixes/`

### DSL design needed

`defineAffix()` does not exist. Affixes are simpler than spells:
mostly modifier tables (`{ bonuses: { attack: 2 } }`) with optional
`onApply` / `onRemove` hooks and rarity/tier gating.

Key fields to capture:
- `slot` or `slotMask` — which item types can roll this affix
- `tier` — depth gate
- `bonuses` — flat stat modifiers (same schema as item bonuses)
- `tags` — semantic labels (`'elemental'`, `'cursed'`, etc.)
- `onApply(ctx)` / `onRemove(ctx)` — scripted side effects
- `exclusive` — affix groups that can't stack

### Suggested file layout

```
src/content/affixes/
  index.js
  weapon.js         ← flaming, keen, venomous
  armor.js          ← reinforced, warded, featherlight
  jewelry.js        ← lucky, arcane, vampiric
  cursed.js         ← fumbling, heavy, fragile
```

---

## General migration playbook

Same steps every phase:

1. Write `defineFoo()` in `src/content/define.js` (if not already present).
2. Create `src/content/<category>/index.js` barrel.
3. Migrate entries file-by-file. Run `deno task test:fast` after each file.
4. Add `installContentCatalog.mjs` imports to any test files that break.
5. Gut the old `src/rules/data/` file to an empty export.
6. Confirm `deno task test:fast` + `deno task test:slow` both green.
7. Delete the gutted file once no importers remain (check with `grep -r`).

The loot table / spawn pool gap (item id referenced but not registered) only
surfaces in-game, not in the fast test suite. Always do a quick in-game smoke
test on depth 1 after each phase.
