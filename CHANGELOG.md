# JSHack — Patch Notes

---

## February 19, 2026

**Deep Integration Phase Begins**

The architecture target is unchanged. Drift is not permitted. A TODO document has been written to ensure this. The TODO document now has a section called "Conceptual Anchor (Do Not Drift)."

**General**
- First pass of the deep integration phase is underway.
- `ctx.fx` alias confirmed working as intended. It was, in fact, working as intended the whole time.
- The architecture has been fully documented so that the next session doesn't have to figure it out again. We have been here before.

---

## February 18, 2026

**Architecture Pass Zero (arch-0)**

> *"big night that should massively boost content item creation velocity — it's practically a DSL."*

After a productive late night, `features/arch-0` has been merged into master. The system now has the shape it was always supposed to have: mechanics in canonical verb pipelines, behavior in data-space hooks, interactions through one runtime. The fact that this took until February is nobody's fault.

**General**
- `ctx.helpers` is now first-class. `ctx.fx` exists as a compatibility alias, a diplomatic compromise between the old world and the new one.
- Architecture is "strongly memo-aligned." The memos have been read. Their wisdom has been heeded.
- Item creation velocity has increased dramatically. The term "DSL" was used by the developer. This was not hyperbole.

**Items**
- Player now starts with a Stoneskin potion. The developer gave themselves a very good item for play testing purposes. No apologies have been issued.

**Under the Hood**
- Script ref fixes applied on main. The refs were not right. They are right now.

---

## February 17, 2026

**The Homecoming Update**

The Scroll of Homecoming was added. It was then fixed five separate times in one day. It now works.

**General**
- Save data is cleared on load. Your previous death no longer follows you around.
- Stair interactions now function as originally intended. The stairs have been stairs the whole time; the code around them was the problem.

**Items**
- Added **Scroll of Homecoming**: teleports the player to a home anchor and places a return portal back. Required five commits to get right:
  - The first version did nothing at all.
  - The second version resolved immediately, before anything was ready.
  - The third version had the wrong anchor depth.
  - The fourth version put the portal in the wrong place.
  - The fifth version finally returns you to exactly where you left. This is the one in the game.
- Scroll of Mapping removed from starter inventory. Finding out where you are is now part of the experience.
- Starting wand changed to Wand of Frost for play testing. The cold has arrived.
- Item descriptions now displayed in the inventory panel. You can read what things do before you eat them.
- Tooltip moved slightly. It was in a slightly wrong place.

---

## February 16, 2026

**The Overworld & Save/Load Update**

> *"fix mah house"*

The world can now be saved and loaded. The developer's house (a literal room in the overworld) had an issue and was fixed. These two facts are related.

**General**
- Save and load system added. The game persists. `:-)` (developer's reaction, on record)
- Overworld slice 0 is here. You can go outside. The outside exists and has grass.
- The world ticks after a zone transition. It was not doing that. It is now.
- Only the topmost item or actor is rendered per tile. Previously, a stack of items rendered all of itself. This was confusing.
- Berry bushes have a regrow countdown. They will return. Give them time.

**Items**
- Berry bushes now drop loot. Harvesting has been made profitable.
- Two new affixes added. Three debug items were also added to use them. These items exist for science.
- Resist equipment now functions. It was not functioning before.

**Monsters**
- Random affixes were being secretly applied by the AI assistant without being asked. This has been forcibly corrected. It will not happen again.

**Under the Hood**
- CDX fix applied.
- Floor query issue resolved.
- Chest wiring cleaned up. It had a smell.
- ecs-js submodule bumped for world loading updates.

---

## February 15, 2026

**The Data Orientation Update**

> *"we are riding above and beside ECS-js — a pittance to the gods of complexity and performance. (still trashing the place)"*

A morning was spent thinking. Several technical memos were written. The old item definitions have been removed. The action/transaction boundary is real now.

**General**
- The old item definition system has been ripped out. It was trash. It is gone.
- Action/transaction boundary established. Either the action commits or it does not. There is no in-between.
- Material reaction system adjusted to be canonical. "Canonical" means it agrees with itself.

**Items**
- Added **Book of the Dead** :-). The AI assistant had an incorrect interpretation of what this book should do. It has been corrected.
- Added **Book of the Dead** (the actual one, corrected). It now works correctly.
- Food now decays. Your rations have a shelf life. This is a roguelike, not a buffet.
- Comma key now drops items. This is now the intended behavior.

