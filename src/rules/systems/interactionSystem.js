// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { Position } from "../components/Position.js";
import { Facing } from "../components/Facing.js";
import { Dungeon } from "../components/Dungeon.js";

const MIN_DUNGEON_DEPTH = 1;
const MAX_DUNGEON_DEPTH = 99;

function normalizeVec(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) return null;
    return { x: dx / len, y: dy / len };
}

// One-off helper invoked by the per-tick interactionSystem below
export function InteractionSystem(world, actor, targetId) {
    const inter = world.get(targetId, Interactable);
    if (!inter) return false;

    switch (inter.action) {
        case "toggleDoor":
            {
                // Toggle DoorState and update Collider.solid/blocksSight accordingly
                const ds = world.get(targetId, DoorState);
                if (ds?.locked) {
                    world.emit?.("interaction", { actor, targetId, action: "toggleDoor", result: "locked" });
                    break;
                }
                const nowOpen = !(ds?.open);
                if (ds) world.set(targetId, DoorState, { open: nowOpen });
                const col = world.get(targetId, Collider);
                if (col) world.set(targetId, Collider, { solid: !nowOpen, blocksSight: !nowOpen });
                world.emit?.("interaction", { actor, targetId, action: "toggleDoor", result: nowOpen ? "opened" : "closed" });
            }
            break;

        case "useStairs":
            {
                const params = inter.params || {};
                const linkId = Number(params.targetId) || 0;
                if (!linkId) break;
                const destPos = world.get(linkId, Position);
                const actorPos = world.get(actor, Position);
                if (!destPos || !actorPos) break;
                const arrival = params.arrivalOffset || {};
                const offsetX = Number(arrival.x) || 0;
                const offsetY = Number(arrival.y) || 0;
                const targetX = destPos.x + offsetX;
                const targetY = destPos.y + offsetY;
                const from = { x: actorPos.x, y: actorPos.y };
                world.set(actor, Position, { x: targetX, y: targetY });
                if (params.faceAway !== false) {
                    const face = normalizeVec(targetX - destPos.x, targetY - destPos.y);
                    if (face) {
                        if (world.has(actor, Facing)) world.set(actor, Facing, face);
                        else {
                            try { world.add(actor, Facing, face); } catch { }
                        }
                    }
                }
                applyDungeonLevelChange(world, params);
                world.emit?.("moved", { id: actor, from, to: { x: targetX, y: targetY }, via: "stairs" });
                world.emit?.("interaction", {
                    actor,
                    targetId,
                    action: "useStairs",
                    result: {
                        direction: params.direction || "travel",
                        to: { x: targetX, y: targetY },
                        linkId,
                    }
                });
            }
            break;

        case "openChest":
            world.emit("interaction", { actor, targetId, action: "openChest", loot: inter.params?.lootTable });
            break;

        case "readText":
            world.emit("interaction", { actor, targetId, action: "readText", textId: inter.params?.textId });
            break;
    }
    return true;
}

// Per-tick system: consumes InteractIntent and dispatches to InteractionSystem
export function interactionSystem(world) {
    for (const [actor, intent] of world.query(InteractIntent)) {
        try { InteractionSystem(world, actor, intent.targetId || 0); } catch {}
        try { world.remove(actor, InteractIntent); } catch {}
    }
}

function applyDungeonLevelChange(world, params) {
    const dungeonInfo = getDungeonRecord(world);
    if (!dungeonInfo) return;
    const { id, rec } = dungeonInfo;
    const current = Number(rec.level) || MIN_DUNGEON_DEPTH;
    const targetDepth = Number(params.targetDepth);
    const delta = Number(params.depthDelta);
    let next = current;
    if (Number.isFinite(targetDepth) && targetDepth >= MIN_DUNGEON_DEPTH) {
        next = targetDepth;
    } else if (Number.isFinite(delta) && delta !== 0) {
        next = current + delta;
    }
    next = Math.max(MIN_DUNGEON_DEPTH, Math.min(MAX_DUNGEON_DEPTH, next));
    if (next === current) return;
    try {
        world.mutate(id, Dungeon, (r) => { r.level = next; });
    } catch {
        world.set(id, Dungeon, { level: next, id: rec?.id ?? null, name: rec?.name ?? "" });
    }
    world.emit?.("dungeon:levelChanged", { level: next, previous: current });
}

function getDungeonRecord(world) {
    for (const [id, rec] of world.query(Dungeon)) {
        if (rec) return { id, rec };
    }
    return null;
}
