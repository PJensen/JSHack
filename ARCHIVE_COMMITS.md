# JSHack Archive: Analytic Geometry Era

> **Archive branch:** `archive/analytic-geometry` at `81c65ae`
> **Master rewound to:** `792ef84` (sub-proj-ref, Nov 4 2025)
> **Date of cut:** Feb 7, 2026

---

## Cherry-Pick Reference

### CLEAN commits (can cherry-pick directly)

| # | Hash | Message | Features |
|---|------|---------|----------|
| 1 | `0304ec6` | Refactor main orchestration into modular helpers | main.js modularization, activeSpellController, hudFeeds, setupUIEventListeners, worldEvents, demoScene |
| 2 | `b0fa185` | Refactor rules scripting to use shared ScriptRef | scripting.js central router, affix string-key refactoring |
| 3 | `7b00985` | early meteor | meteor spell data, gesture recognizer, CastSpellIntent additions |
| 4 | `0060837` | early meteor (2) | meteor gesture follow-up |
| 5 | `71e4450` | meteor gesture fixed | meteor gesture fix |
| 6 | `19e002c` | blast wave | blastwave spell data, useItemSystem scroll path, items.js scroll additions |
| 7 | `6902bd8` | burning 2 | burning effect input/UI follow-up |
| 8 | `b3a3b8a` | quick-use, early | quick-use HUD bar |
| 9 | `e820c6d` | quick-use, early 2 | quick-use follow-up |
| 10 | `eb69053` | Fix touch targeting and ranged ammo handling | FaceIntent, faceSystem, rangedAttackSystem overhaul, rulesDispatch |
| 11 | `f49d4d9` | ammo consumption | ammo consumption logic |
| 12 | `e803185` | hud improvements | HUD effects stack badges, effects-stack tool |

### MIXED commits (need manual extraction — skip geometry/lighting files)

| # | Hash | Message | Clean parts | Geometry parts to skip |
|---|------|---------|-------------|----------------------|
| 13 | `7d3107a` | Add lightning gesture casting and improve movement | gestureRecognizers.js, overlay, InputManager | movementSystem (1 line) |
| 14 | `7dca1ba` | Gate lightning gesture behind hold and flatten FOV light | gestureRecognizers gate logic | renderEmissiveLights |
| 15 | `6a19d0f` | wooden bow + projectile | MonsterSpawner, Spawner archetype, monsterSpawnerSystem, RangedAttackIntent, bow data, hud shoot button | GeometryKernel, dungeonGenerator, movementSystem |
| 16 | `7df4318` | fire arrows improved, ammo, some lighting | ArrowsStack archetype, rangedAttack ammo, palette arrow glyphs | renderEmissiveLights, main.js rendering |
| 17 | `e7b57f9` | blast wave | blastwave spell scripts, overlay UI | main.js rendering |
| 18 | `fb1d914` | burning 2 | burning effect logic | main.js rendering, lighting/sources |
| 19 | `c549fb8` | adding a basic spike trap | Trap redesign, trapSystem, traps.js script, drinkSystem improvements (percentOfMaxHp), Items.js archetype updates | worldView (7 lines), palette (3 lines) |

### SKIP commits (geometry/FOV/lighting only)

| Hash | Message |
|------|---------|
| `a3f5acb` | adding world-carving experimental tool |
| `6b88eb3` | adjusting carving tool |
| `d228c1a` | Render analytic dungeon and FOV (**the big geometry commit**: GeometryKernel, primitives, dungeonGenerator, DungeonGeometry, BoundingCircle, Facing, movementSystem overhaul) |
| `10d69c4` | feat: add emissive torch lighting |
| `4b594b4` | Tighten player FOV lighting and layer ordering |
| `917a436` | Show ground pickup tooltip within reach |
| `42e33ca` | Improve overlay interactions and movement |
| `0248639` | Improve wall contact movement sliding |
| `d591758` | Implement grid-based movement and wall rendering |
| `1b1ae6d` | Stabilize tap movement and darken floor |
| `e93b95b` | Bias tap movement toward cardinals |
| `40ad099` | Improve tap cardinal bias and visuals |
| `a5776d0` | Add demo door and reduce player collision radius |
| `3b6c9e9` | hall radius -> 1 |
| `fec3d2f` | tweaking analytic floor color |
| `6b9e801` | expanding demo scene into 3 wings |
| `81c65ae` | Add news section with release update |

