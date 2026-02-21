// src/main/debug/sceneControls.js
// Zoom +/-, camera debug (stair jump), shake test, delete-save hotkey.

import { zoomTo, jumpTo, easeTo } from "../../display/camera/utils.js";
import { startShake } from "../../display/camera/shake.js";
import { hasSavegame, clearSavegamePayload } from "../wiring/savegameLoad.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { Position } from "../../rules/components/Position.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";

const _installed = Symbol.for('sceneControls');

/**
 * Install keyboard-driven scene debug controls (zoom, camera, shake, save-delete).
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, TILE_PX: number, messageLog: { log(msg: object): void }, runtimeConfig: { debug?: boolean } }} deps
 */
export function installSceneControls({ world, cam, TILE_PX, messageLog, runtimeConfig }) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;

  addEventListener("keydown", (e) => {
    const { key, code } = e;
    const deleteSaveHotkey = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (code === "Backspace" || key === "Backspace");
    const zoomIn  = key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
    const zoomOut = key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract";

    if (deleteSaveHotkey) {
      const hadSave = hasSavegame();
      clearSavegamePayload();
      messageLog.log({
        text: hadSave
          ? "Save game deleted. (Ctrl+Shift+Backspace)"
          : "No save game found to delete.",
        type: "system",
      });
      e.preventDefault();
      return;
    }

    if (zoomIn)  { zoomTo(cam, Math.min(TILE_PX * 4.0, cam.targetScale * 1.2)); e.preventDefault(); return; }
    if (zoomOut) { zoomTo(cam, Math.max(TILE_PX * 0.5, cam.targetScale / 1.2)); e.preventDefault(); return; }
    if (key === "0") { jumpTo(cam, { x: 0, y: 0 }); zoomTo(cam, TILE_PX); e.preventDefault(); return; }
    if (key === "9") {
      // Debug: toggle camera between nearest down-stair and player
      if (cam._detached) {
        cam._detached = false;
        if (runtimeConfig.debug) console.log('[DEBUG] Camera re-attached to player');
      } else {
        let best = null, bestDist = Infinity;
        const pp = playerEntity(world);
        const px = pp ? world.get(pp.id, Position)?.x ?? 0 : 0;
        const py = pp ? world.get(pp.id, Position)?.y ?? 0 : 0;
        for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
          if (ni.identity === 'stair_down') {
            const d = Math.abs(pos.x - px) + Math.abs(pos.y - py);
            if (d < bestDist) { bestDist = d; best = pos; }
          }
        }
        if (best) {
          cam._detached = true;
          if (runtimeConfig.debug) console.log(`[DEBUG] Easing to stair_down at (${best.x}, ${best.y})`);
          easeTo(cam, { x: best.x, y: best.y, dur: 0.8 });
        } else {
          if (runtimeConfig.debug) console.warn('[DEBUG] No stair_down entity found on this floor!');
        }
      }
      e.preventDefault(); return;
    }
    if ((key || "").toLowerCase() === "x") { startShake(cam, 6, 0.35); e.preventDefault(); return; }
  });
}
