# TODO

Start porting features from `implementation.html` into folder structure.

```
/public
  index.html                 # <canvas id="term">, HUD spans, loads /src/main.js

/src
  main.js                    # bootstraps Game, binds DOM, starts loop
  config.js                  # constants (GL/COLS/ROWS, CELL_W/H, FOV, BASE_W/H, room params)
  util/
    rng.js                   # mulberry32(seed) and seed utils
    math.js                  # clamp, lerp, rand helpers
    bresenham.js             # bresenhamLine(), hasLine()
    priority-queue.js        # tiny PQ if you want to speed up A*
    events.js                # emitEvent(), event bus for affixes/status hooks
  core/
    tile.js                  # Tile
    entity.js                # Entity (stats, equipment slots)
    item.js                  # Item (uid, kind, slot, bonuses, affixes)
    message-log.js           # ring buffer (push, recent)
  data/
    glyphs.js                # GL { PLAYER, POTION, SCROLL, ... }
    items.js                 # ITEM_DEFS
    equipment.js             # EQUIP_DEFS
    affixes.js               # AFFIX_DEFS and trigger names
    monsters.js              # MONSTER_DEFS
    status.js                # STATUS_DEFS (if/when you add them)
  map/
    map.js                   # grid, inBounds, isWalkable, blocksLight
    gen.js                   # rooms, corridors, up/down stairs placement
    fov.js                   # computeFOV(mask/keys reuse)
    pathfinding.js           # aStarNextStep(), aStarFullPath()
    dungeon.js               # Dungeon + Level (rng, items/monsters on level enter)
    spawners.js              # spawnMonsters(), spawnItems(), spawnEquipment()
  systems/
    combat.js                # melee(), crits, damage, onHit/onDamaged/onKill events
    ai.js                    # monster AI, pursue/wander, path cache, greedy LOS
    inventory.js             # add/pickup/drop/equip/use; derived stat recompute
    derived.js               # recalcDerived(entity) incl. equipment+affixes
    spells.js                # spell list + cast() registry
    status.js                # tick/apply/remove status effects
  render/
    renderer.js              # cell drawing, camera, world pass
    hud.js                   # HP/mana/depth HUD, debug panel
    overlays.js              # messages panel, inventory modal, damage floaters, lightning/ripples

  orchestration.js                    # Game class: input→simulate→render orchestration
```

## UX-TODO

# JS-Hack Mobile UX — TODO List for Implementation Agent

## Core Tasks

- [ ] Implement a touch-first mobile UI layer for JS-Hack  
- [ ] Render a floating D-pad and action buttons on mobile  
- [ ] Add swipe, press, and tap gestures that map to existing keyboard input  
- [ ] Create three overlays: Inventory, Spell Picker, and Combat Log  
- [ ] Set window title to the dungeon level + character name + other details (always visible)  
- [ ] Ensure the entire system runs as a single self-contained HTML file with no dependencies  

---

## Constraints

- [ ] Maintain the One-Shot / Zero-Stack philosophy  
- [ ] Use only native HTML, CSS, and JavaScript (no frameworks, no build tools)  
- [ ] Keep the code hackable and readable by inspection  
- [ ] Ensure all UX features execute instantly upon file open  
- [ ] Use composable functions, not class hierarchies  
- [ ] Avoid nondeterministic timers or race conditions  

---

## Deliverables

- [ ] js-hack-mobile-ui.html (single-file build)  
  - [ ] Includes canvas, HUD, floating touch controls, overlays, and title updater  
  - [ ] Gesture system and keyboard synthesis layer inside <script type="module">  
- [ ] README-Mobile-UX.md with usage instructions and developer toggles  

---

## UI Structure

- [ ] Canvas: #stage  
- [ ] HUD: #hud with #hpFill, #hpLabel, #mpFill, #mpLabel  
- [ ] Touch controls: #touch-ui, #dpad, #actions  
- [ ] Overlays: #invOverlay, #spellOverlay, #logOverlay  
- [ ] Toast message element: #toast  
- [ ] Title display: #titleBar (mirrors document.title)  

---

## Gesture System

