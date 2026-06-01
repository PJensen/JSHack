import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { AttackDirectionIntent } from "../components/Intents/AttackDirectionIntent.js";
import { classifyAttackDirection } from "../utils/attackActionPolicy.js";

export function attackDirectionSystem(world) {
  for (const [actor, intent] of world.query(AttackDirectionIntent)) {
    const dx = Number(intent?.dx || 0) | 0;
    const dy = Number(intent?.dy || 0) | 0;
    const plan = classifyAttackDirection(world, { actorId: actor, dx, dy });
    try { world.remove(actor, AttackDirectionIntent); } catch {}

    if (!plan.ok) {
      world.emit("attack:direction-failed", { actor, dx, dy, reason: plan.reason, targetId: plan.targetId || 0 });
      if (plan.reason === "target_flying") {
        world.emit("combat:target-flying", { attacker: actor, target: plan.targetId | 0 });
      }
      continue;
    }

    if (plan.requiresConfirm && intent.confirmed !== true) {
      world.emit("attack:confirm-required", {
        actor,
        dx,
        dy,
        targetId: plan.targetId,
        message: plan.message,
        offense: plan.offense || null,
      });
      continue;
    }

    world.emit("combat:telegraph", {
      actor,
      target: plan.targetId,
      mode: "melee",
      turns: 0,
    });
    try { world.add(actor, AttackIntent, { targetId: plan.targetId, allowNonHostile: plan.requiresConfirm && intent.confirmed === true }); } catch {}
  }
}