**Combat & Status**
- Damage pipes added. Damage flows through the correct pipes now instead of wherever it was going before.
- Damage pipes refined in the very next commit. The first pass of pipes needed refinement.
- Status effects added: **Confused**, **Weakened**, and others. You may now become confused. The confusion is intentional.
- Stacking utilities added. Things stack. The math is correct.
- Meteor is now considerably more dangerous. You were not taking it seriously enough.

**Bug Fixes**
- Tombstone message was wrong. It is now correct. Your cause of death is accurately reported.
- Tombstones no longer have a collider. You can walk through grief.
- Tests were failing. They are now failing forward. Progress.

---

## February 14, 2026

**The Material Science Revival**

> *"conduction ;-)"*

Materials are back. They were removed on February 7th. Their absence was felt. They have returned with more features than they had before, including the ability for things to conduct electricity. This was added with a wink.

**General**
- Material science restored and expanded.
- Conduction added. Chains of conductive materials will carry effects. This is a feature.
- Resistance system added. Some things resist other things. Now that is tracked.
- Effects guard added; invulnerability centralized. You are either invulnerable or you are not.
- Hardcoded values removed. The numbers are now stored like numbers should be stored.

**VFX**
- Plasma clouds added (early). They billow. The math is a quad-bezier curve.

**Items**
- Apply system merged. Things can be applied to other things.
- Gems added (early). Their true names are not yet known.
- Gem identification added (early). The mystery deepens.
- Stamina now required to dig. Your pickaxe is not free. Your arms get tired.
- "Boot" message added. The game says hello now.
- Touchstone starts as pre-identified during testing. The developer knows what it is. The player does not.

**Monsters**
- Monster procs added across multiple passes. They now trigger.
- Material reaction profiles established. Reactions are systematic.

**Death**
- Heroic deaths can now be shared on social media. Everyone will know.

**Under the Hood**
- Direct mutation on live records instead of deferred ticks. Faster. More correct.
- Merged: stamina-recovery, apply-system, vfx-plasma-cloud.
- README updated. There was confusion about how to run the project. There is less confusion now.

---

## February 13, 2026

**The Society Update**

> *"needs a miracle"*

Pets, gods, shops, prayer, stamina, engravings, ambient sound, status effects, and a state machine for your cat. All in one day. The miracle arrived.

**General**
- Stamina system added. You have a limited supply of effort.
- Ambient sound system added. The dungeon has a voice now. Log messages significantly improved.
- Status and active effects system added.
- Cross-system coupling removed. 210 tests pass. The tests are the guardrail.

**Religion & Gods**
- Additional gods added. The pantheon is expanding.
- Prayer system wired: intent, system, and button all connected. The gods are listening.
- Killing enemies counts as an offering. Violence has a spiritual component in this dungeon.
- Hitting your pet angers the appropriate deity. Don't do it. (`wrath+++`)

**Pets**
- Pet state machine implemented. Your cat has states now.
- Pet stances are free actions. Your cat can be on guard without costing you a turn.
- Eating your pet is tracked. This is handled.

**Shops**
- Shop system added. The merchant has opened, mostly.
- Shops placed at leaf rooms behind a single door.

**Dungeon**
- Leaf rooms with one door added.

**Items**
- Iron pickaxe added.
- Player spawns with a weapon in hand. You are no longer defenseless at the start.

**Bug Fixes**
- Shop open bug fixed.
- Chests no longer have a collider. You can stand right next to a chest now.

---

## February 12, 2026

**The Pet & Survival Update**

The ECS principle that components must be pure serializable data was being violated in four places. Functions were stored directly as component data. This is exactly wrong. It has been corrected. The fact that it worked at all was a coincidence.

**General**
- RNG centralized and salted where appropriate. Reproducibility is not optional.
- Hunger system centralized. All hunger lives in one place now.
- Application namespace corrected. Can still run headless. The architecture survived.

**Items**
- Basic Frost Wand added. The cold is here.
- Food hunger and survival system added. You can starve. This is intentional.
- Chest mechanics improved. Chests now open correctly.

**Pets**
- Kitty gifts now appear on visible, adjacent ground. Your cat's offerings are findable.
- Shared pet placement helper added. Spawning and teleporting a pet now use the same logic.

