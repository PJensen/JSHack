# 📱 JS-Hack — Mobile UX To-Do List

> **Goal:** Integrate full touch and gesture system into the unified mobile interface while keeping the *One-Shot / Zero-Stack* philosophy intact.  
> Everything must run offline, in a single HTML file, using only `<script type="module">`.

---

- [ ] Game and Inventory tabs
- [ ] Top HUD with HP / Mana bars
- [ ] Canvas viewport (centered, pixel-perfect)
- [ ] Bottom thumb controls (D-Pad + Action Buttons)

## 🎯 Core Gesture System

- [ ] Floating D-Pad (with hold-to-move repeat)
- [ ] Floating Action Ring (Cast / Inventory / Log / Descend)
- [ ] Basic swipe up / down / right detection
- [ ] Double-tap to descend (sends `Enter`)
- [ ] Haptics on touch (vibration feedback)
- [ ] Auto-hide UI when idle
- [ ] Dispatches real keyboard events to existing game handler

### 🚧 Features
- [ ] Swipe Up → Open Inventory
- [ ] Swipe Down → Open Spell List
- [ ] Swipe Right → Open Combat Log
- [ ] Long-Press (anywhere) → Quick-Select Radial Menu
- [ ] Double-Tap Player Tile → Descend Stairs / Confirm Action
- [ ] Tap HP Bar → Use Healing Item (if available)
- [ ] Tap Mana Bar → Auto-Cast Current Spell
- [ ] Add gentle haptic feedback for item use, spell cast, and level transition
- [ ] Fade-in toast messages for gesture triggers (Inventory, Log, etc.)
- [ ] Gesture cooldown / threshold tuning for smoother mobile use
- [ ] Add Spell Picker Overlay (pop-up list with active highlight)
- [ ] Add Combat Log Overlay (scrollable sheet)
- [ ] Add Radial Quick-Select Menu (spells and items)
- [ ] Add Cinematic Mode toggle (hide HUD for screenshots)
- [ ] Make HUD bars semi-transparent with blur background
- [ ] Make D-Pad and Action Ring circular and adaptive to screen size
- [ ] Re-flow layout for portrait and landscape
- [ ] Auto-scale canvas resolution with device pixel ratio

---

## ⚙️ System Hooks

### Required Game Hooks
- [ ] `useHealingItem()` — consumes potion or healing scroll
- [ ] `autoCastCurrentSpell()` — auto-casts current spell
- [ ] `openInventory()`, `openLog()`, `openSpellList()` — link to panels
- [ ] `descendIfPossible()` — check if player on stairs
- [ ] `openRadialMenu()` — stub for quick menu

### Optional Enhancements
- [ ] `navigator.vibrate()` feedback for key actions
- [ ] Idle timeout for hiding HUD (configurable)
- [ ] Persistent `localStorage` flag for “mobile UI enabled”

---

## 💅 Polish and Feel
- [ ] Smooth transitions between tabs (fade or slide)
- [ ] Small pulse on HP/Mana change (damage / heal / gain)
- [ ] Subtle particles (mana sparks, damage droplets)
- [ ] Responsive scaling on D-Pad / buttons
- [ ] Optional theme toggle (dark vs blue hue)

---

## 🧩 Debug and QA
- [ ] Touch debug overlay (coordinates + gesture type)
- [ ] Grid overlay toggle for tile hitboxes
- [ ] Gesture replay mode for developer testing
- [ ] Verify double-tap / long-press on iOS Safari
- [ ] Test haptics on Android Chrome
- [ ] Ensure no default browser gestures (zoom / swipe back)

---

## 🧠 Stretch Goals
- [ ] Pinch-to-Zoom on canvas (adjust viewport)
- [ ] Two-finger tap → toggle HUD visibility
- [ ] Contextual button glow (highlight Descend when stairs visible)
- [ ] Audio cue on spell cast success
- [ ] Persistent “Saved” indicator (💾 bubble)

---

**Philosophy Reminder**  
> No frameworks. No build. Everything runs offline.  
> One file = one idea.  
> Keep it hackable, beautiful, and deterministic.
