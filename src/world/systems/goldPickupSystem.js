// Gold Pickup System
// Detects when the player stands on a tile with Gold and collects it
import { Position } from '../components/Position.js';
import { Player } from '../components/Player.js';
import { Gold } from '../components/Gold.js';

export function goldPickupSystem(world) {
  // Find the player and their position
  let playerId = null, playerPos = null, playerData = null;
  for (const [id, pos, player] of world.query(Position, Player)) {
    playerId = id; playerPos = pos; playerData = player; break;
  }
  if (!playerId || !playerPos) return;

  // Scan all gold entities; if any sit at the player's position, collect them
  for (const [gid, gpos, gold] of world.query(Position, Gold)) {
    // Ignore the player's own entity if it carries a Gold component
    if (gid === playerId) continue;
    if (gpos.x === playerPos.x && gpos.y === playerPos.y) {
      // Add to player's gold total
      const current = (playerData && typeof playerData.gold === 'number') ? playerData.gold : 0;
      const gained = (gold?.amount || 0);
      if (gained <= 0) { world.destroy(gid); continue; }
      world.set(playerId, Player, { gold: current + gained });
      try { console.log(`Picked up ${gained} gold. Total: ${current + gained}`); } catch(e){}

      // Emit an event so UI/effects listeners can respond (e.g., spawn float text)
      world.emit('gold:pickup', {
        entityId: playerId,
        amount: gained,
        x: playerPos.x,
        y: playerPos.y
      });

      // Remove the gold entity
      world.destroy(gid);
    }
  }
}
