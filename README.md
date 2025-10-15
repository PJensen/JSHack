# JSHack

A lightweight, standalone web application for experimenting with JavaScript, HTML, and CSS—all in a single file.

## Project Overview
- **Single file:** All code lives in `js-hack.html` (markup, styles, and scripts).
- **No frameworks:** Pure HTML, CSS, and JavaScript. No React, Vue, Angular, or build tools.
- **No backend:** 100% client-side; just open the HTML file in your browser.
- **No dependencies:** No npm, package managers, or external scripts (unless you add CDN links).

## Features

- **Unicode Canvas Roguelike:** Play a classic roguelike rendered on an HTML5 canvas using Unicode glyphs for walls, floors, doors, stairs, and entities.
- **Procedural Dungeon Generation:** Each level is generated with rooms, corridors, doors, water, and traps using deterministic seeded randomization.
- **Player & Entities:** Move your character (`@`) through the dungeon, encountering monsters, items, and equipment.
- **Resource Bars:** Visual health and mana bars update in real time.
- **HUD & Debug Panel:** On-screen HUD displays controls, stats, and dungeon depth. Optional debug panel for advanced inspection.
- **Turn-Based Gameplay:** Navigate using keyboard controls; each action advances the game turn.
- **Inventory & Equipment:** Collect items, equip gear, and use consumables.
- **Stairs & Depth:** Descend deeper into the dungeon via stairs (`<`), with each floor offering new layouts and challenges.
- **No Dependencies:** Everything runs in a single HTML file—just open and play!

You can add a screenshot below this section to showcase the game in action.

## Getting Started
1. Clone the repository:
   ```powershell
   git clone https://github.com/PJensen/JSHack.git
   ```
2. Open `js-hack.html` in your favorite web browser.
3. Start hacking! Edit `js-hack.html` directly to add features, styles, or scripts.

## Developer Workflow
- **Edit:** Make changes directly in `js-hack.html`.
- **Test:** Refresh your browser to see updates instantly.
- **Debug:** Use browser developer tools (F12) for inspection and debugging.

## Conventions
- Use `<script>` and `<style>` tags inside the HTML file for all logic and styling.
- Keep features self-contained and easy to understand.
- Add external libraries only if absolutely necessary (via CDN in `<head>`).

## Example: Adding a Feature
```html
<!-- At the end of js-hack.html -->
<script>
  // Your new JavaScript code here
</script>
```

## License
MIT

---

Have fun hacking! If you add something cool, consider submitting a pull request or opening an issue to share your ideas.