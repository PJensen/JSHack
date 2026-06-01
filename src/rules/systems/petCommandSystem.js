// src/rules/systems/petCommandSystem.js
// Processes player commands to pets and transitions pet state

import { PetCommandIntent } from '../components/Intents/PetCommandIntent.js';
import { Pet } from '../components/Pet.js';
import { PetState } from '../components/PetState.js';
import { Position } from '../components/Position.js';
import { playerEntity } from '../utils/queries.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { Vitality } from '../components/Vitality.js';

const COMMAND_COOLDOWN = 0; // turns between commands (0 = instant)

/**
 * petCommandSystem - processes player commands to pets
 * Runs before petBehaviorSystem to ensure state transitions happen before behavior
 */
export function petCommandSystem(world) {
  // Find player position for state context
  const playerPos = playerEntity(world)?.pos ?? null;

  // Process all pet commands
  for (const [intentId, intent] of world.query(PetCommandIntent)) {
    const petId = intent.petId;

    // Validate pet exists, is on-map, and is alive
    if (!world.has(petId, Pet) || !world.has(petId, Position)) {
      world.remove(intentId, PetCommandIntent);
      continue;
    }
    const vit = world.get(petId, Vitality);
    if (!vit || vit.hp <= 0) {
      world.remove(intentId, PetCommandIntent);
      continue;
    }

    // Get or create PetState
    let petState = world.get(petId, PetState);
    if (!petState) {
      world.add(petId, PetState, {
        state: 'following',
        targetX: null,
        targetY: null,
        targetItemId: 0,
        stateEnteredTurn: world.step,
        lastPlayerX: playerPos?.x ?? null,
        lastPlayerY: playerPos?.y ?? null,
        commandCooldown: 0,
      });
      petState = world.get(petId, PetState);
    }

    // Check cooldown
    if (petState.commandCooldown > 0) {
      world.emit('pet:command:cooldown', { petId, cooldown: petState.commandCooldown });
      world.remove(intentId, PetCommandIntent);
      continue;
    }

    // Process command and transition state
    const petPos = world.get(petId, Position);
    const prevState = petState.state;

    switch (intent.command) {
      case 'follow':
        petState.state = 'following';
        petState.targetX = null;
        petState.targetY = null;
        petState.targetItemId = 0;
        break;

      case 'stay':
        petState.state = 'staying';
        petState.targetX = petPos.x;
        petState.targetY = petPos.y;
        petState.targetItemId = 0;
        if (playerPos) {
          petState.lastPlayerX = playerPos.x;
          petState.lastPlayerY = playerPos.y;
        }
        break;

      case 'guard':
        petState.state = 'guarding';
        petState.targetX = intent.targetX ?? petPos.x;
        petState.targetY = intent.targetY ?? petPos.y;
        petState.targetItemId = 0;
        if (playerPos) {
          petState.lastPlayerX = playerPos.x;
          petState.lastPlayerY = playerPos.y;
        }
        break;

      case 'fetch':
        // Validate item exists and is on ground
        const itemId = intent.targetItemId;
        if (itemId && world.isAlive(itemId)) {
          const itemPos = world.get(itemId, Position);
          const itemInfo = world.get(itemId, ItemInfo);
          if (itemPos && itemInfo) {
            petState.state = 'fetching';
            petState.targetX = itemPos.x;
            petState.targetY = itemPos.y;
            petState.targetItemId = itemId;
          } else {
            // Invalid fetch target
            world.emit('pet:command:invalid', { petId, reason: 'item_not_on_ground' });
          }
        } else {
          world.emit('pet:command:invalid', { petId, reason: 'item_not_found' });
        }
        break;

      case 'aggressive':
        petState.state = 'aggressive';
        petState.targetX = null;
        petState.targetY = null;
        petState.targetItemId = 0;
        break;

      case 'idle':
        petState.state = 'idle';
        petState.targetX = null;
        petState.targetY = null;
        petState.targetItemId = 0;
        break;
    }

    // Update state metadata
    if (prevState !== petState.state) {
      petState.stateEnteredTurn = world.step;
      petState.commandCooldown = COMMAND_COOLDOWN;
      world.emit('pet:state:changed', {
        petId,
        prevState,
        newState: petState.state,
        command: intent.command
      });
    }

    // Remove intent
    world.remove(intentId, PetCommandIntent);
  }
}