### Merge commits (skip — just merge markers)

| Hash | Message |
|------|---------|
| `9b986c3` | Merge PR #2 |
| `ba055a9` | Merge PR #4 |
| `2935a98` | Merge PR #5 |
| `267c724` | Merge PR #6 |
| `1ba639f` | Merge PR #7 |
| `a61dbf4` | Merge PR #8 |
| `52f8107` | Merge PR #9 |
| `057768f` | Merge PR #10 |
| `471da81` | Merge PR #11 |
| `010e46e` | Merge PR #13 |
| `494d603` | Merge PR #14 |

---

## File Triage

### CUT (delete — geometry/FOV/lighting)

| File | Lines |
|------|-------|
| `src/rules/environment/GeometryKernel.js` | 451 |
| `src/rules/environment/primitives.js` | 163 |
| `src/rules/environment/dungeonGenerator.js` | 173 |
| `src/rules/environment/worldGeometry.js` | 21 |
| `src/rules/environment/index.js` | 3 |
| `src/rules/components/DungeonGeometry.js` | 51 |
| `src/rules/components/LightSource.js` | 47 |
| `src/rules/components/BoundingCircle.js` | 17 |
| `src/rules/components/Facing.js` | 21 |
| `src/display/lighting/renderEmissiveLights.js` | 296 |
| `app/tools/js-hack-world-carving-editor.html` | 235 |

### SALVAGE (gameplay logic entangled with geometry — re-implement)

| File | Entanglement | What's worth keeping |
|------|-------------|---------------------|
| `src/rules/systems/movementSystem.js` | HEAVY — `kernel.distanceMove()` | Intent-consume-check-emit pattern |
| `src/rules/systems/combatSystem.js` | LIGHT — `BoundingCircle` range gate | All combat math (d20, crits, affixes) |
| `src/rules/systems/rangedAttackSystem.js` | HEAVY — `kernel.raycastOccl()` | Ammo, bow checks, arrow types, damage |
| `src/rules/systems/aiChaseSystem.js` | MINIMAL — float vs int | Chase algorithm |
| `src/rules/systems/itemPickupSystem.js` | LIGHT — Euclidean + `BoundingCircle` | Pickup/stacking logic |
| `src/rules/systems/trapSystem.js` | MINIMAL — `BoundingCircle.radius` | Trap trigger logic |
| `src/rules/systems/faceSystem.js` | LOW — `Facing` component | Trivial intent consumer |
| `src/rules/scripts/spells.js` | PARTIAL — blastwave uses kernel | Lightning, meteor clean; blastwave LOS needs grid replacement |
| `src/rules/archetypes/Player.js` | LIGHT — BoundingCircle, Facing | Core player archetype |
| `src/rules/archetypes/Creatures.js` | LIGHT — BoundingCircle, Facing | Creature archetypes |
| `src/rules/components/Position.js` | CORE — `isInteger` → `isFinite` | Revert to integer |
| `src/rules/components/Intents/MoveIntent.js` | CORE — float dx/dy + distance | Revert to integer |
| `src/bridge/schema/worldView.js` | HEAVY — DungeonView, emissives, FOV | Bridge pattern; trap-hiding logic |
| `app/input/rulesDispatch.js` | LIGHT — face/ranged dispatch | Dispatch pattern |
| `app/rules/scheduler.js` | LIGHT — new system registrations | Scheduler structure |

### KEEP (independent of geometry)

