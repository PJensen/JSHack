import { getAllMonsters, addGenocide } from "../data/monsters.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Faction } from "../components/Faction.js";
import { Vitality } from "../components/Vitality.js";
import { MonsterSpawner } from "../components/MonsterSpawner.js";
import { Position } from "../components/Position.js";
import { dealDamage } from "../utils/dealDamage.js";

const GENOCIDE_LISTENER_INSTALLED = Symbol.for("jshack:genocide:listener:installed");

function editDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

function resolveGenocideTarget(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return null;

  let best = null;
  let bestScore = Infinity;
  for (const monster of getAllMonsters()) {
    if (String(monster.id || "").toLowerCase() === normalized) return monster;
    const name = monster.name.toLowerCase();
    if (name === normalized) {
      best = monster;
      bestScore = 0;
      break;
    }
    const score = name.startsWith(normalized) ? 1
      : name.includes(normalized) ? 2
      : normalized.startsWith(name) ? 3
      : editDistance(normalized, name);
    if (score < bestScore) {
      bestScore = score;
      best = monster;
    }
  }

  return bestScore > 4 ? null : best;
}

export function installGenocideListener(world) {
  if (!world || world[GENOCIDE_LISTENER_INSTALLED]) return;
  world[GENOCIDE_LISTENER_INSTALLED] = true;

  world.on("scroll:genocide:request", ({ actor, query }) => {
    const best = resolveGenocideTarget(query);
    if (!best) {
      world.emit?.("message", { text: "The scroll burns, but nothing happens.", type: "system" });
      return;
    }

    addGenocide(best.id);

    let killed = 0;

    for (const [id, ident, faction, vit, pos] of world.query(NamedIdentity, Faction, Vitality, Position)) {
      if (!ident || ident.identity !== best.id) continue;
      if (!faction || faction.key !== "enemy") continue;
      if (!vit || vit.hp <= 0) continue;
      const result = dealDamage(world, {
        source: actor | 0,
        target: id,
        amount: Math.max(9999, Number(vit.hp || 0) | 0),
        type: "genocide",
        cause: "genocide",
        critical: true,
        at: { x: pos.x | 0, y: pos.y | 0 },
        bypassInvuln: true,
        bypassResist: true,
        noTrigger: true,
      });
      if (result.killed || result.applied) killed++;
    }

    for (const [id, spawner] of world.query(MonsterSpawner)) {
      if (spawner?.spawnParams?.identity !== best.id) continue;
      world.mutate(id, MonsterSpawner, (record) => { record.isActive = false; });
    }

    world.emit?.("message", {
      text: `You have genocided all ${best.name}s! ${killed > 0 ? `${killed} perish${killed === 1 ? "es" : ""} instantly.` : ""}`,
      type: "system",
    });
    const actorPos = actor ? world.get(actor | 0, Position) : null;
    world.emit?.("scroll:genocide:success", {
      actor: actor | 0,
      identity: best.id,
      name: best.name,
      killed,
      at: actorPos ? { x: actorPos.x | 0, y: actorPos.y | 0 } : null,
    });
  });
}
