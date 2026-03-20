import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * PetState component - tracks pet behavior state and state-specific data
 *
 * States:
 * - 'following': Default behavior, follows player at distance
 * - 'idle': Stays in place, doesn't follow
 * - 'fetching': Moving toward a specific item to pick up
 * - 'returning': Has fetched item, returning to player
 * - 'guarding': Stays at a specific position, attacks nearby enemies
 * - 'aggressive': Follows player but actively seeks and attacks nearby enemies
 * - 'staying': Commanded to stay at current location
 * - 'fleeing': Low health, moving away from danger
 *
 * Fields:
 * - state: current state (string)
 * - targetX, targetY: target position for fetch/guard/stay states
 * - targetItemId: entity id of item being fetched (0 if none)
 * - stateEnteredTurn: world.step when this state was entered
 * - lastPlayerX, lastPlayerY: last known player position (for stay/guard)
 * - commandCooldown: turns before accepting new command (prevents command spam)
 * - rangedCooldown: turns before familiar can fire again (0 = ready)
 */
export const PetState = defineComponent(
  'PetState',
  {
    state: 'following',
    targetX: null,
    targetY: null,
    targetItemId: 0,
    stateEnteredTurn: 0,
    lastPlayerX: null,
    lastPlayerY: null,
    commandCooldown: 0,
    rangedCooldown: 0,
  },
  {
    validate(rec) {
      const validStates = ['following', 'idle', 'fetching', 'returning', 'guarding', 'aggressive', 'staying', 'fleeing'];
      if (!validStates.includes(rec.state)) {
        throw new Error(`PetState: state must be one of ${validStates.join(', ')}`);
      }
      if (rec.targetX !== null && !Number.isInteger(rec.targetX)) {
        throw new Error('PetState: targetX must be null or integer');
      }
      if (rec.targetY !== null && !Number.isInteger(rec.targetY)) {
        throw new Error('PetState: targetY must be null or integer');
      }
      if (!Number.isInteger(rec.targetItemId) || rec.targetItemId < 0) {
        throw new Error('PetState: targetItemId must be non-negative integer');
      }
      if (!Number.isInteger(rec.stateEnteredTurn) || rec.stateEnteredTurn < 0) {
        throw new Error('PetState: stateEnteredTurn must be non-negative integer');
      }
      if (rec.lastPlayerX !== null && !Number.isInteger(rec.lastPlayerX)) {
        throw new Error('PetState: lastPlayerX must be null or integer');
      }
      if (rec.lastPlayerY !== null && !Number.isInteger(rec.lastPlayerY)) {
        throw new Error('PetState: lastPlayerY must be null or integer');
      }
      if (!Number.isInteger(rec.commandCooldown) || rec.commandCooldown < 0) {
        throw new Error('PetState: commandCooldown must be non-negative integer');
      }
      if (!Number.isInteger(rec.rangedCooldown) || rec.rangedCooldown < 0) {
        throw new Error('PetState: rangedCooldown must be non-negative integer');
      }
      return true;
    }
  }
);
