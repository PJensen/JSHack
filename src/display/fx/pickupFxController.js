// display/fx/pickupFxController.js
// "Loot suck" animation — picked-up items fly toward the player and shrink,
// like Diablo III pickup. Purely cosmetic; the item is already in inventory
// by the time this draws.

import { drawKindScaled } from "../passes/glyphs/atlas.js";

const PICKUP_SPEED = 16;          // tiles/sec
const MIN_DURATION = 0.10;
const MAX_DURATION = 0.24;
const SAME_TILE_DURATION = 0.14;  // quick pop for items already underfoot
const SAME_TILE_LIFT = -0.45;     // rise upward (negative Y)

function easeInCubic(t) { return t * t * t; }

/**
 * @param {{ world: object, resolveItemMeta: (id:number) => {identity:string}|null, getPosition: (id:number) => {x:number,y:number}|null }} deps
 */
export function createPickupFxController({ world, resolveItemMeta, getPosition }) {
  /** @type {Array<{ kind:string, fromX:number, fromY:number, toX:number, toY:number, t:number, duration:number, sameTile:boolean }>} */
  const _fx = [];

  function installListeners() {
    world.on('item:pickup', ({ actor, itemId, itemX, itemY }) => {
      if (itemX == null || itemY == null) return;

      // Destination = actor's current position
      const dest = getPosition(actor);
      if (!dest) return;

      const dx = dest.x - itemX;
      const dy = dest.y - itemY;
      const dist = Math.hypot(dx, dy);
      const sameTile = dist < 0.5;

      const duration = sameTile
        ? SAME_TILE_DURATION
        : Math.max(MIN_DURATION, Math.min(MAX_DURATION, dist / PICKUP_SPEED));

      // Resolve glyph kind while entity still alive (before potential stack merge)
      const meta = resolveItemMeta ? resolveItemMeta(itemId) : null;
      const kind = meta?.identity || "default";

      _fx.push({
        kind,
        fromX: itemX,
        fromY: itemY,
        toX: sameTile ? itemX : dest.x,
        toY: sameTile ? itemY + SAME_TILE_LIFT : dest.y,
        t: 0,
        duration,
        sameTile,
      });
    });
  }

  function tick(dt) {
    for (let i = _fx.length - 1; i >= 0; i--) {
      _fx[i].t += dt;
      if (_fx[i].t >= _fx[i].duration) _fx.splice(i, 1);
    }
  }

  function draw(ctx, worldView, glyphAtlas) {
    for (let i = 0; i < _fx.length; i++) {
      const rec = _fx[i];
      const t01 = Math.min(1, rec.t / rec.duration);
      const p = easeInCubic(t01); // accelerate toward destination

      const x = rec.fromX + (rec.toX - rec.fromX) * p;
      const y = rec.fromY + (rec.toY - rec.fromY) * p;

      // Shrink from full size to tiny as it arrives
      const scale = 1.0 - 0.7 * p;
      // Fade out toward the end
      const alpha = 1.0 - t01 * t01;

      ctx.save();
      ctx.globalAlpha = alpha;
      drawKindScaled(glyphAtlas, ctx, rec.kind, x, y, scale);
      ctx.restore();
    }
  }

  return { installListeners, tick, draw };
}