| File | What it is |
|------|-----------|
| `src/rules/scripting.js` | Central script registry + verb dispatch (122 lines) |
| `src/rules/systems/monsterSpawnerSystem.js` | Monster spawning (58 lines) |
| `src/rules/components/MonsterSpawner.js` | Spawner config component (47 lines) |
| `src/rules/archetypes/Spawner.js` | Spawner archetype (26 lines) |
| `src/rules/scripts/traps.js` | Spike trap script (23 lines) |
| `src/rules/components/Intents/RangedAttackIntent.js` | Ranged intent marker (8 lines) |
| `src/main/spells/activeSpellController.js` | Active spell state (69 lines) |
| `src/display/input/gestureRecognizers.js` | Gesture recognition (294 lines) |
| `src/display/ui/hud.js` | HUD improvements |
| `src/display/ui/overlay.js` | Spell gesture hints |
| `src/display/input/InputManager.js` | Pointer gesture tracking |
| `src/main/ui/hudFeeds.js` | HUD data feeds (87 lines) |
| `src/main/ui/setupUIEventListeners.js` | UI event wiring (422 lines) |
| `src/main/world/worldEvents.js` | Event handler hub (784 lines) |
| `src/main/scene/demoScene.js` | Scene builder pattern (259 lines) |
| `src/rules/data/affixes.js` | String-key affix refactoring |
| `src/rules/data/spells.js` | meteor + blastwave definitions |
| `src/rules/data/items.js` | Bow + arrows item defs |
| `src/rules/archetypes/Items.js` | ArrowsStack, percentOfMaxHp potion |
| `src/rules/systems/drinkSystem.js` | percentOfMaxHp potion feature |
| `src/rules/systems/useItemSystem.js` | Scroll direct-cast path |
| `src/rules/systems/equipmentSystem.js` | scripting router switch |
| `src/rules/systems/affixTriggerSystem.js` | scripting router switch |
| `src/rules/components/Trap.js` | Redesigned: script key + params + armed/revealed |
| `app/tools/js-hack-effects-stack.html` | Effects stack visual test tool |

---

## Full Commit Log (archive/analytic-geometry)

All commits from initial through `81c65ae`, newest first:

---