**Components**
- **Facing** component added. The system now knows which way you are walking away from something. This matters for future interactions.

**Bug Fixes**
- Snake bite fixed. It was not working correctly.
- Two failing tests fixed.
- FIXED: chests opening bug. Chests open when you open them now.

---

## February 11, 2026

**The Engravings & Pets Update**

You can now write on the floor. The messages are a bit rough. A cat has been added to the game. The cat has opinions.

**General**
- Basic engravings: you can carve messages into the dungeon floor.
- Basic pets added. A gift was given.
- Small tunings applied.

**Bug Fixes**
- Chests fixed. They were broken. They still needed more fixing in later patches.
- Kitty behavior tuned. Cats are hard.
- Debug overlay visibility removed.

---

## February 10, 2026

**The Deity Update**

The gods have arrived. They have opinions about what you do. They are watching.

**General**
- Deity system introduced. Early revision of shopkeeper and deity mechanics.
- Deity messages dialed down. The gods were sending too many messages.
- Kills are now offerings. Slaying creatures has metaphysical weight.

**Shops**
- Shopkeeper added. Their glyph has been adjusted. They have a look now.
- Loot tables adjusted. The economy is being calibrated.

**Bug Fixes**
- Small duplicate import fixed.
- Chest glyph corrected.
- Debug item pop removed from chest.

---

## February 9, 2026

**General**
- Equippable ammo type added. You can equip your arrows now, as you should be able to.
- `features/cc-dungeon-generator` merged into master.
- Weekend continued. The archive is being mined.

---

## February 8, 2026

**The Monsters Arrive**

Monsters have been added. They are basic. They exist. They will be improved.

**General**
- Basic monsters added to the world.
- Monster speed and scripts added. They can act independently now.
- `f` key casts the active spell. The key exists and works.
- Fully ported to `deno test --allow-read`. The test suite runs correctly.

**Monsters**
- Affix procs added. More affix procs added the same day. Monsters have traits that trigger.
- FIXED: Monsters could fight through open doors. They cannot anymore.

**Dungeon**
- Dungeon generator v2. The dungeons are more legitimate.

**Performance**
- Chunk load budget added. Things don't all load at once now.
- FOV re-introduced, based on `brain::vision`. It is performant.
- Multiple performance tuning passes. Numbers improved.

---

## February 7, 2026

**The Great Restoration**

