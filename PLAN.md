# Phase 2: Empty Catch Block Triage — Implementation Plan

## Scope (revised)

The original CLEANUP_PLAN estimated 94 empty catches across 38 files.
Actual count: **273 empty catches across 58 files**.

## Classification Summary

| Category | Pattern | Count | Action |
|----------|---------|-------|--------|
| **A** (Intentional) | `world.add(...)` / `world.remove(...)` — ECS defensive | ~40 | Add inline comment |
| **B** (Should log) | `world.emit(...)`, `window.dispatchEvent(...)`, `messageLog.log(...)`, `ftext.add*(...)` | ~210 | Add `console.debug` |
| **C** (Error-hiding) | Substantive logic: combat resolution, spell dispatch, movement, item creation | ~23 | Add `console.error` |

## Logging Conventions

- **Category C**: `console.error('[moduleName] description:', e);`
- **Category B**: `console.debug('[moduleName] description:', e);`
- **Category A**: `// world.add may throw if component exists; safe to ignore` (or `remove`/`set` variant)

All catches that get logging gain a parameter: `catch {}` → `catch (e) { ... }`

## Work Order (8 batches, tests after each)

### Batch 1 — Category C priority (rules systems with error-hiding catches)
Files with substantive logic wrapped in empty catches. These are the most dangerous.

| File | Catches | Notes |
|------|---------|-------|
| `src/rules/systems/combatSystem.js` | 3 | 2× `resolveMeleeAttack` (Cat C), 1× intent cleanup (Cat A) |
| `src/rules/scripts/spells.js` | 21 | 1× spell dispatch `fn(...)` (Cat C), 20× `world.emit` (Cat B) |
| `src/rules/systems/movementSystem.js` | 9 | 1× outer try wrapping movement logic (Cat C), 8× emit/add (mixed A/B) |
| `src/rules/interaction/mutations.js` | 28 | ~12× `world.add` (Cat A), ~10× emit (Cat B), ~6× item creation/spawn (Cat C) |

**Run tests after batch 1.**

### Batch 2 — Rules systems (mostly Category B event emission + Category A ECS)
| File | Catches |
|------|---------|
| `src/rules/systems/petBehaviorSystem.js` | 11 |
| `src/rules/systems/itemPickupSystem.js` | 8 |
| `src/rules/systems/castSpellSystem.js` | 7 |
| `src/rules/systems/effectSystem.js` | 4 |
| `src/rules/systems/petCommandSystem.js` | 4 |
| `src/rules/systems/equipItemSystem.js` | 3 |
| `src/rules/systems/interactionSystem.js` | 3 |
| `src/rules/systems/throwSystem.js` | 3 |
| `src/rules/systems/monsterSpawnerSystem.js` | 3 |
| `src/rules/systems/useItemSystem.js` | 3 |
| `src/rules/systems/applySystem.js` | 3 |
| `src/rules/systems/drinkSystem.js` | 2 |
| `src/rules/systems/trapSystem.js` | 2 |
| `src/rules/systems/tauntSystem.js` | 2 |
| `src/rules/systems/itemDropSystem.js` | 2 |
| `src/rules/systems/waitSystem.js` | 1 |
| `src/rules/systems/cleanupSystem.js` | 1 |
| `src/rules/systems/shopkeeperSystem.js` | 1 |
| `src/rules/systems/aiChaseSystem.js` | 1 |
| `src/rules/systems/affixTriggerSystem.js` | 1 |

**Run tests after batch 2.**

### Batch 3 — Rules data, callbacks, utils, content
| File | Catches |
|------|---------|
| `src/rules/data/shopStock.js` | 9 (all Cat A) |
| `src/rules/data/affixes.js` | 8 |
| `src/rules/data/callbacks/projectile.js` | 3 |
| `src/rules/data/callbacks/combat.js` | 2 |
| `src/rules/utils/actionContexts.js` | 2 |
| `src/rules/data/callbacks/death.js` | 1 |
| `src/rules/data/callbacks/eat.js` | 1 |
| `src/rules/utils/inventoryStacking.js` | 1 |
| `src/rules/content/items/throwPayloads.js` | 1 |
| `src/rules/content/items/usePayloads.js` | 1 |
| `src/rules/content/alchemy/benchGame.js` | 1 |
| `src/rules/scripts/traps.js` | 1 |

**Run tests after batch 3.**

### Batch 4 — Rules environment + repositories
| File | Catches |
|------|---------|
| `src/rules/environment/dungeon/transition.js` | 2 |
| `src/rules/repositories/TombstoneRepository.js` | 2 |
| `src/rules/environment/dungeon/materialize.js` | 1 |
| `src/rules/environment/dungeon/populate.js` | 1 |

**Run tests after batch 4.**

### Batch 5 — main.js (the big one: 64 catches)
Mostly Category B (`window.dispatchEvent`, `ftext.add*`, `messageLog.log`), plus:
- 2× `world.set`/`world.destroy` (Cat A/B)
- 1× ftext init outer catch (Cat B)
- All `window.dispatchEvent` catches → `console.debug`
- All `ftext.*` catches → `console.debug`
- All `messageLog.log` catches → `console.debug`

**Run tests after batch 5.**

### Batch 6 — Display layer (hud, overlay, input)
| File | Catches |
|------|---------|
| `src/display/ui/hud.js` | 6 |
| `src/display/input/InputManager.js` | 5 |
| `src/display/ui/overlay.js` | 2 |
| `src/display/input/lockdown.js` | 1 |

**Run tests after batch 6.**

### Batch 7 — Main modules (wiring, feeds, spells)
| File | Catches |
|------|---------|
| `src/main/wiring/shopWiring.js` | 8 |
| `src/main/ui/hudFeeds.js` | 5 |
| `src/main/wiring/chestWiring.js` | 4 |
| `src/main/wiring/alchemyWiring.js` | 4 |
| `src/main/input/rulesDispatch.js` | 3 |
| `src/main/wiring/messageWiring.js` | 1 |
| `src/main/wiring/savegameLoad.js` | 1 |
| `src/main/wiring/digWiring.js` | 1 |
| `src/main/spells/activeSpellController.js` | 1 |

**Run tests after batch 7.**

### Batch 8 — Lib (ECS internals)
| File | Catches |
|------|---------|
| `src/lib/ecs-js/serialization.js` | 1 |
| `src/lib/ecs-js/hierarchy.js` | 1 |

**Run tests (final verification).**

## Verification

After each batch: `deno test --no-check --allow-read tests/`
Expected: 474 pass, 1 pre-existing failure (bleed effect test).
