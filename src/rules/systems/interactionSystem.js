// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { Position } from "../components/Position.js";
import { Facing } from "../components/Facing.js";
import { Dungeon } from "../components/Dungeon.js";
import { Player } from "../components/Player.js";
import { Brain } from "../components/Brain.js";
import { activateDungeonLevel } from "../environment/dungeonLevelManager.js";

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
                const actorPos = world.get(actor, Position);
                if (!actorPos) break;
                const currentDepth = getCurrentDungeonDepth(world);
                const linkedTarget = resolveLinkedStairTarget(params, currentDepth);
                const targetDepth = linkedTarget?.depth ?? resolveTargetDepth(world, params);
                if (!Number.isFinite(targetDepth)) {
                    handlePortalTravel(world, { actor, params, targetId, action: "useStairs" });
                    break;
                }
                const destination = linkedTarget?.position || resolveDestination(params, world.get(targetId, Position) || actorPos) || { x: actorPos.x, y: actorPos.y };
                const from = { x: actorPos.x, y: actorPos.y };

                try { activateDungeonLevel(world, targetDepth, { entryPoint: destination }); } catch {}
                applyDungeonLevelChange(world, targetDepth);

                world.set(actor, Position, { x: destination.x, y: destination.y });
                if (params.faceAway !== false && params.faceFrom) {
                    const face = normalizeVec(destination.x - params.faceFrom.x, destination.y - params.faceFrom.y);
                    if (face) {
                        if (world.has(actor, Facing)) world.set(actor, Facing, face);
                        else {
                            try { world.add(actor, Facing, face); } catch { }
                        }
                    }
                }

                const direction = linkedTarget ? (linkedTarget.depth > (currentDepth ?? 0) ? "down" : "up") : (targetDepth > (params.sourceDepth || 0) ? "down" : "up");

                world.emit?.("moved", { id: actor, from, to: { x: destination.x, y: destination.y }, via: "stairs" });
                world.emit?.("interaction", {
                    actor,
                    targetId,
                    action: "useStairs",
                    result: {
                        direction,
                        to: { x: destination.x, y: destination.y },
                        depth: targetDepth,
                    }
                });
            }
            break;

        case "usePortal":
            handlePortalTravel(world, { actor, params: inter.params || {}, targetId, action: "usePortal" });
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

function applyDungeonLevelChange(world, nextDepth) {
    const dungeonInfo = getDungeonRecord(world);
    if (!dungeonInfo) return;
    const { id, rec } = dungeonInfo;
    const current = Number(rec.level) || MIN_DUNGEON_DEPTH;
    const next = Math.max(MIN_DUNGEON_DEPTH, Math.min(MAX_DUNGEON_DEPTH, Number(nextDepth) || current));
    if (next === current) return;
    try {
        world.mutate(id, Dungeon, (r) => { r.level = next; });
    } catch {
        world.set(id, Dungeon, { level: next, id: rec?.id ?? null, name: rec?.name ?? "" });
    }
    resetPlayerVisibility(world);
    world.emit?.("dungeon:levelChanged", { level: next, previous: current });
}

function getDungeonRecord(world) {
    for (const [id, rec] of world.query(Dungeon)) {
        if (rec) return { id, rec };
    }
    return null;
}

function resolveTargetDepth(world, params) {
    if (!params) return null;
    if (Number.isFinite(params.targetDepth)) return Number(params.targetDepth);
    const delta = Number(params.depthDelta);
    if (Number.isFinite(delta) && delta !== 0) {
        const dungeonInfo = getDungeonRecord(world);
        if (dungeonInfo?.rec && Number.isFinite(dungeonInfo.rec.level)) {
            return dungeonInfo.rec.level + delta;
        }
    }
    return null;
}

function resolveLinkedStairTarget(params, currentDepth) {
    if (!Number.isFinite(currentDepth)) return null;
    const links = Array.isArray(params?.links) ? params.links : null;
    if (!links || links.length < 2) return null;
    const normalized = links.map((node) => ({
        depth: Number(node.depth),
        position: {
            x: Number(node.position?.x),
            y: Number(node.position?.y),
        }
    }));
    const current = normalized.find((node) => node.depth === currentDepth);
    if (!current) return null;
    const target = normalized.find((node) => node.depth !== currentDepth && Number.isFinite(node.depth));
    if (!target || !Number.isFinite(target.position.x) || !Number.isFinite(target.position.y)) return null;
    return target;
}

function resolveDestination(params, fallback) {
    if (params?.destinationPosition && Number.isFinite(params.destinationPosition.x) && Number.isFinite(params.destinationPosition.y)) {
        return { x: params.destinationPosition.x, y: params.destinationPosition.y };
    }
    if (params?.targetPosition && Number.isFinite(params.targetPosition.x) && Number.isFinite(params.targetPosition.y)) {
        return { x: params.targetPosition.x, y: params.targetPosition.y };
    }
    if (fallback) return { x: fallback.x, y: fallback.y };
    return null;
}

function handlePortalTravel(world, { actor, params, targetId, action }) {
    const linkId = Number(params?.targetId || targetId) || 0;
    if (!linkId) return;
    const destPos = world.get(linkId, Position);
    const actorPos = world.get(actor, Position);
    if (!destPos || !actorPos) return;
    const arrival = params?.arrivalOffset || {};
    const offsetX = Number(arrival.x) || 0;
    const offsetY = Number(arrival.y) || 0;
    const targetX = destPos.x + offsetX;
    const targetY = destPos.y + offsetY;
    const from = { x: actorPos.x, y: actorPos.y };
    world.set(actor, Position, { x: targetX, y: targetY });
    if (params?.faceAway !== false) {
        const face = normalizeVec(targetX - destPos.x, targetY - destPos.y);
        if (face) {
            if (world.has(actor, Facing)) world.set(actor, Facing, face);
            else {
                try { world.add(actor, Facing, face); } catch { }
            }
        }
    }
    world.emit?.("moved", { id: actor, from, to: { x: targetX, y: targetY }, via: action });
    world.emit?.("interaction", {
        actor,
        targetId: linkId,
        action,
        result: {
            mode: "portal",
            to: { x: targetX, y: targetY },
            linkId,
        }
    });
}

function getCurrentDungeonDepth(world) {
    const info = getDungeonRecord(world);
    return info?.rec ? Number(info.rec.level) : null;
}

function resetPlayerVisibility(world) {
    for (const [id, , brain] of world.query(Player, Brain)) {
        if (brain?.seenTiles instanceof Uint8Array) {
            brain.seenTiles.fill(0);
        } else if (brain) {
            try { world.mutate(id, Brain, (rec) => { rec.seenTiles = new Uint8Array(rec.seenTiles?.length || 0); }); } catch {}
        }
    }
}