> *"bye bye node, hello deno"*
> *"bye bye materials"* *(they'll be back)*

After a winter away, the project has returned. Node is gone. Deno is here. The 10 Commandments have been revised. The archive has been reopened. Everything is being brought back over with better architecture and sharper judgment.

**General**
- Migrated to Deno. This was the right call.
- Materials removed temporarily. They needed to be rebuilt from scratch.
- 10 Commandments reviewed and updated. The lessons of October and November have not been forgotten.
- Archive commits preserved. The history is intact.

**Restored from Archive**
- Combat system: melee and ranged.
- Spawners, intents, traps, and scheduler.
- Scripting system.
- Items, affixes, spells, validation, drink behavior, and equipment.
- Blastwave and meteor. They were missed. They are back.
- Gesture system, HUD, overlap detection, and feeds.

**UX**
- Overlay close-on-backdrop-tap.
- Pickup UX polished.

**Under the Hood**
- Local notes added to `.gitignore`. Some things are not for the repo.
- Dungeon gen fix applied.
- FOV, dungeon gen, and grid line-of-sight all restored.
- Tests fixed.

---

## November 15, 2025

**General**
- A news section was added to the site with a release update.

*Then the project went quiet for eighty-three days.*

---

## November 10–12, 2025

**The Multi-Floor Update**

**General**
- Analytic dungeon systems integrated into the rules layer.
- Demo scene rewritten to showcase the analytic multi-floor dungeon. Multiple floors are real.
- HUD improvements applied.

**Systems**
- Mana regeneration added to the scheduler. Mana regenerates over time now.
- Same-level portals added. You can teleport sideways.
- Effects stacking system added.
- Geometry kernel capsule fix applied. The geometry was wrong. It is now less wrong.

---

## November 6–9, 2025

**The Second Lighting Trap & Survival**

> *See Commandment II.*

November 6th was identified — in the TEN_COMMANDMENTS document written after the October incident — as the second time the project was nearly derailed by lighting work. The project survived. The analytic dungeon system was actually completed. The bow was added. The meteor gesture was fixed.

**Combat**
- Wooden bow and projectile added.
- Fire arrows added: normal and flaming, with ammo consumption.
- Blast wave added. Then added again with fixes.
- Early meteor added. Meteor gesture then fixed in the same session.
- Spike trap added. The floor is dangerous now.
- Quick-use system added (early). Twice.

**Dungeon**
- Demo scene expanded to three wings. The dungeon has wings now.
- Hallway radius reduced to 1. Corridors are tight and claustrophobic, as intended.
- Door added to demo room.

**Movement**
- Mobile tap movement biased toward cardinals. Tapping slightly diagonal now goes straight.
- Capsule stroke extended to reach the pointer release point.

**Lighting (the unavoidable)**
- Emissive torch lighting added.
- Player FOV tightened and flattened.

**UX**
- Ground pickup tooltip now shown within reach.
- Wall sliding improved.

**Under the Hood**
- Analytic dungeon kernel introduced and then integrated into the rules layer.
- ScriptRef refactor: all rules scripting now uses a shared ScriptRef. This is the right design.
- `main.js` refactored into modular helpers.
- World-carving experimental tool added. `fx-tool` renamed.
- Multiple codex PRs merged.

---

## November 1–4, 2025

**The Disciplined Rebuild**

The October experiment ended with a reset. A new codebase began on November 1st. This time with tests. This time one system at a time. The Ten Commandments were being applied even before they were written down.

**General**
- Actions, ActionManager, and intent wiring all rebuilt and connected.
- Item pickup and drop covered by tests before the systems were finalized.
- Effects system added with tests.
- Creatures added.
- World-view restored.

**Items**
- Equipment, ScriptRef, Affixes, and Loaders all wired together.
- Auto-pickup v0.1 added. Items come to you.
- Auto-pickup expanded with tests, gold handling, and move system integration.
- Double-tap to pick up. A more deliberate gesture.
- Pickup chooser added. When there are several items, you choose.

**Combat**
- Monsters now pick up items. Watch your loot.
- Affixes displayed in HUD. You can see what's on your gear.
- Thorns proc tuned. The damage that comes back at attackers is now calibrated.

**Performance**
- Multiple tuning passes. The numbers went up.
- Smooth input handling added.

---

## October 28, 2025

**The Great Reset**

> *"project reset, key concepts retained offline"*

159 files changed. 12,924 lines deleted. The TEN_COMMANDMENTS.md was written and committed in the same push.

The reset happened because of what occurred on October 23rd and again on October 25th: the project was consumed by lighting work, rendering work, and geometry engine work — none of which made the game more fun to play. The commit messages degraded to single letters. ("a", "a", "a", "a" — six times on October 25th alone.) This is explicitly documented in Commandment VI as the warning sign. The project recognized the sign too late.

The key concepts were retained offline. The project would return. Better.

---

## October 25, 2025

**The Incident**

The dungeon generator appeared, iterated through versions 0 through 5 in a single afternoon, and was then buried under thirty other things in the same session. Fog of war. Combat basics. A target dummy. Hallucination mode (added and immediately disabled on start — it was too much). Float text with motion presets. Torches. Mobile scaling. Pixelated rendering mode. Walls that stop you from walking through them.

Six commit messages in this session were the letter "a." Commandment VI was being violated in real time.

**Dungeon**
- Dungeon generator: 0, 1, 2, 3, 4, 5-tor. Generated in sequence. Each one better than the last. Six iterations in one afternoon.
- Fog of war added. You cannot see the whole dungeon at once.
- Doors added (early). ECS backport for doors.
- FOV toggle added. The ability to turn it off was added before the ability to use it properly.

**Combat**
- Combat basics: you can hit things. Things take damage. Numbers appear.
- Target dummy added for testing. It stands there and accepts damage professionally.
- Float text added with motion presets. Damage numbers rise, fade, and disappear correctly.

**Lighting**
- Torch archetype added. Emitter and emitter system wired.
- Flickering improved. ("improving flicker" — a sentence that should never have been written but was)
- Lights interact with walls.
- Darkening applied at distance.
- No light far away. As nature intended.

**World**
- Hallucination mode added. Disabled on start. It was not ready for players.
- Mobile device scaling.
- Pixelated rendering mode.
- Walls now prevent walking through them. This was not always the case.

---

## October 22–24, 2025

**The Lighting Trap, Phase One**

> *See Commandment II.*

The camera worked. Movement worked. Gold was being picked up and immediately replaced by more gold spawning elsewhere — a "dumb nightly delight" that made the developer laugh and commit it anyway.

Then the lighting started.

By October 23rd, the commit messages were: "lighting early," "shadows," "smooth lighting," "smoothing," "tightening radial FOV," "item shad opposite source," "light-grid-update," "wall-wall."

By October 24th, there were two commits called "night-night." The lighting was consuming the nights.

No gameplay was added during these two days. The lighting looked good. The player could not do anything new.

**Movement**
- Orthogonal movement added.
- Camera alignment corrected. It was looking at the wrong place.
- Grid shift and coordinate system corrected.
- Walking through walls fixed. You were going through walls. You should not go through walls.

**Lighting (it begins)**
- Smooth lighting implemented.
- Shadows added.
- Item shadows rendered opposite the light source.
- Radial FOV tightened.
- Performance tweaks applied across multiple passes.

**Systems**
- Event bus integrated. Systems now talk to each other through the bus.
- Gold pickup: when gold is picked up, another gold spawns at a random location. This is dumb. It was a delight.

---

## October 20–21, 2025

**The ECS Rebuild Begins in Earnest**

The new architecture is being constructed from the ground up. Player component, data scaffolding, archetypes. The `Explorer`, `Threat`, `WorldAnchor`, and `Ephemeral` archetypes are defined. Projectile and lifetime systems are wired in.

**General**
- Player component defined.
- Data scaffolding added.
- Core and data modules established.
- D-pad tried. Not loved. Removed.
- Early systems: input, movement, dungeon, gold.

**Archetypes**
- Explorer, Threat, WorldAnchor, Ephemeral archetypes added.
- Projectile system added.
- Lifetime system added.

**Math**
- Bresenham line algorithm added. Needed for line of sight. Got it early.

---

## October 17–18, 2025

**The Architecture Pivot**

The project started as a single HTML file containing everything. Three thousand lines of JavaScript in `index.html`. It worked. It was not maintainable.

On October 17th at 12:48pm, the developer committed "moving to modular arch + ecs." The entire contents of `index.html` was moved to `reference-implementation.html` for safekeeping, and a new modular structure was laid out from scratch: `src/ecs/core.js`, `src/ecs/archetype.js`, `src/ecs/hierarchy.js`, `src/ecs/serialization.js`. A new clean `src/main.js` at 107 lines.

The original 3,000-line monolith became a reference document. The new architecture had a fighting chance.

**General**
- Moved to modular architecture with ECS.
- Reference implementation preserved. The old way is on record.
- ECS architecture established: core, archetype, hierarchy, serialization.
- ECS demo written and cleaned up.
- Reference materials added.
- Math utilities and configuration extracted.

---

## October 15, 2025

**The Beginning**

> *"This is JavaScript the way it was meant to be: hackable, transparent, and fun."*

The first commit contains more than most projects ship in a month. It arrived already assembled: a roguelike with an overworld, fog of war (kind of), stairs that go somewhere, an inventory, auto-pickup, game-over tombstones saved to localStorage, classic dungeon features — fountains, altars, thrones, sinks, graves — perlin noise terrain with mountains and water, gold, rings, a shield, glyphs, glyph updates, and lightning that renders as canvas glow lines instead of ASCII characters.

The README was also written. The `.gitignore` was added. The favicon is an SVG. The game takes a breath and you open the page and it's just there.

**Everything, Initial Release**
- Project initialized.
- Roguelike dungeon with multiple floors via stairs.
- Overworld with Perlin noise terrain: grass shading, water, mountain clusters.
- Fog of war: tiles are visible, remembered, or unknown.
- Item auto-pickup toggle (F2, persisted to localStorage).
- Game-over overlay and tombstone recording.
- Classic dungeon features: fountain, altar, throne, grave, sink — all with basic interactions.
- Gold, rings, one shield. Equipment exists.
- Glyphs drawn on a canvas instead of in a terminal. Then updated. Then updated again.
- Lightning rendered as canvas glow lines with endpoint sparks. Not ASCII.
- `'.'` to wait. The player may now consciously do nothing.
- Stairs hint shown when standing on stairs. ("Press Enter or Down to descend.")
- Inline SVG favicon. The browser tab has an icon.
- README written and organized. The project has a public face.