## 81c65ae4d0cc8b02fe683578ecb256500d913916
- **Date:** 2025-11-15 21:56:21 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Add news section with release update
---
## e803185c5dd6f1639541f6419be153e02becc0f6
- **Date:** 2025-11-11 18:56:27 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** hud improvements
---
## f49d4d97d8541d64e5e5b4d0e81a8539c82a1300
- **Date:** 2025-11-09 12:36:39 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** ammo consumption
---
## c549fb8b6d1a26ef60552d7eb8939e3b4c9faa7a
- **Date:** 2025-11-09 12:27:53 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** adding a basic spike trap
---
## 6b9e80162af15b047aaee07c14bc4a81f7c0dbf7
- **Date:** 2025-11-09 12:04:19 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** expaning demo scene into 3 wings
---
## fec3d2fc674da74e14345e7c634f0d89c4d060cb
- **Date:** 2025-11-09 11:50:15 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** tweaking analytic floor color
---
## 3b6c9e9ebb3aafa3b24414bc5fe142d0acff28f2
- **Date:** 2025-11-09 11:43:39 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** hall radius -> 1
---
## 494d6035471373e3c71f6de5ae7476256f05ad49
- **Date:** 2025-11-09 11:42:57 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #14 from PJensen/codex/adjust-player-bounding-circle-for-passageway
---
## a5776d08efb29dfd0fe19317e9d72cea60059da7
- **Date:** 2025-11-09 11:41:57 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Add demo door and reduce player collision radius
---
## 010e46e7d896100a6b733da72555efa69eb90ce7
- **Date:** 2025-11-09 11:24:46 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #13 from PJensen/codex/implement-grid-based-8-directional-movement
---
## 40ad0997a5272d1cb37507c1d981e85b7a81ac57
- **Date:** 2025-11-09 11:22:29 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Improve tap cardinal bias and visuals
---
## e93b95b8ddee4c130bbbe6310f841bbc4aa5eb10
- **Date:** 2025-11-09 11:07:59 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Bias tap movement toward cardinals
---
## 1b1ae6d136d9559beb9047525e65d90694670669
- **Date:** 2025-11-08 17:17:28 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Stabilize tap movement and darken floor
---
## d591758b2f0c1ca931637b26dbdee9f34086916e
- **Date:** 2025-11-08 17:09:20 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Implement grid-based movement and wall rendering
---
## 471da8149486951ce765d221c87e45b9f6ce8145
- **Date:** 2025-11-08 13:30:35 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #11 from PJensen/codex/fix-mobile-tap-shooting-mechanics
---
## eb69053dbe93b20fb66c45a2879aaf6dd7760735
- **Date:** 2025-11-08 13:24:59 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Fix touch targeting and ranged ammo handling
---
## e820c6db0d3cd931e49b323ee046a33e8aac95ae
- **Date:** 2025-11-08 13:06:03 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** quick-use, early 2
---
## b3a3b8af85767f90797c43a6dcb790f2c8124432
- **Date:** 2025-11-08 12:44:28 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** quick-use, early
---
## 19e002c409ec11eaa755fb28c596b6909c1abf7d
- **Date:** 2025-11-08 11:46:27 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** blast wave
---
## e7b57f9e661f483db4b8b9c60be3f6be5ad297c4
- **Date:** 2025-11-08 11:37:56 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** blast wave
---
## 71e44509a5f96c6db2a5dc9dae9a777eb4d063fe
- **Date:** 2025-11-08 11:13:04 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** meteor gesture fixed
---
## 6902bd885291bcc3b3e7812cfad55057c35bac3e
- **Date:** 2025-11-08 11:09:33 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** burning 2
---
## fb1d91458abdda85fc129a26a6bb887507e91911
- **Date:** 2025-11-08 11:02:37 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** burning 2
---
## 0060837229e90fff9587cb988d0f18373fc63396
- **Date:** 2025-11-08 10:38:33 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** early meteor
---
## 7b00985b3aeefd5d136fdee13e2295848df38dc6
- **Date:** 2025-11-08 10:15:20 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** early meteor
---
## 7df4318c2da6c4ad2eb102b8c4b411fee52fdc58
- **Date:** 2025-11-08 09:51:59 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** fire arrows improved, ammo, some lighting
---
## 057768fd3445fb0c81822750e4a9109d0c0f85e8
- **Date:** 2025-11-07 19:52:48 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #10 from PJensen:local-features
---
## 6a19d0fe897ac7fb54c40519ef4aca1878b43db5
- **Date:** 2025-11-07 19:52:10 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** wooden bow + projectile
---
## 52f8107e7f96353f8b6935d3197d70e1964e6421
- **Date:** 2025-11-07 07:56:01 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #9 from PJensen/codex/fix-wall-sticking-issue-and-add-lightning-spell-mechanic
---
## 7dca1bafb18fcd9c36f1ae1db0f8caa6689fbae8
- **Date:** 2025-11-07 07:52:34 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Gate lightning gesture behind hold and flatten FOV light
---
## 7d3107ad9b6ec612af978d8298baf0a84eced3ff
- **Date:** 2025-11-06 21:01:50 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Add lightning gesture casting and improve movement
---
## a61dbf4f5e5964421c51446faa8806174dea71a5
- **Date:** 2025-11-06 20:29:23 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #8 from PJensen/codex/implement-smooth-lighting-with-emissive-torches
---
## 4b594b41e4cf13c210fdb187abac6cd800944447
- **Date:** 2025-11-06 20:27:29 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Tighten player FOV lighting and layer ordering
---
## 10d69c4f13e7a71e262708eccce31f68a6428a4d
- **Date:** 2025-11-06 17:19:21 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** feat: add emissive torch lighting
---
## 1ba639feaee5bb0e83fef4c37edc1649e2902ef0
- **Date:** 2025-11-06 17:01:29 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #7 from PJensen/codex/port-scripted-actions-to-scriptref
---
## b0fa185d6247497a80335fc8d861f29363bda9ee
- **Date:** 2025-11-06 16:58:48 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Refactor rules scripting to use shared ScriptRef
---
## 267c724b6c139353931b828dae82740b71d53d79
- **Date:** 2025-11-06 16:45:05 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #6 from PJensen/codex/enhance-menu-ux-and-gameplay-mechanics
---
## 02486390177a014dbc0c5805306bcd29cd5b6161
- **Date:** 2025-11-06 16:43:54 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Improve wall contact movement sliding
---
## 42e33ca84b24410110a8fb78dd6b797cd579aa18
- **Date:** 2025-11-06 16:33:17 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Improve overlay interactions and movement
---
## 2935a98106e7fb0aa58362088ce879870d84fc26
- **Date:** 2025-11-06 16:14:47 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #5 from PJensen/codex/add-pickup-tooltip-for-nearby-items
---
## 917a4366aa75122e20572383e6db89c640ef7bb6
- **Date:** 2025-11-06 16:13:03 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Show ground pickup tooltip within reach
---
## ba055a96fb2fb8157aa8da6407df579514e79aee
- **Date:** 2025-11-06 15:50:00 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #4 from PJensen/codex/build-environment-for-dungeon-simulation-iwvzyn
---
## d228c1ad09dd077e91f8b30317d26973485ed248
- **Date:** 2025-11-06 14:32:24 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Render analytic dungeon dungeon and FOV
---
## 6b88eb366fb3f8a9e9bd9b4cff2e85ef7bcc7c07
- **Date:** 2025-11-06 11:01:59 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** adjusting carving tool
---
## a3f5acb8ca7eeaaccb7a972836dcc08ea0f1b8b6
- **Date:** 2025-11-06 10:40:08 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** adding "world-carving" experimental tool, renaming existing "fx-tool", repoint ecs-lib
---
## 9b986c3340dce9ad85b770e30ad220195f716b29
- **Date:** 2025-11-06 09:14:14 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Merge pull request #2 from PJensen/codex/refactor-main.js-for-maintainability
---
## 0304ec61c7138df288dd4c158eda9af8e86f336d
- **Date:** 2025-11-06 09:12:15 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Refactor main orchestration into modular helpers
---
## 792ef84418f6906cbe8f5bed56080606fd6b4852
- **Date:** 2025-11-04 22:07:07 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** sub-proj-ref
---
## 89d319a6e3facc99afbae13c54d2c276a6841f5f
- **Date:** 2025-11-03 21:50:38 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** tweaking thorns proc
---
## 75bd9c9024d14f0bcddce519c1d4b538d708d7e8
- **Date:** 2025-11-03 21:30:08 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** show affixes in HUD
---
## 65a82c7ec63fa1821121330d125bb5bb1df38ba1
- **Date:** 2025-11-03 21:28:06 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** small tweaks
---
## bbc1e7f2b9d38c10275cf79b6d48dda6853a05ff
- **Date:** 2025-11-03 21:20:02 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** small tweaks
---
## ff1fb25f3b7a4fd3873ef6cec54103f108fb9588
- **Date:** 2025-11-03 21:07:09 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** monster pickups + ortho hits + tweaks
---
## c7caa22426380d0299c067d199064065faf98da6
- **Date:** 2025-11-03 20:35:04 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** core engine work
---
## 6c27e1b96e28a42b7977aa17bd6e6cbd578f3b2e
- **Date:** 2025-11-02 20:21:27 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** smooth inputs
---
## c5396ef42974e3ac2b65b53bead96ac69952678e
- **Date:** 2025-11-02 20:15:39 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** perf
---
## e3a76307014d4c42cf81a69db806ebb36a895d28
- **Date:** 2025-11-02 20:09:29 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** perf tuning 2
---
## bf9cce9a1c879820e92b22cc1dce2c05b9b83080
- **Date:** 2025-11-02 19:49:48 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** perf tuning 2
---
## efbb0a486ffd7029d9c1ab66fd71f5cbc7d7fc0f
- **Date:** 2025-11-02 19:41:03 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** perf tuning
---
## 9dabcff0718fa288cb31ede9c618cac3dd5139b9
- **Date:** 2025-11-02 19:25:19 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** double tap to pickup
---
## 7579f8707f1f3ec46c79230a2f0a5c0a5a53b522
- **Date:** 2025-11-02 19:18:57 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** pickup chooser
---
## 27970b02b3e3754b4dbe72aa522a151011fa0612
- **Date:** 2025-11-02 18:53:22 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** rules dispatch, for pickup
---
## b6dfad36cf05dc3b48b2945026698ac3cc868d9e
- **Date:** 2025-11-02 18:41:46 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** sanity tests
---
## 9de1fc04277e042146769f180e1fb75bccd4296a
- **Date:** 2025-11-02 18:34:48 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** basic combit + affix
---
## 3963c480f5d355963baa04a3d7ee836d31b5700b
- **Date:** 2025-11-02 16:42:04 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** affix-equip-2
---
## 6646e3c719e49234890a6e8c39d1fce74259bfee
- **Date:** 2025-11-02 16:30:39 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** equipment + script-ref + affix + loaders
---
## 1c74145f4543214b8cce005f100e71456cdd48be
- **Date:** 2025-11-02 13:51:35 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** adding data (early)
---
## b0ead78ca59539cf12ef3a0b268fdb158fe2bfe6
- **Date:** 2025-11-02 13:44:40 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** auto-pickup + tests + gold + move system
---
## 45f12106cc1588c30e89137a2b46fe9efe4c4a03
- **Date:** 2025-11-02 12:18:07 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** auto-pickup 0.1
---
## dcf59b61b84d52831acc79f9227a74192a3cd218
- **Date:** 2025-11-02 11:57:36 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** cache buster + fav-icon
---
## 09777dad7ea3d952d572a8940642c291c136969c
- **Date:** 2025-11-02 11:47:17 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** demo room 0.2
---
## 276b29932d0f7b98c07aa4b4ec83536f2d3329e8
- **Date:** 2025-11-02 11:25:19 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** demo room 0.1
---
## c56cf6cf301d140f1f6acfa46244054b72ce5b14
- **Date:** 2025-11-02 11:11:37 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** demo room 0
---
## 69cc2e4b04ffd94c00da7d6ed05ac93a1c7ad0f4
- **Date:** 2025-11-02 10:34:07 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** lockdown
---
## ecf66d54f828f76ce27e55839b024b0a0aecfebc
- **Date:** 2025-11-02 10:16:40 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Submodule ecs-js: track main and update to latest
---
## 0811793cd8dc96b1eb1896510e0862230fbf05e5
- **Date:** 2025-11-02 10:13:34 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Re-add ecs-js submodule (forced)
---
## aeaa08c9d799e6db8865dac2aeb738ac679c752a
- **Date:** 2025-11-02 10:13:14 -0500
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** Remove ecs-js submodule
---
## f8cd3d1beefa5c7da8539ae407207d18ec623e04
- **Date:** 2025-11-01 18:11:09 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** world-view
---
## 285040437fb69f2eee855a19296438148dcc3402
- **Date:** 2025-11-01 17:09:05 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** continued wiring and fixes
---
## 82b398e9e53e59d888c0649ac1819a5064c2e345
- **Date:** 2025-11-01 16:42:31 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** continued wiring and fixes
---
## 2454c5c69aae08cc4e5070f0217c4b9789fee3a6
- **Date:** 2025-11-01 15:25:33 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** actions + actionManager
---
## 98b2b5ef39f1a6ed0a5b9b174bbdb04d933ff7bd
- **Date:** 2025-11-01 14:50:11 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** intent wiring 0
---
## 16d5fb7d5e4958e4a7e79a5abd238d02e2d1ab2e
- **Date:** 2025-11-01 13:55:58 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** effects + tests
---
## c57191d132ab94ff0af52ed64f1a363723079614
- **Date:** 2025-11-01 12:35:47 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** small updates
---
## b98db748c44c77b9369608f5b896223a13e7672f
- **Date:** 2025-11-01 12:29:44 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** creatures
---
## c0daaf1ab53b1fe8cea5eb1d6759bd29591814a0
- **Date:** 2025-11-01 12:22:26 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** adding components
---
## b1d88d38bc88e111354342c25eb1ffd2ed84f9ff
- **Date:** 2025-11-01 12:11:51 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** moving files around
---
## cf94b91dbed85ea70c3267e4968dd05db817fb3b
- **Date:** 2025-11-01 12:11:16 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** moving files around
---
## 612a99eee28e85213cec96bdc9c102b3647c0fd6
- **Date:** 2025-11-01 12:05:29 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** item pickup/drop tests
---
## 18786b431ceba9c6b204180100bb22a8eadc28ff
- **Date:** 2025-10-15 07:07:17 -0400
- **Author:** Pete Jensen <jensen.petej@gmail.com>
- **Message:** init
- **Body:** Add project instructions and README for public release / Add Features section to README / Add .gitignore and remove copilot instructions from repo / Reorganize README: overview before features / chore: add initial TODO with engine & gameplay priorities / feat: add F2 toggle for auto-pickup (persisted) and HUD indicator / chore: add inline SVG favicon (data URI) / Add classic environment features: fountain, altar, throne, grave, sink; visuals and simple interactions / render: replace ASCII lightning with canvas glow lines and endpoint sparks / Overworld: Perlin grass shades, stairs explicit Enter/Down, pause dungeon while outside / UI: show stairs hint when standing on stairs / Add game-over overlay and tombstone recording to localStorage / add gold / Added: '.' to wait / change glyphs / perlin noise, cluster mountains / perlin use water / updated glyphs / add rings, one shield / Rename js-hack.html to index.html / moving to modular arch + ecs / math + cfg / ecs arch / small demo correction; new main otw / adding reference material / cleaning up / ecs demo / ux / ux scaffold w/ ecs early map / player comp / adding core + data / data scaff / adding more defs / bresenhamLine / early system blowout / rm / not loving d-pad / deep cuts / sys / feat(ecos): add Explorer/Threat/WorldAnchor/Ephemeral archetypes / render / setupCanvasSize / major rendering and core updates / particle2 / gold-1 / input + movement / dungeon systems / ecs:mv:goldpickup / ortho movement / touch / use the bus / unused burst / extents, coords / grid shift / camera alignment issue / Dumb nightly delight: gold respawn / lighting early / smoothing / tightening radial FOV / wall-wall / light-grid-update / item shad opposite source / shadows / perf-tweaks / mv fps / small cleanup / organizing / night-night / dungeon-gen-0 / renderers-2 / fov on/off / cleanup cont / no more walking through walls / rendering w/ map-view / add torch archetype / emitter + system / emitter wireup / emitter tweaks / improving flicker / darkening / no light far away / fog of war / d-gen-2/3/4/5-tor / lights n walls / hallu / disable hallu on start / target-dummy / combat basics / float text / float details / float text: opts-driven motion and scaling / ft presets / presets / pixelated / mobile device scale / cb / fix-offset / small-fix / wall-line / door early / ecs backport for doors / sm seed / m-basic / project reset, key concepts retained offline / updating 10 commandments / rm custom instr / manifest / camera resource / removed old structure / up ver / fx-builder / drinks / upgrade / cut down material / named-identity / cont
