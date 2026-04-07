import { Faction } from "../components/Faction.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { PetState } from "../components/PetState.js";
import { AggroState } from "../components/AggroState.js";
import { Vitality } from "../components/Vitality.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { playerEntity } from "../utils/queries.js";
import { getMonster } from "../data/monsters.js";

const TAMING_LISTENER_INSTALLED = Symbol.for("jshack:taming:listener:installed");

/**
 * Install a one-time listener for scroll:taming:apply events.
 * Converts a target enemy entity into a pet in-place.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installTamingListener(world) {
  if (!world || world[TAMING_LISTENER_INSTALLED]) return;
  world[TAMING_LISTENER_INSTALLED] = true;

  world.on("scroll:taming:apply", ({ actor, target }) => {
    const targetId = Number(target || 0) | 0;
    const actorId = Number(actor || 0) | 0;
    if (!(targetId > 0) || !(actorId > 0)) return;

    // Target must be alive and an enemy
    const fac = world.get(targetId, Faction);
    if (!fac || fac.key !== "enemy") {
      world.emit?.("message", { text: "That creature cannot be tamed.", type: "system" });
      return;
    }
    const vit = world.get(targetId, Vitality);
    if (!vit || vit.hp <= 0) return;

    // Convert faction
    world.mutate(targetId, Faction, r => { r.key = "pet"; });

    // Add pet components
    try { world.add(targetId, Pet); } catch {}
    try { world.add(targetId, Owner, { ownerId: actorId }); } catch {}

    const _pe = playerEntity(world);
    const px = _pe ? _pe.pos.x | 0 : 0;
    const py = _pe ? _pe.pos.y | 0 : 0;
    try {
      world.add(targetId, PetState, {
        state: "following",
        targetX: null,
        targetY: null,
        targetItemId: 0,
        stateEnteredTurn: world.step || 0,
        lastPlayerX: px,
        lastPlayerY: py,
        commandCooldown: 0,
        rangedCooldown: 0,
      });
    } catch {}

    // Remove enemy AI state so aiChaseSystem stops processing this entity
    try { world.remove(targetId, AggroState); } catch {}

    // Resolve creature name for the message
    const ni = world.get(targetId, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    const name = def?.name || ni?.name || "creature";

    world.emit?.("message", {
      text: `The ${name} gazes at you with newfound loyalty!`,
      type: "system",
    });

    const pos = world.get(targetId, Position);
    if (pos) {
      world.emit?.("scroll:taming:vfx", {
        id: targetId,
        x: pos.x | 0,
        y: pos.y | 0,
      });
    }
  });
}
