// Item Renderer System
// Responsible for rendering items on the map
// Assumes existence of item, position, and visibility components

import { getRenderContext } from './renderingUtils.js';
import { Position } from '../../components/Position.js';
import { Glyph } from '../../components/Glyph.js';
import { Gold } from '../../components/Gold.js';
import { Player } from '../../components/Player.js';

export function renderItemsSystem(world) {
    const rc = getRenderContext(world);
    if (!rc) return;
    const { ctx, W, H, cellW, cellH, font } = rc;
    
    // Get player position to use as camera center
    let playerX = 0, playerY = 0;
    for (const [id, pos] of world.query(Position, Player)) {
        playerX = pos.x;
        playerY = pos.y;
        break; // use first player
    }
    
    ctx.save();
    ctx.font = font || '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Render all entities with Gold + Position + Glyph
    for (const [id, pos, glyph, gold] of world.query(Position, Glyph, Gold)) {
        // Calculate screen position relative to centered player
        const dx = pos.x - playerX;
        const dy = pos.y - playerY;
        const screenX = W / 2 + dx * cellW;
        const screenY = H / 2 + dy * cellH;
        
        ctx.fillStyle = glyph.fg || glyph.color || '#ffd700';
        ctx.fillText(glyph.char || '$', screenX, screenY);
    }
    
    ctx.restore();
}
