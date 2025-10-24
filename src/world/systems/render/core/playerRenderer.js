// Player Render System
// Draws the player at the center of the canvas
// READONLY: performs no mutations — only reads world state and draws to canvas
import { Position } from '../../../components/Position.js';
import { Player } from '../../../components/Player.js';
import { Glyph } from '../../../components/Glyph.js';
import { getRenderContext } from '../utils.js';

export function playerRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, font } = rc;

  // Intentionally minimal for bring-up; actual drawing is handled in other passes
  // Uncomment to draw player's glyph centered
  // for (const [id, pos, glyph] of world.query(Position, Glyph, Player)) {
  //   ctx.save();
  //   ctx.translate(W / 2, H / 2);
  //   ctx.font = font || '18px monospace';
  //   ctx.textAlign = 'center';
  //   ctx.textBaseline = 'middle';
  //   ctx.fillStyle = (glyph && (glyph.fg || glyph.color)) || '#fff';
  //   ctx.fillText((glyph && glyph.char) || '@', 0, 0);
  //   ctx.restore();
  //   return;
  // }
}
