import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * PetCommandIntent - player command to pet
 *
 * Commands:
 * - 'follow': Return to following the player (autonomous mode)
 * - 'stay': Stay at current position
 * - 'fetch': Fetch a specific item (requires targetItemId)
 * - 'guard': Guard a specific position (requires targetX, targetY)
 * - 'aggressive': Follow player but actively attack nearby enemies
 * - 'idle': Stop all activity
 *
 * Fields:
 * - petId: entity id of the pet receiving command
 * - command: command string
 * - targetX, targetY: optional target position for guard command
 * - targetItemId: optional item id for fetch command
 */
export const PetCommandIntent = defineComponent(
  'PetCommandIntent',
  {
    petId: 0,
    command: 'follow',
    targetX: null,
    targetY: null,
    targetItemId: 0,
  },
  {
    validate(rec) {
      const validCommands = ['follow', 'stay', 'fetch', 'guard', 'aggressive', 'idle'];
      if (!validCommands.includes(rec.command)) {
        throw new Error(`PetCommandIntent: command must be one of ${validCommands.join(', ')}`);
      }
      if (!Number.isInteger(rec.petId) || rec.petId <= 0) {
        throw new Error('PetCommandIntent: petId must be positive integer');
      }
      if (rec.targetX !== null && !Number.isInteger(rec.targetX)) {
        throw new Error('PetCommandIntent: targetX must be null or integer');
      }
      if (rec.targetY !== null && !Number.isInteger(rec.targetY)) {
        throw new Error('PetCommandIntent: targetY must be null or integer');
      }
      if (!Number.isInteger(rec.targetItemId) || rec.targetItemId < 0) {
        throw new Error('PetCommandIntent: targetItemId must be non-negative integer');
      }
      return true;
    }
  }
);
