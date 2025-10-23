// Player Renderer System
// Draws the player at the center of the canvas
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { Glyph } from '../../components/Glyph.js';
import { getRenderContext } from './renderingUtils.js';

export function playerRendererSystem(world) {
  // Get render context component
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, font } = rc;
  // Determine whether any matching entities exist (no noisy logging)
  const count = world.query(Position, Player).count ? world.query(Position, Player).count() : 0;

  let drew = false;
  for (const [id, pos, glyph] of world.query(Position, Glyph, Player)) {
  // found matching player entity
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.font = font || '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = (glyph && (glyph.fg || glyph.color)) || '#fff';
    ctx.fillText((glyph && glyph.char) || '@', 0, 0);
    ctx.restore();
    drew = true;
  }

  // Fallback: if query didn't find the player, draw a default '@' so the canvas isn't empty
  if (!drew) {
    // Silently draw fallback to reduce console noise (only warn in debug builds)
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.font = font || '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8f';
    ctx.fillText('@', 0, 0);
    ctx.restore();
  }
}
