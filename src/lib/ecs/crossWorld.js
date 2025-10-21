// crossWorld.js
// Utilities for cross-world (multi-world) entity references in ECS.
// This module is intentionally isolated from core ECS logic.

/**
 * Creates a cross-world reference object.
 * @param {World} world - The source or owning world.
 * @param {number} entityId - The entity ID in the source world.
 * @returns {{ world: World, entityId: number }}
 */
export function createCrossWorldReference(world, entityId) {
  return { world, entityId };
}

/**
 * Resolves a cross-world reference to an entity in its world.
 * @param {{ world: World, entityId: number }} ref - The cross-world reference.
 * @returns {object|null} The entity or null if not found.
 */
export function resolveCrossWorldReference(ref) {
  if (!ref || !ref.world || typeof ref.entityId !== 'number') return null;
  // Assumes World has a getEntity or similar method; adjust as needed.
  return ref.world.getEntity ? ref.world.getEntity(ref.entityId) : null;
}

/**
 * Checks if a cross-world reference is still valid (entity exists).
 * @param {{ world: World, entityId: number }} ref
 * @returns {boolean}
 */
export function isCrossWorldReferenceValid(ref) {
  return !!(ref && ref.world && typeof ref.entityId === 'number' && ref.world.has && ref.world.has(ref.entityId));
}