- [ ] Swipe Up → Open Inventory (openInventory() or #invOverlay fallback)  
- [ ] Swipe Down → Open Spell List (openSpellList() or #spellOverlay fallback)  
- [ ] Swipe Right → Open Combat Log (openLog() or #logOverlay fallback)  
- [ ] Long-Press → Open Quick-Select Radial Menu (stub if needed)  
- [ ] Double-Tap Player Tile → Descend Stairs (descendIfPossible() or Enter fallback)  
- [ ] Tap HP Bar → Use Healing Item (useHealingItem())  
- [ ] Tap Mana Bar → Auto-Cast Current Spell (autoCastCurrentSpell())  
- [ ] Add haptic feedback to all meaningful gestures  
- [ ] Display toast messages confirming each gesture  
- [ ] Tune thresholds for mobile usability  

---

## Game Hook Stubs

- [ ] openInventory()  
- [ ] openSpellList()  
- [ ] openLog()  
- [ ] closeOverlays()  
- [ ] useHealingItem()  
- [ ] autoCastCurrentSpell()  
- [ ] descendIfPossible()  
- [ ] currentDungeonLevel()  
- [ ] currentCharacterName()  
- [ ] onSpellChange(dir)  

All stubs should safely no-op if game logic is missing and show a toast message like “Not implemented”.

---

## HUD and Title Behavior

- [ ] Keep HUD bars clickable for quick actions  
- [ ] Pulse animation on HP or Mana change  
- [ ] Update document.title continuously to reflect:  
  “JS-Hack — L{dungeon level} — {character name} — HP/Mana status”  
- [ ] Ensure the window title updates on every state change  

---

## Overlays

- [ ] Implement Inventory Overlay (#invOverlay)  
- [ ] Implement Spell Picker Overlay (#spellOverlay)  
- [ ] Implement Combat Log Overlay (#logOverlay)  
- [ ] Add smooth fade-in/out transitions  
- [ ] Close overlays with ✕ button, Esc, or backdrop tap  

---

## Floating Controls

- [ ] D-pad (3×3 grid with central wait button “•”)  
- [ ] Action buttons (Cast, Inventory, Log, Descend, Spell▶)  
- [ ] Auto-hide after 1.6 seconds of inactivity  
- [ ] Show only for touch devices via media queries  

---

## Toast System

- [ ] Add bottom-center #toast element  
- [ ] Implement toast(msg, ms=700) function  
- [ ] Auto-fade messages; support multiple quick updates  

---

## Haptics

- [ ] Use navigator.vibrate(12) for supported devices  
- [ ] Trigger on cast, pickup, heal, or UI confirmation  

---

## Title Updater

- [ ] Poll every 500ms or subscribe to game events  
- [ ] Always include dungeon level + character name  
- [ ] Include optional details such as HP and Mana  

---

## Testing & Validation

- [ ] Test on Android Chrome, Firefox Android, and iOS Safari  
- [ ] Confirm gesture accuracy across devices  
- [ ] Validate landscape and portrait layout  
- [ ] Ensure all overlays close correctly  
- [ ] Ensure no console errors or warnings  
- [ ] Verify that document.title always reflects game state  
- [ ] Validate haptics work on mobile and do nothing on desktop  

---

## Accessibility

- [ ] Provide aria-labels for all buttons  
- [ ] Use role="dialog" for overlays  
- [ ] Maintain 4.5:1 text contrast minimum  
- [ ] Support keyboard fallback for all features  

---

## Final Integration Checklist

- [ ] DOM structure complete and IDs match spec  
- [ ] CSS responsive and mobile-first  
- [ ] Gesture detection smooth and responsive  
- [ ] All overlays functional  
- [ ] Title updates dynamically  
- [ ] Toasts display and fade correctly  
- [ ] Haptics optional but functional  
- [ ] Fully offline-capable  
- [ ] Single-file artifact verified  

---

## Execution Principle

Deliver a minimal, working mobile UX layer first.  
All hooks, overlays, and gestures must be stub-friendly.  
The system must require no refactor to integrate with the main ECS game logic later.  
Keep the artifact readable, deterministic, and runnable in a clean browser with no build steps.

